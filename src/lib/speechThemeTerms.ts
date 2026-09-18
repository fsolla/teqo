/**
 * C192 — sanitization of the LLM-expanded theme terms before they reach the
 * Payload `where`. The expansion is untrusted model output: `%`/`_`/`\` would
 * widen the `LIKE`/`ILIKE` patterns, very short tokens produce noise, and the
 * list has to stay bounded so the textual OR does not explode. Pure and
 * client-safe.
 */
import { normalizeForSearch, uniqueByNormalizedForm } from '@/lib/speechSearch'

export const MAX_SPEECH_THEME_TERMS = 8
export const MIN_SPEECH_THEME_TERMS = 3
export const MAX_SPEECH_THEME_TERM_LENGTH = 60
const MIN_THEME_TERM_LENGTH = 3
const LIKE_WILDCARDS = /[%_\\]/g

const sanitizeSpeechThemeTerm = (value: string): string =>
  value
    .replace(LIKE_WILDCARDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEECH_THEME_TERM_LENGTH)
    .trim()

/** Removes wildcards, drops too-short/empty terms, dedupes and caps the list. */
export const normalizeSpeechThemeTerms = (values: readonly string[]): string[] =>
  uniqueByNormalizedForm(
    values
      .map(sanitizeSpeechThemeTerm)
      .filter((term) => normalizeForSearch(term).length >= MIN_THEME_TERM_LENGTH),
  ).slice(0, MAX_SPEECH_THEME_TERMS)
