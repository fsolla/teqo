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

/**
 * B161 — the list is continuous (infinite scroll); `page` left the URL
 * contract: it is never parsed nor serialized, and a stale `?page=` is just
 * another unknown param the canonical pass drops.
 */
export type DemandListState = {
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

const buildDemandListSearchParams = (state: DemandListState): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.status) params.set('status', state.status)
  if (state.kind) params.set('kind', state.kind)
  if (state.activityId) params.set('activity', String(state.activityId))
  return params
}

export const buildDemandListHref = (state: DemandListState): string =>
  buildListHref(state, buildDemandListSearchParams, '/campanha/demandas')
