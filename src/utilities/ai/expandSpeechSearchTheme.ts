import 'server-only'

import { deepSeek } from '@ai-sdk/deepseek'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  MAX_SPEECH_THEME_TERM_LENGTH,
  MAX_SPEECH_THEME_TERMS,
  MIN_SPEECH_THEME_TERMS,
  normalizeSpeechThemeTerms,
} from '@/lib/speechThemeTerms'

const EXPAND_TIMEOUT_MS = 4000
const MAX_OUTPUT_TOKENS = 200
const MAX_THEME_LENGTH = 200

const expandSchemaFor = (corpus: ThemeSearchCorpus) =>
  z.object({
    terms: z
      .array(z.string())
      .describe(
        `Termos e expressões curtas (${MIN_SPEECH_THEME_TERMS} a ${MAX_SPEECH_THEME_TERMS}) que podem aparecer ${corpus === 'speech' ? 'na transcrição de falas' : 'na descrição ou na transcrição de uma peça'} sobre o tema. Lista vazia quando não houver termo confiável.`,
      ),
  })

/** The term rules are one contract; only the noun of the corpus changes. */
const themeExpansionRules = (subject: 'discurso' | 'peça'): string =>
  `Devolva de ${MIN_SPEECH_THEME_TERMS} a ${MAX_SPEECH_THEME_TERMS} termos, cada um com no máximo ${MAX_SPEECH_THEME_TERM_LENGTH} caracteres, sem explicações, ` +
  `sem pontuação extra e sem termos genéricos que apareceriam em qualquer ${subject} (ex.: "Brasil", ` +
  '"povo", "governo"). Se não houver termo confiável, devolva a lista vazia. Nunca invente fatos.'

const SPEECH_CORPUS_PROMPT =
  'Você ajuda a assessoria de comunicação a achar, no acervo de discursos do deputado Jorge Solla, ' +
  'falas sobre um tema mesmo quando ele não usou as palavras exatas da busca. ' +
  'Receberá o tema digitado e deve devolver termos e expressões curtas que provavelmente aparecem ' +
  'na transcrição de uma fala sobre esse tema — sinônimos, nomes de programas, termos técnicos e ' +
  'palavras relacionadas. Inclua a própria expressão do tema quando ela for útil. ' +
  themeExpansionRules('discurso')

const CONTENT_PIECE_CORPUS_PROMPT =
  'Você ajuda o eleitor a achar, na Central de Conteúdos do deputado Jorge Solla, peças de campanha ' +
  '(vídeos, áudios, fotos, cards e textos) sobre um tema mesmo quando a peça não usa as palavras ' +
  'exatas da busca. ' +
  'Receberá o tema digitado e deve devolver termos e expressões curtas que provavelmente aparecem ' +
  'na descrição ou na transcrição de uma peça sobre esse tema — sinônimos, nomes de programas, ' +
  'termos técnicos e palavras relacionadas. Inclua a própria expressão do tema quando ela for útil. ' +
  themeExpansionRules('peça')

/**
 * S28 — the corpus a theme expansion serves: the internal speech acervo (C192)
 * and the public Central de Conteúdos (S28). The mechanism is one; only the
 * system prompt describes a different body of material and persona.
 */
export type ThemeSearchCorpus = 'speech' | 'contentPiece'

const systemPromptFor = (corpus: ThemeSearchCorpus): string =>
  corpus === 'contentPiece' ? CONTENT_PIECE_CORPUS_PROMPT : SPEECH_CORPUS_PROMPT

export type ThemeSearchExpansion = { terms: string[] }

/**
 * The injectable expansion boundary (tests pass a deterministic resolver, the
 * same pattern as `SpeechVideoStartResolver`).
 */
export type ThemeSearchExpansionResolver = (theme: string) => Promise<ThemeSearchExpansion | null>

/** C192 — the speech-typed name the acervo keeps using. */
export type SpeechThemeExpansionResolver = ThemeSearchExpansionResolver

/**
 * C192/S28 — resolves the query into a theme expansion for a corpus. Never
 * throws: missing key, empty theme, timeout, provider error or malformed output
 * resolve to `null`, and the caller falls back to the literal search with a
 * discreet notice. An empty `terms` list is a legitimate answer (the model ran
 * but had nothing to add) and is distinct from `null` ("mechanism unavailable").
 */
export const expandSearchTheme = async (
  theme: string,
  corpus: ThemeSearchCorpus,
): Promise<ThemeSearchExpansion | null> => {
  if (!process.env.DEEPSEEK_API_KEY) return null

  const trimmed = theme.trim().slice(0, MAX_THEME_LENGTH)
  if (!trimmed) return null

  try {
    const { object } = await generateObject({
      model: deepSeek('deepseek-flash'),
      schema: expandSchemaFor(corpus),
      system: systemPromptFor(corpus),
      prompt: trimmed,
      // Deterministic as the provider allows: pages 2+ of the same search must
      // not be built from a different expansion.
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(EXPAND_TIMEOUT_MS),
    })

    return { terms: normalizeSpeechThemeTerms(object.terms) }
  } catch {
    return null
  }
}

/** C192 — the acervo de falas expansion (byte-identical contract). */
export const expandSpeechSearchTheme: SpeechThemeExpansionResolver = (theme) =>
  expandSearchTheme(theme, 'speech')

/** S28 — the public Central de Conteúdos expansion. */
export const expandContentPieceSearchTheme: ThemeSearchExpansionResolver = (theme) =>
  expandSearchTheme(theme, 'contentPiece')
