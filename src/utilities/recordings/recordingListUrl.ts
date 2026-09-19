/**
 * C199 — source switcher + list URL contract of the uploaded recordings. The
 * Câmara acervo keeps its own frozen contract (`speechListUrl`); the recordings
 * branch lives on the same `/campanha/comunicacao/acervo` page behind
 * `?source=enviadas` and owns its parses/serialization over the shared helpers.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const recordingPageSize = 25

/** Which acervo source the page is showing. `camara` is the default. */
export type AcervoSource = 'camara' | 'enviadas'

const ACERVO_SOURCE_PARAM = 'source'
const ACERVO_SOURCE_ENVIADAS = 'enviadas'

const recordingListParamNames = [ACERVO_SOURCE_PARAM, 'q', 'page'] as const
const recordingListParamNameSet = new Set<string>(recordingListParamNames)

export type RecordingListState = {
  source: 'enviadas'
  page: number
  q?: string
}

/** `enviadas` only for the explicit value; anything else is the Câmara default. */
export const parseAcervoSource = (params: RawSearchParams): AcervoSource =>
  firstValue(params[ACERVO_SOURCE_PARAM]) === ACERVO_SOURCE_ENVIADAS ? 'enviadas' : 'camara'

export const parseRecordingListParams = (params: RawSearchParams): RecordingListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawQ = normalizedText(firstValue(params.q))
  const q = rawQ && isContactSearchQueryReady(rawQ) ? rawQ : undefined

  return {
    source: 'enviadas',
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
  }
}

const recordingListSearchParams = (
  state: RecordingListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  // `source=enviadas` is always serialized — it is what selects the source.
  params.set(ACERVO_SOURCE_PARAM, ACERVO_SOURCE_ENVIADAS)
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildRecordingListHref = (state: RecordingListState, page: number): string =>
  buildListHref(state, recordingListSearchParams, CAMPAIGN_COMMUNICATION_ACERVO, page)

/** Toggle hrefs of the source switcher (the Câmara side is the bare acervo). */
export const buildAcervoSourceHref = (source: AcervoSource): string =>
  source === 'enviadas'
    ? `${CAMPAIGN_COMMUNICATION_ACERVO}?${ACERVO_SOURCE_PARAM}=${ACERVO_SOURCE_ENVIADAS}`
    : CAMPAIGN_COMMUNICATION_ACERVO

export const resolveRecordingListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): { state: RecordingListState; href: string; redirectHref?: string } =>
  resolveListUrl({
    params,
    paramNameSet: recordingListParamNameSet,
    parse: parseRecordingListParams,
    buildSearchParams: recordingListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_ACERVO,
    totalPages,
  })
