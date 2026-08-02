import type { CampaignDemandKind, CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import {
  buildListHref,
  firstValue,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type DemandListState = {
  page: number
  status?: CampaignDemandStatus
  kind?: CampaignDemandKind
  activityId?: number
}

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

const buildDemandListSearchParams = (
  state: DemandListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.status) params.set('status', state.status)
  if (state.kind) params.set('kind', state.kind)
  if (state.activityId) params.set('activity', String(state.activityId))
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildDemandListHref = (state: DemandListState, page: number): string =>
  buildListHref(state, buildDemandListSearchParams, '/campanha/demandas', page)
