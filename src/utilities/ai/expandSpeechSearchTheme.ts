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

const expandSchema = z.object({
  terms: z
    .array(z.string())
    .describe(
      `Termos e expressões curtas (${MIN_SPEECH_THEME_TERMS} a ${MAX_SPEECH_THEME_TERMS}) que podem aparecer na transcrição de falas sobre o tema. Lista vazia quando não houver termo confiável.`,
    ),
})

const EXPAND_SYSTEM_PROMPT =
  'Você ajuda a assessoria de comunicação a achar, no acervo de discursos do deputado Jorge Solla, ' +
  'falas sobre um tema mesmo quando ele não usou as palavras exatas da busca. ' +
  'Receberá o tema digitado e deve devolver termos e expressões curtas que provavelmente aparecem ' +
  'na transcrição de uma fala sobre esse tema — sinônimos, nomes de programas, termos técnicos e ' +
  'palavras relacionadas. Inclua a própria expressão do tema quando ela for útil. ' +
  `Devolva de ${MIN_SPEECH_THEME_TERMS} a ${MAX_SPEECH_THEME_TERMS} termos, cada um com no máximo ${MAX_SPEECH_THEME_TERM_LENGTH} caracteres, sem explicações, ` +
  'sem pontuação extra e sem termos genéricos que apareceriam em qualquer discurso (ex.: "Brasil", ' +
  '"povo", "governo"). Se não houver termo confiável, devolva a lista vazia. Nunca invente fatos.'

type SpeechThemeExpansion = { terms: string[] }

/**
 * The injectable expansion boundary (tests pass a deterministic resolver, the
 * same pattern as `SpeechVideoStartResolver`).
 */
export type SpeechThemeExpansionResolver = (theme: string) => Promise<SpeechThemeExpansion | null>

/**
 * C192 — resolves the query into a theme expansion. Never throws: missing key,
 * empty theme, timeout, provider error or malformed output resolve to `null`,
 * and the caller falls back to the literal search with a discreet notice. An
 * empty `terms` list is a legitimate answer (the model ran but had nothing to
 * add) and is distinct from `null` ("mechanism unavailable").
 */
export const expandSpeechSearchTheme: SpeechThemeExpansionResolver = async (theme) => {
  if (!process.env.DEEPSEEK_API_KEY) return null

  const trimmed = theme.trim().slice(0, MAX_THEME_LENGTH)
  if (!trimmed) return null

  try {
    const { object } = await generateObject({
      model: deepSeek('deepseek-flash'),
      schema: expandSchema,
      system: EXPAND_SYSTEM_PROMPT,
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
