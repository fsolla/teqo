import 'server-only'

import type { Payload, Where } from 'payload'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import type { CalendarPhase } from '@/lib/visitPlannerAnchors'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import type { CampaignUser, Municipality } from '@/payload-types'
import { computeGoalCoverage } from '@/utilities/municipality/goalCoverage'
import { loadStatewideSuggestedGoals } from '@/utilities/municipality/municipalityGoalAccount'
import {
  catalogMedianProjectedValidVotes,
  catalogMedianUncapturedFieldVotes,
  uncapturedFieldVotes,
} from '@/utilities/municipality/municipalityPotential'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { evaluateVisitEligibility, resolveCalendarPhase } from '@/utilities/visit/visitEligibility'
import {
  compareVisitCandidates,
  type VisitCandidateGroupViewModel,
  type VisitCandidateViewModel,
  type VisitPlannerBundle,
} from '@/utilities/visit/visitPlannerViews'
import { aggregatePledgesByMunicipality } from '@/utilities/votePledgeData'
import {
  emptyMunicipalityPledgeAggregate,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeViews'

/**
 * E13 loader — the municípios in the actor's scope, each with its five visit
 * conditions evaluated, grouped by identity territory (the unit a giro travels
 * in).
 *
 * It reads `municipality` itself instead of going through
 * `loadMunicipalityScope`: that select is a superset shared by the dashboard,
 * the map and the list, and it carries neither `politicalTrend` nor
 * `stateDeputies` — the two fields the "janela política" condition needs.
 * Widening the shared select would charge every one of those surfaces for two
 * fields only the planner reads.
 */
type PlannerMunicipalityDoc = Pick<
  Municipality,
  | 'id'
  | 'name'
  | 'slug'
  | 'region'
  | 'advisors'
  | 'priority'
  | 'expectedVotes'
  | 'politicalTrend'
  | 'stateDeputies'
>

/**
 * Lideranças per município in ONE query with a Map, never N counts — the
 * precedent is `leadershipCount` in `organizationData.ts`. Intentional admin
 * bypass: counts only, over município ids the actor was already allowed to read.
 * Exported for the suggestion evaluator (E11), which assembles the same
 * network inputs over the same scope.
 */
export const countLeadershipsByMunicipality = async (
  payload: Payload,
  municipalityIDs: ReadonlyArray<number>,
): Promise<Map<number, number>> => {
  const counts = new Map<number, number>()
  if (municipalityIDs.length === 0) return counts

  const inScope = new Set(municipalityIDs)
  const leaderships = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: [...municipalityIDs] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { municipalities: true },
    overrideAccess: true,
  })

  for (const leadership of leaderships.docs) {
    for (const municipality of leadership.municipalities ?? []) {
      const id = relationshipId(municipality)
      if (id !== null && inScope.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }

  return counts
}

/**
 * "Encaixe em giro" in v1 = another município of the SAME identity territory,
 * in this actor's scope, that already has somewhere to stop. There is no
 * adjacency graph at runtime (`bahiaTerritories.ts` carries membership only),
 * and building one is the route-optimizer rabbit hole the plan forbids — so
 * the group the loader already assembled IS the answer, at no extra cost.
 */
const countStopPeersByRegion = (
  entries: ReadonlyArray<{ region: BahiaIdentityTerritory; hasStop: boolean }>,
): Map<BahiaIdentityTerritory, number> => {
  const counts = new Map<BahiaIdentityTerritory, number>()
  for (const entry of entries) {
    if (!entry.hasStop) continue
    counts.set(entry.region, (counts.get(entry.region) ?? 0) + 1)
  }
  return counts
}

type VisitPlannerRegionOption = {
  region: BahiaIdentityTerritory
  municipalityCount: number
}

/**
 * The identity territories the actor can actually compose a giro in, with how
 * many municípios of theirs live in each. One cheap `slug`-only read: offering
 * all 27 TIs to an advisor with a six-município portfolio would be offering
 * twenty-one dead ends, and evaluating the full eligibility of the state just to
 * build a picker would cost the whole planner load.
 */
export const loadVisitPlannerRegions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<VisitPlannerRegionOption[]> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { slug: true },
    user,
    overrideAccess: false,
  })

  const counts = new Map<BahiaIdentityTerritory, number>()
  for (const municipality of result.docs) {
    const region = getMunicipalityCatalogEntry(municipality.slug)?.region
    if (region) counts.set(region, (counts.get(region) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([region, municipalityCount]) => ({ region, municipalityCount }))
    .sort((left, right) => left.region.localeCompare(right.region, 'pt-BR'))
}

export type VisitPlannerFilter = {
  /** Restrict to one identity territory — the composer always does. */
  region?: BahiaIdentityTerritory
  /** Injected so the calendar phase is testable and stable within a request. */
  now?: Date
}

export const loadVisitCandidates = async (
  payload: Payload,
  user: CampaignUser,
  { region, now = new Date() }: VisitPlannerFilter = {},
): Promise<VisitPlannerBundle> => {
  const where: Where = region ? { region: { equals: region } } : {}

  const result = await payload.find({
    collection: 'municipality',
    where,
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      name: true,
      slug: true,
      region: true,
      advisors: true,
      priority: true,
      expectedVotes: true,
      politicalTrend: true,
      stateDeputies: true,
    },
    user,
    overrideAccess: false,
  })
  const municipalities = result.docs as PlannerMunicipalityDoc[]
  const municipalityIDs = municipalities.map((municipality) => municipality.id)

  const [pledgeAggregates, leadershipCounts, { suggestedGoalBySlug, potentialBySlug }] =
    await Promise.all([
      aggregatePledgesByMunicipality(payload, municipalityIDs),
      countLeadershipsByMunicipality(payload, municipalityIDs),
      loadStatewideSuggestedGoals(payload, user),
    ])

  // First pass: everything that does not depend on the município's neighbours.
  const partials = municipalities.flatMap((municipality) => {
    // A município outside the catalog has no derived potential to reason about;
    // it can only exist as leftover data, so it is not a visit candidate.
    const catalogEntry = getMunicipalityCatalogEntry(municipality.slug)
    const suggestedGoalByScenario = suggestedGoalBySlug.get(municipality.slug)
    const potential = potentialBySlug.get(municipality.slug)
    if (!catalogEntry || !suggestedGoalByScenario || !potential) return []

    const pledgeAggregate: MunicipalityPledgeAggregate =
      pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    const leadershipCount = leadershipCounts.get(municipality.id) ?? 0

    return [
      {
        municipality,
        region: catalogEntry.region,
        leadershipCount,
        pledgeAggregate,
        // Somewhere for the candidate to actually stop: a liderança to receive
        // him or a pledge already recorded. Read twice below — as this
        // município's own gate, and as a neighbour's contribution to the giro.
        hasStop: leadershipCount >= 1 || pledgeAggregate.pledgeCount >= 1,
        uncapturedFieldVotes: uncapturedFieldVotes(
          getMunicipalityFederalBaseline(municipality.slug),
        ),
        potential,
        coverage: computeGoalCoverage(
          municipality.expectedVotes,
          suggestedGoalByScenario,
          pledgeAggregate,
          DEFAULT_VOTE_ESTIMATE_SCENARIO,
        ),
      },
    ]
  })

  const stopPeersByRegion = countStopPeersByRegion(partials)

  const groups = new Map<BahiaIdentityTerritory, VisitCandidateViewModel[]>()
  for (const partial of partials) {
    const { municipality, pledgeAggregate, leadershipCount, coverage } = partial
    const territorialClass = computeMunicipalityTerritorialClass(municipality.slug).class
    // A município never counts as its own tour peer.
    const territoryStopPeerCount =
      (stopPeersByRegion.get(partial.region) ?? 0) - (partial.hasStop ? 1 : 0)
    const advisorCount = uniqueRelationshipIds(municipality.advisors).length

    const candidate: VisitCandidateViewModel = {
      id: municipality.id,
      slug: municipality.slug,
      name: municipality.name,
      region: partial.region,
      priority: municipality.priority ?? null,
      eligibility: evaluateVisitEligibility({
        projectedValidVotes: partial.potential.projectedValidVotes,
        projectedValidVotesCut: catalogMedianProjectedValidVotes(),
        coverageDeficit: coverage.deficit,
        uncapturedFieldVotes: partial.uncapturedFieldVotes,
        uncapturedFieldVotesCut: catalogMedianUncapturedFieldVotes(),
        advisorCount,
        leadershipCount,
        pledgeCount: pledgeAggregate.pledgeCount,
        linkedStateDeputyCount: uniqueRelationshipIds(municipality.stateDeputies).length,
        politicalTrend: municipality.politicalTrend?.status ?? null,
        territorialClass,
        territoryStopPeerCount,
      }),
      coverage,
      territorialClass,
      leadershipCount,
      pledgeCount: pledgeAggregate.pledgeCount,
      advisorCount,
    }

    const bucket = groups.get(partial.region)
    if (bucket) bucket.push(candidate)
    else groups.set(partial.region, [candidate])
  }

  const groupViews: VisitCandidateGroupViewModel[] = [...groups.entries()]
    .map(([groupRegion, candidates]) => ({
      region: groupRegion,
      candidates: candidates.sort(compareVisitCandidates),
    }))
    .sort((left, right) => left.region.localeCompare(right.region, 'pt-BR'))

  return { phase: resolveCalendarPhase(now), groups: groupViews }
}

/**
 * One município's eligibility for the detail-page card. It runs the SAME loader
 * scoped to the município's territory rather than a second evaluator, because
 * the "encaixe em giro" condition is a statement about the neighbours — asking
 * it for one município in isolation is not possible, and asking it twice is how
 * a detail page and a list start disagreeing.
 */
export const loadMunicipalityVisitEligibility = async (
  payload: Payload,
  user: CampaignUser,
  slug: string,
  now: Date = new Date(),
): Promise<{ candidate: VisitCandidateViewModel | null; phase: CalendarPhase }> => {
  // Off-catalog slugs are never candidates, so bail before the read: without the
  // território there is nothing to scope the query to, and it would scan the state.
  const catalogEntry = getMunicipalityCatalogEntry(slug)
  if (!catalogEntry) return { candidate: null, phase: resolveCalendarPhase(now) }

  const { phase, groups } = await loadVisitCandidates(payload, user, {
    region: catalogEntry.region,
    now,
  })
  const candidate = groups.flatMap((group) => group.candidates).find((entry) => entry.slug === slug)

  return { candidate: candidate ?? null, phase }
}
