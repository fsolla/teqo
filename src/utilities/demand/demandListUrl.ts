import type { Where } from 'payload'

import type { CampaignDemandKind, CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type DemandListState = {
  page: number
  q?: string
  status?: CampaignDemandStatus
  kind?: CampaignDemandKind
  activityId?: number
}

export const parseDemandListParams = (searchParams: RawSearchParams): DemandListState => {
  const rawStatus = firstValue(searchParams.status)
  const rawKind = firstValue(searchParams.kind)
  const activityId = strictDecimalInteger(firstValue(searchParams.activity))
  const q = normalizedText(firstValue(searchParams.q))

  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(q ? { q } : {}),
    ...(campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)
      ? { status: rawStatus as CampaignDemandStatus }
      : {}),
    ...(campaignDemandKinds.includes(rawKind as CampaignDemandKind)
      ? { kind: rawKind as CampaignDemandKind }
      : {}),
    ...(activityId ? { activityId } : {}),
  }
}

export const buildDemandListWhere = (state: DemandListState): Where => {
  const filters: Where[] = []

  if (state.status) filters.push({ status: { equals: state.status } })
  if (state.kind) filters.push({ kind: { equals: state.kind } })
  if (state.activityId) filters.push({ activity: { equals: state.activityId } })

  if (state.q) {
    filters.push({
      or: [{ title: { contains: state.q } }, { 'leadership.contact.name': { contains: state.q } }],
    })
  }

  return filters.length ? { and: filters } : {}
}

const buildDemandListSearchParams = (
  state: DemandListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.status) params.set('status', state.status)
  if (state.kind) params.set('kind', state.kind)
  if (state.activityId) params.set('activity', String(state.activityId))
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildDemandListHref = (state: DemandListState, page: number): string =>
  buildListHref(state, buildDemandListSearchParams, '/campanha/demandas', page)
