import 'server-only'

import { deepSeek } from '@ai-sdk/deepseek'
import { generateObject } from 'ai'
import { z } from 'zod'

const RERANK_TIMEOUT_MS = 6000
const MAX_REASON_LENGTH = 140
const MAX_CITATION_CHARS = 700
const MAX_OUTPUT_TOKENS = 400

export type SpeechExcerptRerankCandidate = {
  /** Pool index the tool maps back to the excerpt. */
  index: number
  /** Human date label (`formatSpeechAt`). */
  dateLabel: string
  durationSeconds: number
  /** Raw ASR citation, truncated for the prompt. */
  citation: string
}

export type SpeechExcerptRerankChoice = {
  index: number
  /** One-line reason the excerpt fits the stated intention. */
  reason: string
}

const rerankSchema = z.object({
  choices: z
    .array(
      z.object({
        index: z.number().int(),
        reason: z.string(),
      }),
    )
    .describe(
      'Trechos escolhidos, do melhor para o menos adequado à intenção (lista vazia quando nenhum candidato serve).',
    ),
})

const RERANK_SYSTEM_PROMPT =
  'Você ajuda a escolher trechos de falas do deputado Jorge Solla para peças de vídeo. ' +
  'Receberá a intenção de quem pede e uma lista de trechos candidatos extraídos do acervo, ' +
  'cada um com índice, data, duração e a citação da transcrição automática (ASR). ' +
  'Escolha os trechos que melhor sirvam à intenção — adequação ao tema, completude do argumento, ' +
  'tom e duração — e justifique cada escolha com UMA linha curta e concreta, citando o que no ' +
  'trecho atende ao pedido. Se nenhum candidato servir, devolva a lista vazia. ' +
  'Nunca invente falas, índices, minutagens ou motivos; a citação pode ter ruído de transcrição.'

/**
 * C158 — LLM reranking of the deterministic excerpt pool. Sends the user's
 * intention plus the candidates to DeepSeek and returns an ordered selection
 * with one-line reasons. Never throws and never blocks the tool: missing key,
 * timeout, provider error or malformed output all resolve to `null`, and the
 * caller owns the deterministic fallback. An empty selection is a legitimate
 * answer ("none serves the intention") and resolves to `{ choices: [] }`.
 * Timestamps/citations never come from here — they stay with the ASR window.
 */
export const rerankSpeechExcerpts = async ({
  intencao,
  tema,
  candidates,
  limit,
}: {
  intencao: string
  tema: string
  candidates: readonly SpeechExcerptRerankCandidate[]
  limit: number
}): Promise<{ choices: SpeechExcerptRerankChoice[] } | null> => {
  if (!process.env.DEEPSEEK_API_KEY || candidates.length === 0) return null

  const validIndices = new Set(candidates.map((candidate) => candidate.index))

  try {
    const { object } = await generateObject({
      model: deepSeek('deepseek-flash'),
      schema: rerankSchema,
      system: RERANK_SYSTEM_PROMPT,
      prompt: [
        `Intenção: ${intencao}`,
        `Tema: ${tema}`,
        `Escolha no máximo ${limit} trecho(s).`,
        '',
        'Trechos candidatos:',
        ...candidates.map(
          (candidate) =>
            `[${candidate.index}] ${candidate.dateLabel} · ${candidate.durationSeconds}s · "${candidate.citation.slice(0, MAX_CITATION_CHARS)}"`,
        ),
      ].join('\n'),
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
    })

    if (object.choices.length === 0) return { choices: [] }

    const seen = new Set<number>()
    const choices: SpeechExcerptRerankChoice[] = []
    for (const choice of object.choices) {
      const reason = choice.reason.trim().slice(0, MAX_REASON_LENGTH)
      if (!validIndices.has(choice.index) || seen.has(choice.index) || reason === '') continue
      seen.add(choice.index)
      choices.push({ index: choice.index, reason })
      if (choices.length >= limit) break
    }

    return choices.length > 0 ? { choices } : null
  } catch {
    return null
  }
}
