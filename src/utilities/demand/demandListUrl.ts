/**
 * Campaign demand list URL contract — client-safe (OH12). Loaders stay in
 * `campaignDemandData.ts` (`server-only`).
 */
import type { CampaignDemandKind, CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import {
  buildListHref,
  firstValue,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const demandPageSize = 25

export type DemandListState = {
  page: number
  status?: CampaignDemandStatus
  kind?: CampaignDemandKind
  activityId?: number
}

export type DemandListSearchParams = RawSearchParams

const demandListParamNames = ['status', 'kind', 'activity', 'page'] as const
const demandListParamNameSet = new Set<string>(demandListParamNames)

export const parseDemandListParams = (searchParams: RawSearchParams): DemandListState => {
  const rawStatus = firstValue(searchParams.status)
  const rawKind = firstValue(searchParams.kind)
  const activityId = strictDecimalInteger(firstValue(searchParams.activity))

  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)
      ? { status: rawStatus as CampaignDemandStatus }
      : {}),
    ...(campaignDemandKinds.includes(rawKind as CampaignDemandKind)
      ? { kind: rawKind as CampaignDemandKind }
      : {}),
    ...(activityId ? { activityId } : {}),
  }
}

const demandListStateToRawParams = (
  state: DemandListState,
  page = state.page,
): DemandListSearchParams => ({
  page: String(page),
  status: state.status,
  kind: state.kind,
  activity: state.activityId ? String(state.activityId) : undefined,
})

const serializeCanonicalDemandListSearchParams = (
  canonicalState: DemandListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.status) params.set('status', canonicalState.status)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.activityId) params.set('activity', String(canonicalState.activityId))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildDemandListSearchParams = (state: DemandListState, page = state.page): URLSearchParams =>
  serializeCanonicalDemandListSearchParams(
    parseDemandListParams(demandListStateToRawParams(state, page)),
  )

export const buildDemandListHref = (state: DemandListState, page: number): string =>
  buildListHref(state, buildDemandListSearchParams, '/campanha/demandas', page)

export const resolveDemandListUrl = (
  params: DemandListSearchParams,
  totalPages?: number,
): {
  state: DemandListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: demandListParamNameSet,
    parse: parseDemandListParams,
    buildSearchParams: buildDemandListSearchParams,
    basePath: '/campanha/demandas',
    totalPages,
  })
