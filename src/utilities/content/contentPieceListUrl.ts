/**
 * C211 — URL contract of the Central de Conteúdos list
 * (`/campanha/comunicacao/conteudos`): search term, the three facet filters
 * (tipo, processamento, publicação) and pagination, over the shared helpers.
 * The canonical form drops a facet whose every option is selected — selecting
 * all is the same filter as selecting none (B18's frozen contract).
 */
import type { Where } from 'payload'

import { CAMPAIGN_COMMUNICATION_CONTEUDOS } from '@/lib/campaignPaths'
import {
  CONTENT_PIECE_PROCESSING_STATUSES,
  CONTENT_PIECE_STATUSES,
  CONTENT_PIECE_TYPES,
  type ContentPieceProcessingStatus,
  type ContentPieceStatus,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { normalizeForSearch } from '@/lib/speechSearch'
import {
  buildListHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const contentPiecePageSize = 25

const TYPE_PARAM = 'type'
const STATUS_PARAM = 'status'
const PROCESSING_PARAM = 'processing'

const contentPieceListParamNames = [
  TYPE_PARAM,
  STATUS_PARAM,
  PROCESSING_PARAM,
  'q',
  'page',
] as const
const contentPieceListParamNameSet = new Set<string>(contentPieceListParamNames)

const typeValues = new Set<string>(CONTENT_PIECE_TYPES)
const statusValues = new Set<string>(CONTENT_PIECE_STATUSES)
const processingValues = new Set<string>(CONTENT_PIECE_PROCESSING_STATUSES)

export type ContentPieceListState = {
  page: number
  q?: string
  types?: ContentPieceType[]
  statuses?: ContentPieceStatus[]
  processing?: ContentPieceProcessingStatus[]
}

export const parseContentPieceListParams = (params: RawSearchParams): ContentPieceListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const types = parseExhaustiveEnumParam<ContentPieceType>(params[TYPE_PARAM], typeValues)
  const statuses = parseExhaustiveEnumParam<ContentPieceStatus>(params[STATUS_PARAM], statusValues)
  const processing = parseExhaustiveEnumParam<ContentPieceProcessingStatus>(
    params[PROCESSING_PARAM],
    processingValues,
  )

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(types.length > 0 ? { types } : {}),
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(processing.length > 0 ? { processing } : {}),
  }
}

const contentPieceListSearchParams = (
  state: ContentPieceListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  for (const type of state.types ?? []) params.append(TYPE_PARAM, type)
  for (const status of state.statuses ?? []) params.append(STATUS_PARAM, status)
  for (const value of state.processing ?? []) params.append(PROCESSING_PARAM, value)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildContentPieceListHref = (state: ContentPieceListState, page: number): string =>
  buildListHref(state, contentPieceListSearchParams, CAMPAIGN_COMMUNICATION_CONTEUDOS, page)

export const resolveContentPieceListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): { state: ContentPieceListState; href: string; redirectHref?: string } =>
  resolveListUrl({
    params,
    paramNameSet: contentPieceListParamNameSet,
    parse: parseContentPieceListParams,
    buildSearchParams: contentPieceListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_CONTEUDOS,
    totalPages,
  })

type ContentPieceFacet = 'types' | 'statuses' | 'processing'

/** Toggles one value of a facet, resetting to page 1 and dropping an empty facet. */
const toggleFacet = <Value extends string>(
  state: ContentPieceListState,
  facet: ContentPieceFacet,
  value: Value,
): ContentPieceListState => {
  const current = (state[facet] ?? []) as readonly string[]
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return {
    ...state,
    page: 1,
    [facet]: next.length > 0 ? next : undefined,
  }
}

export const toggleContentPieceType = (
  state: ContentPieceListState,
  value: ContentPieceType,
): ContentPieceListState => toggleFacet(state, 'types', value)

export const toggleContentPieceStatus = (
  state: ContentPieceListState,
  value: ContentPieceStatus,
): ContentPieceListState => toggleFacet(state, 'statuses', value)

export const toggleContentPieceProcessing = (
  state: ContentPieceListState,
  value: ContentPieceProcessingStatus,
): ContentPieceListState => toggleFacet(state, 'processing', value)

export const clearContentPieceListFilters = (): ContentPieceListState => ({ page: 1 })

/**
 * The list `where`: the search term ILIKEs the normalized `searchText` (the
 * trigram index makes it sargable) and each selected facet narrows with `in`.
 */
export const buildContentPieceListWhere = (state: ContentPieceListState): Where => {
  const conditions: Where[] = []
  const q = normalizedText(state.q)
  if (q) conditions.push({ searchText: { contains: normalizeForSearch(q) } })
  if (state.types?.length) conditions.push({ type: { in: state.types } })
  if (state.statuses?.length) conditions.push({ status: { in: state.statuses } })
  if (state.processing?.length) conditions.push({ processingStatus: { in: state.processing } })

  if (conditions.length === 0) return {}
  return conditions.length === 1 ? conditions[0]! : { and: conditions }
}
