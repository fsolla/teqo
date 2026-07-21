import type { Payload } from 'payload'

import type { CampaignUser, Plaza } from '@/payload-types'
import type { PoliticalTrendStatus } from '@/utilities/plazaUi'
import { eligibleCampaignStaffWhere } from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'
import { toVoteGoalsViewModel, type VoteGoalsViewModel } from '@/utilities/voteGoals'
import type { PlazaPledgeAggregate } from '@/utilities/votePledgeData'
import { emptyPlazaPledgeAggregate } from '@/utilities/votePledgeData'

export const plazaListSelect = {
  name: true,
  slug: true,
  kind: true,
  city: true,
  region: true,
  ibgeCode: true,
  zoneNumber: true,
  advisors: true,
  priority: true,
  lastUpdateAt: true,
  expectedVotes: true,
  politicalTrend: {
    status: true,
    note: true,
  },
} as const

export type PlazaPoliticalTrendViewModel = {
  status: PoliticalTrendStatus | null
  note: string | null
  recordedByName: string | null
  recordedAt: string | null
}

export type PlazaListViewModel = {
  id: number
  name: string
  slug: string
  kind: Plaza['kind']
  city: string
  region: string
  ibgeCode: string
  zoneNumber: number | null
  advisorIDs: number[]
  priority: 'alta' | 'normal'
  lastUpdateAt: string | null
  expectedVotes: number | null
  politicalTrendStatus: PoliticalTrendStatus | null
  politicalTrendNote: string | null
  pledges: PlazaPledgeAggregate
}

export const toPlazaListViewModel = (
  plaza: Plaza,
  pledges?: PlazaPledgeAggregate,
): PlazaListViewModel => ({
  id: plaza.id,
  name: plaza.name,
  slug: plaza.slug,
  kind: plaza.kind,
  city: plaza.city,
  region: plaza.region,
  ibgeCode: plaza.ibgeCode,
  zoneNumber: plaza.zoneNumber ?? null,
  advisorIDs: (plaza.advisors ?? []).map(relationshipId).filter((id): id is number => id !== null),
  priority: plaza.priority === 'alta' ? 'alta' : 'normal',
  lastUpdateAt: plaza.lastUpdateAt ?? null,
  expectedVotes: plaza.expectedVotes ?? null,
  politicalTrendStatus: plaza.politicalTrend?.status ?? null,
  politicalTrendNote: plaza.politicalTrend?.note ?? null,
  pledges: pledges ?? { ...emptyPlazaPledgeAggregate },
})

export type PlazaAdvisorSummary = {
  id: number
  name: string
  phone: string | null
}

export type PlazaDetailViewModel = {
  id: number
  name: string
  slug: string
  kind: Plaza['kind']
  city: string
  region: string
  ibgeCode: string
  tseCityCode: string
  zoneNumber: number | null
  tseZones: number[]
  advisorIDs: number[]
  lastUpdateAt: string | null
  /** Staff-only block — null for the leader view model. */
  strategy: {
    priority: 'alta' | 'normal'
    expectedVotes: number | null
    voteGoals: VoteGoalsViewModel
    politicalTrend: PlazaPoliticalTrendViewModel
    strengths: string[]
    risks: string[]
    dobradinhaNotes: string | null
    nextSteps: string | null
  } | null
}

export const toPlazaDetailViewModel = (
  plaza: Plaza,
  role: CampaignUser['role'],
  tseZones: number[],
  trendRecordedByName: string | null = null,
): PlazaDetailViewModel => ({
  id: plaza.id,
  name: plaza.name,
  slug: plaza.slug,
  kind: plaza.kind,
  city: plaza.city,
  region: plaza.region,
  ibgeCode: plaza.ibgeCode,
  tseCityCode: plaza.tseCityCode,
  zoneNumber: plaza.zoneNumber ?? null,
  tseZones,
  advisorIDs: (plaza.advisors ?? []).map(relationshipId).filter((id): id is number => id !== null),
  lastUpdateAt: plaza.lastUpdateAt ?? null,
  strategy:
    role === 'leader'
      ? null
      : {
          priority: plaza.priority === 'alta' ? 'alta' : 'normal',
          expectedVotes: plaza.expectedVotes ?? null,
          voteGoals: toVoteGoalsViewModel(plaza.voteGoals),
          politicalTrend: {
            status: plaza.politicalTrend?.status ?? null,
            note: plaza.politicalTrend?.note ?? null,
            recordedByName: trendRecordedByName,
            recordedAt: plaza.politicalTrend?.recordedAt ?? null,
          },
          strengths: (plaza.strengths ?? []).map((item) => item.text),
          risks: (plaza.risks ?? []).map((item) => item.text),
          dobradinhaNotes: plaza.dobradinhaNotes ?? null,
          nextSteps: plaza.nextSteps ?? null,
        },
})

export const loadAdvisorSummaries = async (
  payload: Payload,
  user: CampaignUser,
  advisorIDs: number[],
): Promise<PlazaAdvisorSummary[]> => {
  if (advisorIDs.length === 0) return []

  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [{ id: { in: advisorIDs } }, eligibleCampaignStaffWhere],
    },
    depth: 0,
    pagination: false,
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })
  const advisorById = new Map(
    result.docs.map(({ id, name, phone }) => [id, { id, name, phone: phone ?? null }]),
  )

  return advisorIDs.flatMap((id) => {
    const advisor = advisorById.get(id)
    return advisor ? [advisor] : []
  })
}

export type EligibleAdvisorOption = Pick<CampaignUser, 'id' | 'name'> & {
  isCurrent: boolean
}

export const getEligibleAdvisorOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<EligibleAdvisorOption[]> => {
  const result = await payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    sort: 'name',
    where: eligibleCampaignStaffWhere,
    select: { name: true },
    user,
    overrideAccess: false,
  })

  return result.docs
    .map(({ id, name }) => ({
      id,
      name,
      isCurrent: id === user.id,
    }))
    .sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent))
}
