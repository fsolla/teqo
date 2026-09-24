/**
 * C216 — source vocabulary of the acervo. `camara` is the default; `enviadas`
 * is the uploaded-recordings source (C199) and `internet` the web speeches
 * (C216). Pure/client-safe: the source switcher, the page dispatcher and the
 * URL contracts share it (importing the vocabulary from `recordings` inside
 * `speech*` would create a cycle). An unknown value is fail-closed on the
 * Câmara source — the same rule the URL contracts apply.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'

type RawAcervoSourceParams = Record<string, string | string[] | undefined>

export const ACERVO_SOURCE_PARAM = 'source'
export const ACERVO_SOURCE_ENVIADAS = 'enviadas'
export const ACERVO_SOURCE_INTERNET = 'internet'

/** Which acervo source the page is showing. `camara` is the default. */
export type AcervoSource = 'camara' | 'enviadas' | 'internet'

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/** Only the explicit values select a source; anything else is the Câmara default. */
export const parseAcervoSource = (params: RawAcervoSourceParams): AcervoSource => {
  const value = firstParam(params[ACERVO_SOURCE_PARAM])
  if (value === ACERVO_SOURCE_ENVIADAS) return 'enviadas'
  if (value === ACERVO_SOURCE_INTERNET) return 'internet'
  return 'camara'
}

/** Toggle hrefs of the source switcher (the Câmara side is the bare acervo). */
export const buildAcervoSourceHref = (source: AcervoSource): string => {
  if (source === 'enviadas') {
    return `${CAMPAIGN_COMMUNICATION_ACERVO}?${ACERVO_SOURCE_PARAM}=${ACERVO_SOURCE_ENVIADAS}`
  }
  if (source === 'internet') {
    return `${CAMPAIGN_COMMUNICATION_ACERVO}?${ACERVO_SOURCE_PARAM}=${ACERVO_SOURCE_INTERNET}`
  }
  return CAMPAIGN_COMMUNICATION_ACERVO
}
