/**
 * C168 — URL contract of the cut library list (`/campanha/comunicacao/acervo/cortes`):
 * only free-text search (`q`) and pagination, over the shared `campaignListUrl`
 * helpers. Facets of the speech acervo stay there — the cut is the unit and the
 * origin is context of the item, not a filter dimension.
 */
import type { Where } from 'payload'

import { CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const speechCutPageSize = 25

export type SpeechCutListState = {
  page: number
  q?: string
}

const speechCutListParamNames = ['q', 'page'] as const

const speechCutListParamNameSet = new Set<string>(speechCutListParamNames)

export const parseSpeechCutListParams = (params: RawSearchParams): SpeechCutListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
  }
}

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalSpeechCutListSearchParams = (
  canonicalState: SpeechCutListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildSpeechCutListSearchParams = (
  state: SpeechCutListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalSpeechCutListSearchParams(
    parseSpeechCutListParams({
      page: String(page),
      q: state.q,
    }),
  )

export const buildSpeechCutListHref = (state: SpeechCutListState, page: number): string =>
  buildListHref(state, buildSpeechCutListSearchParams, CAMPAIGN_COMMUNICATION_CORTES, page)

export const buildSpeechCutFiltersKey = (state: SpeechCutListState): string =>
  buildSpeechCutListSearchParams(state).toString()

export const resolveSpeechCutListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: SpeechCutListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: speechCutListParamNameSet,
    parse: parseSpeechCutListParams,
    buildSearchParams: buildSpeechCutListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_CORTES,
    totalPages,
  })

/**
 * Source-level `where`: `q` matches the cut's own title or description (ILIKE
 * substring, case-insensitive — the operator `contactListUrl` verified against
 * Postgres). The origin speech is context, never a search dimension.
 */
export const buildSpeechCutListWhere = (state: SpeechCutListState): Where => {
  if (!state.q) return {}
  return {
    or: [{ title: { like: state.q } }, { description: { like: state.q } }],
  }
}
