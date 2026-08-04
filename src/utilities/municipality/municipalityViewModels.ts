import 'server-only'

import type { Payload } from 'payload'

import type { EngagementLevel } from '@/lib/engagementLevel'
import type { MunicipalityVoteRankEntry } from '@/lib/municipalityVoteRank'
import { populatedContactName, relationshipId } from '@/lib/relationship'
import {
  toVoteEstimateScenarioViewModel,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'
import type { CampaignUser, Leadership, Municipality } from '@/payload-types'
import { eligibleCampaignStaffWhere } from '@/utilities/campaignAccess'
import {
  createEmptyGoalCoverageByScenario,
  type MunicipalityGoalCoverage,
} from '@/utilities/municipality/goalCoverage'
import { type PoliticalTrendStatus } from '@/utilities/municipality/municipalityLabels'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'
import {
  computeMunicipalityTerritorialClass,
  type MunicipalityTerritorialClass,
  type TerritorialFactor,
} from '@/utilities/municipality/municipalityTerritorialClass'
import type { StateDeputySummary } from '@/utilities/stateDeputyData'
import type { MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'
import { createEmptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

export const municipalityListSelect = {
  name: true,
  slug: true,
  kind: true,
  city: true,
  region: true,
  ibgeCode: true,
  zoneNumber: true,
  advisors: true,
  stateDeputies: true,
  priority: true,
  lastUpdateAt: true,
  expectedVotes: true,
  politicalTrend: {
    status: true,
    note: true,
  },
  engagementLevel: true,
  levelNote: true,
  levelChangedAt: true,
} as const

type MunicipalityPoliticalTrendViewModel = {
  status: PoliticalTrendStatus | null
  note: string | null
  recordedByName: string | null
  recordedAt: string | null
}

export type MunicipalityListViewModel = {
  id: number
  name: string
  slug: string
  kind: Municipality['kind']
  city: string
  region: string
  ibgeCode: string
  zoneNumber: number | null
  advisorIDs: number[]
  /** B155 — leadership ids linked to this município (reverse read of `leadership.municipalities`). */
  leadershipIDs: number[]
  /** B157 — vínculos de dobradinhas para a coluna estilo assessores. */
  stateDeputyIDs: number[]
  priority: 'alta' | 'normal'
  lastUpdateAt: string | null
  /**
   * E9 frescor — `max(lastUpdateAt, pledges.lastPledgeAt)`, resolved once on
   * the server so the "há N dias" in the cell always matches the `frescor`
   * ordering.
   */
  lastSignalAt: string | null
  expectedVotes: VoteEstimateScenarioViewModel
  politicalTrendStatus: PoliticalTrendStatus | null
  politicalTrendNote: string | null
  /** E14 — staff-only; field access leaves it undefined for anyone else. */
  engagementLevel: EngagementLevel | null
  levelNote: string | null
  levelChangedAt: string | null
  pledges: MunicipalityPledgeAggregate
  votePosition2022: MunicipalityVoteRankEntry | null
  /** E10 — classe operacional derivada do artefato TSE. */
  territorialClass: MunicipalityTerritorialClass
  /** Os fatores que produziram a classe: a célula nunca mostra o rótulo sozinho. */
  territorialClassFactors: TerritorialFactor[]
  /** E8 "conta da cadeira" — meta × comprometido por cenário; null fora da staff view. */
  goalCoverageByScenario: Record<VoteEstimateScenario, MunicipalityGoalCoverage>
}

export const toMunicipalityListViewModel = (
  municipality: Municipality,
  pledges: MunicipalityPledgeAggregate | undefined,
  votePosition2022: MunicipalityListViewModel['votePosition2022'],
  goalCoverageByScenario?: Record<VoteEstimateScenario, MunicipalityGoalCoverage>,
  /** B155 — empty for non-staff views; the leader never renders this column. */
  leadershipIDs: number[] = [],
): MunicipalityListViewModel => {
  const territorialClass = computeMunicipalityTerritorialClass(municipality.slug)

  return {
    id: municipality.id,
    name: municipality.name,
    slug: municipality.slug,
    kind: municipality.kind,
    city: municipality.city,
    region: municipality.region,
    ibgeCode: municipality.ibgeCode,
    zoneNumber: municipality.zoneNumber ?? null,
    advisorIDs: (municipality.advisors ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    leadershipIDs,
    stateDeputyIDs: (municipality.stateDeputies ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    priority: municipality.priority === 'alta' ? 'alta' : 'normal',
    lastUpdateAt: municipality.lastUpdateAt ?? null,
    lastSignalAt: resolveMunicipalityLastSignalAt(
      municipality.lastUpdateAt ?? null,
      pledges?.lastPledgeAt ?? null,
    ),
    expectedVotes: toVoteEstimateScenarioViewModel(municipality.expectedVotes),
    politicalTrendStatus: municipality.politicalTrend?.status ?? null,
    politicalTrendNote: municipality.politicalTrend?.note ?? null,
    engagementLevel: municipality.engagementLevel ?? null,
    levelNote: municipality.levelNote ?? null,
    levelChangedAt: municipality.levelChangedAt ?? null,
    pledges: pledges ?? createEmptyMunicipalityPledgeAggregate(),
    votePosition2022,
    territorialClass: territorialClass.class,
    territorialClassFactors: territorialClass.factors,
    goalCoverageByScenario: goalCoverageByScenario ?? createEmptyGoalCoverageByScenario(),
  }
}

export type MunicipalityAdvisorSummary = {
  id: number
  name: string
  phone: string | null
}

export type MunicipalityDetailViewModel = {
  id: number
  name: string
  slug: string
  kind: Municipality['kind']
  city: string
  region: string
  ibgeCode: string
  tseCityCode: string
  zoneNumber: number | null
  tseZones: number[]
  advisorIDs: number[]
  lastUpdateAt: string | null
  /** Staff-only block — null for the leader view model. */
  strategy: MunicipalityStrategyViewModel | null
}

/**
 * The staff strategy block as the UI consumes it. Deliberately NOT derived
 * from the zod input schema or payload-types: storage keeps `{ text }` rows
 * and nullable scenario fields, the view flattens both.
 */
export type MunicipalityStrategyViewModel = {
  priority: 'alta' | 'normal'
  expectedVotes: VoteEstimateScenarioViewModel
  politicalTrend: MunicipalityPoliticalTrendViewModel
  /** E14 — the ladder and the motivo behind the current rung. */
  engagementLevel: EngagementLevel | null
  levelNote: string | null
  levelChangedAt: string | null
  strengths: string[]
  risks: string[]
  stateDeputyIDs: number[]
  stateDeputies: StateDeputySummary[]
  dobradinhaNotes: string | null
  nextSteps: string | null
  budgetNotes: string | null
}

export const toMunicipalityDetailViewModel = (
  municipality: Municipality,
  role: CampaignUser['role'],
  tseZones: number[],
  trendRecordedByName: string | null = null,
  stateDeputies: StateDeputySummary[] = [],
): MunicipalityDetailViewModel => ({
  id: municipality.id,
  name: municipality.name,
  slug: municipality.slug,
  kind: municipality.kind,
  city: municipality.city,
  region: municipality.region,
  ibgeCode: municipality.ibgeCode,
  tseCityCode: municipality.tseCityCode,
  zoneNumber: municipality.zoneNumber ?? null,
  tseZones,
  advisorIDs: (municipality.advisors ?? [])
    .map(relationshipId)
    .filter((id): id is number => id !== null),
  lastUpdateAt: municipality.lastUpdateAt ?? null,
  strategy:
    role === 'leader'
      ? null
      : {
          priority: municipality.priority === 'alta' ? 'alta' : 'normal',
          expectedVotes: toVoteEstimateScenarioViewModel(municipality.expectedVotes),
          politicalTrend: {
            status: municipality.politicalTrend?.status ?? null,
            note: municipality.politicalTrend?.note ?? null,
            recordedByName: trendRecordedByName,
            recordedAt: municipality.politicalTrend?.recordedAt ?? null,
          },
          engagementLevel: municipality.engagementLevel ?? null,
          levelNote: municipality.levelNote ?? null,
          levelChangedAt: municipality.levelChangedAt ?? null,
          strengths: (municipality.strengths ?? []).map((item) => item.text),
          risks: (municipality.risks ?? []).map((item) => item.text),
          stateDeputyIDs: (municipality.stateDeputies ?? [])
            .map(relationshipId)
            .filter((id): id is number => id !== null),
          stateDeputies,
          dobradinhaNotes: municipality.dobradinhaNotes ?? null,
          nextSteps: municipality.nextSteps ?? null,
          budgetNotes: municipality.budgetNotes ?? null,
        },
})

export const loadAdvisorSummaries = async (
  payload: Payload,
  user: CampaignUser,
  advisorIDs: number[],
): Promise<MunicipalityAdvisorSummary[]> => {
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

// ---------------------------------------------------------------------------
// B155 — Lideranças na lista de municípios
// ---------------------------------------------------------------------------

export type MunicipalityLeadershipSummary = {
  id: number
  name: string
}

export type EligibleLeadershipOption = {
  id: number
  name: string
}

const emptyLeadershipSummaries = {
  leadershipIDsByMunicipality: new Map<number, number[]>(),
  summariesById: new Map<number, MunicipalityLeadershipSummary>(),
} as const

/**
 * B155 — one reverse batch over `leadership.municipalities` for the município
 * list page: which leaderships each listed município links to (ids) plus the
 * contact-name lookup for their chips. Names ship in the cell, so the read
 * honours `canReadLeadership` (`user` + `overrideAccess: false`) — an advisor
 * only ever sees the leaderships of the municípios they administer.
 */
export const loadMunicipalityLeadershipSummaries = async (
  payload: Payload,
  user: CampaignUser,
  municipalityIDs: readonly number[],
): Promise<{
  leadershipIDsByMunicipality: ReadonlyMap<number, number[]>
  summariesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
}> => {
  if (municipalityIDs.length === 0) return emptyLeadershipSummaries

  const result = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: municipalityIDs } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: { municipalities: true, contact: true },
    user,
    overrideAccess: false,
  })

  const leadershipIDsByMunicipality = new Map<number, number[]>()
  const summariesById = new Map<number, MunicipalityLeadershipSummary>()

  for (const doc of result.docs as Leadership[]) {
    const leadershipID = relationshipId(doc.id)
    if (leadershipID === null) continue

    summariesById.set(leadershipID, { id: leadershipID, name: populatedContactName(doc.contact) })

    for (const municipality of doc.municipalities ?? []) {
      const municipalityID = relationshipId(municipality)
      if (municipalityID === null) continue
      const list = leadershipIDsByMunicipality.get(municipalityID) ?? []
      list.push(leadershipID)
      leadershipIDsByMunicipality.set(municipalityID, list)
    }
  }

  return { leadershipIDsByMunicipality, summariesById }
}

/**
 * B155 — every leadership the actor may add to a município from the popover:
 * all of them for unrestricted staff, portfolio-scoped for an advisor (the
 * same `canReadLeadership` the list cells trust). Sorted by contact name for
 * the Command; `createdAt` keeps the underlying fetch deterministic.
 */
export const getEligibleLeadershipOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<EligibleLeadershipOption[]> => {
  const result = await payload.find({
    collection: 'leadership',
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'createdAt',
    select: { contact: true },
    user,
    overrideAccess: false,
  })

  return result.docs
    .map((doc) => {
      const leadership = doc as Leadership
      const id = relationshipId(leadership.id)
      if (id === null) return null
      return { id, name: populatedContactName(leadership.contact) }
    })
    .filter((option): option is EligibleLeadershipOption => option !== null)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}
