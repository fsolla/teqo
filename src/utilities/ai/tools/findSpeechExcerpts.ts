import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { formatSpeechClock } from '@/lib/speechClock'
import {
  buildSpeechExcerpt,
  EXCERPT_VARIANT_TARGETS,
  speechExcerptTerms,
  type SpeechExcerpt,
  type SpeechExcerptSegment,
} from '@/lib/speechExcerpt'
import type { Speech } from '@/payload-types'
import {
  rerankSpeechExcerpts,
  type SpeechExcerptRerankChoice,
} from '@/utilities/ai/rerankSpeechExcerpts'
import { loadSegmentsForSpeeches } from '@/utilities/speech/speechPageData'
import { buildWatchHref, formatSpeechAt } from '@/utilities/speech/speechViewModels'

const DENIED_MESSAGE = 'Leitura do acervo de falas negada.'
const NO_TERMS_MESSAGE = 'Tema sem termos de busca: informe palavras com 3 caracteres ou mais.'
const EXCERPT_CRITERION =
  'Trecho contínuo montado sobre os segmentos transcritos (ASR) que contém todos os termos do tema — janela usual de 15 a 60 segundos (segmento único maior é mantido inteiro); a citação é aproximada e pode ter ruído de transcrição.'
const TRUNCATED_HINT =
  'Há mais discursos candidatos além dos analisados; refine o tema para chegar em outros.'

const SPEECH_CANDIDATE_LIMIT = 30
const EXCERPT_POOL_SPEECHES = 6

type SpeechCandidate = Pick<Speech, 'id' | 'speechAt' | 'type'>

type PoolCandidate = {
  indice: number
  speechId: number
  speechAt: string
  type: string | null
  excerpt: SpeechExcerpt
}

type SelectedCandidate = {
  candidate: PoolCandidate
  motivo?: string
}

/**
 * C158 — suggests continuous speech excerpts from the internal acervo for a
 * video piece. The deterministic part owns recall: term AND over
 * `speech.searchText` (trigram), recency ordering and the contiguous ASR
 * window (short/long variants). The LLM reranker (D9) only reorders/chooses
 * among those candidates and writes one-line reasons — it never invents a
 * quote or a timestamp, and never blocks the answer: no key, timeout or
 * invalid output fall back to the deterministic order.
 */
export const findSpeechExcerpts = (ctx: AIToolContext) =>
  tool({
    description:
      'Finds short continuous excerpts of Jorge Solla speeches from the internal communication acervo that match a theme, for video pieces. ' +
      'Use when the user asks for a good speech excerpt/quote for a video about X ' +
      '(e.g. "Qual seria uma boa fala do deputado para criarmos um reels sobre o hospital do subúrbio?"). ' +
      'Pass the theme keywords in "tema" and the user intention in "intencao" (usage, tone, desired duration). ' +
      'Each suggestion carries the ASR quote, start/end timecodes, a reason when AI-ranked, and a link to the acervo at the excerpt point.',
    inputSchema: z.object({
      tema: z
        .string()
        .trim()
        .min(1)
        .describe(
          'Palavras de conteúdo do tema (ex.: "hospital do subúrbio", "farmácia popular"). Nunca a pergunta inteira nem palavras que o usuário não disse.',
        ),
      intencao: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'O que o usuário quer com a peça, nas palavras dele: uso (reels, story, debate), tom e duração desejada. Omita só quando o pedido não expressar nada além do tema.',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .default(3)
        .describe('Máximo de trechos sugeridos (default 3, max 5).'),
    }),
    execute: async ({ tema, intencao, limit }) => {
      if (!canReadCommunicationCatalog(ctx.user.role)) return { error: DENIED_MESSAGE }

      const terms = speechExcerptTerms(tema)
      const consulta = { tema: tema.trim(), termos: terms, intencao: intencao?.trim() ?? null }
      if (terms.length === 0) return { error: NO_TERMS_MESSAGE }

      const speeches = await ctx.payload.find({
        collection: 'speech',
        where: { and: terms.map((term) => ({ searchText: { like: term } })) },
        depth: 0,
        limit: SPEECH_CANDIDATE_LIMIT,
        page: 1,
        sort: '-speechAt',
        select: { speechAt: true, type: true },
        overrideAccess: false,
        user: ctx.user,
      })

      const docs = speeches.docs
      const truncado = speeches.totalDocs > docs.length

      if (docs.length === 0) {
        return {
          consulta,
          criterio: EXCERPT_CRITERION,
          totalDiscursos: 0,
          reordenadoPorIA: false,
          trechos: [],
          truncado: false,
        }
      }

      const segmentsBySpeech = await loadSegmentsForSpeeches(
        ctx.payload,
        ctx.user,
        docs.map((doc) => doc.id),
      )
      const pool = buildExcerptPool(docs, segmentsBySpeech, terms)

      if (pool.length === 0) {
        return {
          consulta,
          criterio: EXCERPT_CRITERION,
          totalDiscursos: docs.length,
          reordenadoPorIA: false,
          trechos: [],
          truncado,
          ...(truncado ? { dica: TRUNCATED_HINT } : {}),
        }
      }

      const reranked = await rerankSpeechExcerpts({
        intencao: consulta.intencao ?? consulta.tema,
        tema: consulta.tema,
        candidates: pool.map((candidate) => ({
          index: candidate.indice,
          dateLabel: formatSpeechAt(candidate.speechAt),
          durationSeconds: Math.round(
            candidate.excerpt.endSeconds - candidate.excerpt.startSeconds,
          ),
          citation: candidate.excerpt.text,
        })),
        limit,
      })

      const selected = reranked
        ? selectRerankedExcerpts(pool, reranked.choices, limit)
        : selectDeterministicExcerpts(pool, limit)

      return {
        consulta,
        criterio: EXCERPT_CRITERION,
        totalDiscursos: docs.length,
        reordenadoPorIA: reranked !== null,
        trechos: selected.map(toExcerptViewModel),
        truncado,
        ...(truncado ? { dica: TRUNCATED_HINT } : {}),
      }
    },
  })

/** Short/long windows of the most recent matching speeches, capped for the reranker prompt. */
const buildExcerptPool = (
  docs: readonly SpeechCandidate[],
  segmentsBySpeech: ReadonlyMap<number, SpeechExcerptSegment[]>,
  terms: readonly string[],
): PoolCandidate[] => {
  const pool: PoolCandidate[] = []
  let contributedSpeeches = 0

  for (const doc of docs) {
    if (contributedSpeeches >= EXCERPT_POOL_SPEECHES) break
    if (!doc.speechAt) continue

    const segments = segmentsBySpeech.get(doc.id) ?? []
    const seenWindows = new Set<string>()
    let contributed = false

    for (const targetSeconds of EXCERPT_VARIANT_TARGETS) {
      const excerpt = buildSpeechExcerpt(segments, terms, { targetSeconds })
      if (!excerpt) continue
      const windowKey = `${excerpt.startSeconds}-${excerpt.endSeconds}`
      if (seenWindows.has(windowKey)) continue
      seenWindows.add(windowKey)
      pool.push({
        indice: pool.length,
        speechId: doc.id,
        speechAt: doc.speechAt,
        type: doc.type ?? null,
        excerpt,
      })
      contributed = true
    }

    if (contributed) contributedSpeeches += 1
  }

  return pool
}

/** Fallback order: one excerpt per speech, recency first, the longer variant when both fit. */
const selectDeterministicExcerpts = (
  pool: readonly PoolCandidate[],
  limit: number,
): SelectedCandidate[] => {
  const bySpeech = new Map<number, PoolCandidate>()
  for (const candidate of pool) {
    const current = bySpeech.get(candidate.speechId)
    if (!current) {
      bySpeech.set(candidate.speechId, candidate)
      continue
    }
    const currentDuration = current.excerpt.endSeconds - current.excerpt.startSeconds
    const candidateDuration = candidate.excerpt.endSeconds - candidate.excerpt.startSeconds
    if (candidateDuration > currentDuration) bySpeech.set(candidate.speechId, candidate)
  }

  return [...bySpeech.values()].slice(0, limit).map((candidate) => ({ candidate }))
}

/** Reranker result: its order, its reasons, still one excerpt per speech. */
const selectRerankedExcerpts = (
  pool: readonly PoolCandidate[],
  choices: readonly SpeechExcerptRerankChoice[],
  limit: number,
): SelectedCandidate[] => {
  const byIndex = new Map(pool.map((candidate) => [candidate.indice, candidate]))
  const usedSpeeches = new Set<number>()
  const selected: SelectedCandidate[] = []

  for (const choice of choices) {
    const candidate = byIndex.get(choice.index)
    if (!candidate || usedSpeeches.has(candidate.speechId)) continue
    usedSpeeches.add(candidate.speechId)
    selected.push({ candidate, motivo: choice.reason })
    if (selected.length >= limit) break
  }

  return selected
}

const toExcerptViewModel = ({ candidate, motivo }: SelectedCandidate) => ({
  discursoId: candidate.speechId,
  data: formatSpeechAt(candidate.speechAt),
  tipo: candidate.type,
  inicioSegundos: Math.floor(candidate.excerpt.startSeconds),
  fimSegundos: Math.ceil(candidate.excerpt.endSeconds),
  inicioLabel: formatSpeechClock(candidate.excerpt.startSeconds),
  fimLabel: formatSpeechClock(candidate.excerpt.endSeconds),
  duracaoSegundos: Math.round(candidate.excerpt.endSeconds - candidate.excerpt.startSeconds),
  citacao: candidate.excerpt.text,
  termosCasados: candidate.excerpt.matchedTerms,
  ...(motivo ? { motivo } : {}),
  url: buildWatchHref(
    candidate.speechId,
    candidate.excerpt,
    candidate.excerpt.matchedTerms.join(' '),
  ),
})
