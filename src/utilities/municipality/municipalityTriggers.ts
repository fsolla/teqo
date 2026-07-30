import 'server-only'

import type { Payload, Where } from 'payload'

import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { ELECTION_YEAR_2014, ELECTION_YEAR_2018, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import {
  evaluateMunicipalityTriggers,
  isSuggestionSuppressedByDecision,
  shouldEnterSilenceReview,
  SUGGESTION_INPUT_WINDOWS,
  suggestionPatternIds,
  type MunicipalityTriggerInput,
  type SuggestionPatternId,
  type SuggestionTriageLevel,
} from '@/lib/suggestionCatalog'
import { DAY_MS } from '@/lib/text'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import type { AllocationDecision, CampaignUser, Municipality } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { computeGoalCoverage } from '@/utilities/municipality/goalCoverage'
import { loadStatewideSuggestedGoals } from '@/utilities/municipality/municipalityGoalAccount'
import {
  catalogMedianProjectedValidVotes,
  catalogMedianUncapturedFieldVotes,
  computeAllMunicipalityPotentials,
  uncapturedFieldVotes,
} from '@/utilities/municipality/municipalityPotential'
import {
  municipalitySignalAgeInDays,
  resolveMunicipalityLastSignalAt,
} from '@/utilities/municipality/municipalitySignal'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { countLeadershipsByMunicipality } from '@/utilities/visit/visitPlannerData'
import { emptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

/**
 * E11 loader — evaluates the suggestion catalog over the actor's municípios
 * and filters what a recorded decision still suppresses. A stateless read on
 * every load (the plan's locked decision): the only thing persisted is the
 * DECISION (`allocationDecision`, C12), never the suggestion.
 *
 * It reads `municipality` itself instead of `loadMunicipalityScope` for the
 * same reason `visitPlannerData.ts` documents: the shared select carries
 * neither `engagementLevel` nor `lastUpdateAt`, and widening it would charge
 * the dashboard, the map and the list for fields only the evaluator reads.
 */
type TriggerMunicipalityDoc = Pick<
  Municipality,
  | 'id'
  | 'name'
  | 'slug'
  | 'advisors'
  | 'priority'
  | 'expectedVotes'
  | 'engagementLevel'
  | 'lastUpdateAt'
>

/** The numbers the decision snapshot records — what the decision was made ON. */
type SuggestionMetrics = {
  lq2022: number | null
  coverageRatio: number | null
  coverageDeficit: number
  projectedValidVotes: number
  pledgeCount: number
  leadershipCount: number
  advisorCount: number
  lastSignalAgeDays: number | null
  lastPledgeAgeDays: number | null
}

type MunicipalitySuggestionViewModel = {
  municipalityID: number
  municipalityName: string
  municipalitySlug: string
  patternId: SuggestionPatternId
  triageLevel: SuggestionTriageLevel
  factors: string[]
  metrics: SuggestionMetrics
}

export type MunicipalitySilenceEntry = {
  municipalityID: number
  municipalityName: string
  municipalitySlug: string
  /** null = nothing was ever recorded here. */
  lastSignalAgeDays: number | null
}

export type MunicipalitySuggestionsBundle = {
  /** Triage order (level 1 first), ties broken by coverage deficit then size. */
  suggestions: MunicipalitySuggestionViewModel[]
  /** "Pauta do silêncio" — prioritized municípios where nothing fired and nothing was recorded. */
  silence: MunicipalitySilenceEntry[]
  evaluatedCount: number
}

/** P1's threat leg: signal types that read as an adversary move. */
const ADVERSARY_SIGNAL_TYPES: MunicipalitySignalType[] = [
  'invasao',
  'visita_adversario',
  'proposta_broker',
]

/** Agenda legs: drafts are intentions and cancellations never happened. */
const AGENDA_ACTIVITY_STATUSES = ['planejado', 'confirmado', 'realizado'] as const

const isoDaysAgo = (now: Date, days: number): string =>
  new Date(now.getTime() - days * DAY_MS).toISOString()

/**
 * Upper-quartile cut of projected valid votes over the catalog (P6's "válidos
 * no quartil superior"), memoized once per process like the medians it sits
 * next to — the artifact is immutable.
 */
let projectedValidVotesUpperCutMemo: number | null = null
const projectedValidVotesUpperCut = (): number => {
  if (projectedValidVotesUpperCutMemo !== null) return projectedValidVotesUpperCutMemo
  const values = Array.from(computeAllMunicipalityPotentials().values())
    .map((potential) => potential.projectedValidVotes)
    .filter((value) => value > 0)
    .sort((left, right) => left - right)
  const index = Math.min(Math.floor(values.length * 0.75), Math.max(values.length - 1, 0))
  projectedValidVotesUpperCutMemo = values[index] ?? 0
  return projectedValidVotesUpperCutMemo
}

/**
 * The candidate's own statewide intra-field share, 2022 — P3's relative
 * standard (own votes ÷ campo federal votes, both statewide).
 */
let intraFieldStandardMemo: number | null | undefined
const intraFieldShareStateStandard2022 = (): number | null => {
  if (intraFieldStandardMemo !== undefined) return intraFieldStandardMemo
  let campoVotes = 0
  for (const slug of federalBaselineMunicipalitySlugs()) {
    campoVotes +=
      getMunicipalityFederalBaseline(slug).campoFederalVotesByYear[String(ELECTION_YEAR_2022)] ?? 0
  }
  const { ownVotes } = getStatewideFederalTotals(ELECTION_YEAR_2022)
  intraFieldStandardMemo = campoVotes > 0 ? ownVotes / campoVotes : null
  return intraFieldStandardMemo
}

/** Location quotient for one year — the SAME formula as E10's classifier. */
const lqForYear = (baseline: MunicipalityFederalBaseline, year: number): number | null => {
  const own = baseline.votesByYear[String(year)] ?? 0
  const valid = baseline.validVotesByYear[String(year)] ?? 0
  const totals = getStatewideFederalTotals(year)
  if (valid <= 0 || totals.validVotes <= 0 || totals.ownVotes <= 0) return null
  return own / valid / (totals.ownVotes / totals.validVotes)
}

/** Campo federal votes ÷ valid votes, 2022 — P3's "captura agregada do campo". */
const fieldShareOfValid2022 = (baseline: MunicipalityFederalBaseline): number | null => {
  const valid = baseline.validVotesByYear[String(ELECTION_YEAR_2022)] ?? 0
  const campo = baseline.campoFederalVotesByYear[String(ELECTION_YEAR_2022)] ?? 0
  return valid > 0 ? campo / valid : null
}

type LatestDecision = Pick<AllocationDecision, 'outcome' | 'snapshot' | 'createdAt'>

const compareSuggestions = (
  left: MunicipalitySuggestionViewModel,
  right: MunicipalitySuggestionViewModel,
): number => {
  if (left.triageLevel !== right.triageLevel) return left.triageLevel - right.triageLevel
  // §6.2 tie-break: more votes at stake for the meta wins.
  if (left.metrics.coverageDeficit !== right.metrics.coverageDeficit) {
    return right.metrics.coverageDeficit - left.metrics.coverageDeficit
  }
  if (left.metrics.projectedValidVotes !== right.metrics.projectedValidVotes) {
    return right.metrics.projectedValidVotes - left.metrics.projectedValidVotes
  }
  return left.municipalityName.localeCompare(right.municipalityName, 'pt-BR')
}

export type MunicipalitySuggestionsFilter = {
  /** Restrict to one município (detail card, and the action's server recompute). */
  municipalityID?: number
  /** Injected so suppression windows and ages are testable. */
  now?: Date
}

export const loadMunicipalitySuggestions = async (
  payload: Payload,
  user: CampaignUser,
  { municipalityID, now = new Date() }: MunicipalitySuggestionsFilter = {},
): Promise<MunicipalitySuggestionsBundle> => {
  const where: Where = municipalityID ? { id: { equals: municipalityID } } : {}

  // One scope read for the municípios AND the pledge aggregates: the shared
  // scope select widened with the two fields the triggers need (P3-E
  // `extraSelect`). On the unfiltered path the dashboard already paid for the
  // scope (React cache) — a second município read or pledge scan on the same
  // request would be pure waste.
  const scope = await loadMunicipalityScope(payload, user, where, {
    extraSelect: { engagementLevel: true, lastUpdateAt: true },
  })
  const municipalities = scope.municipalities as TriggerMunicipalityDoc[]
  const municipalityIDs = municipalities.map((municipality) => municipality.id)
  if (municipalityIDs.length === 0) {
    return { suggestions: [], silence: [], evaluatedCount: 0 }
  }

  const [
    leadershipCounts,
    { suggestedGoalBySlug, potentialBySlug },
    signals,
    activities,
    decisions,
  ] = await Promise.all([
    countLeadershipsByMunicipality(payload, municipalityIDs),
    loadStatewideSuggestedGoals(payload, user),
    payload.find({
      collection: 'municipalityUpdate',
      where: {
        and: [
          { municipality: { in: municipalityIDs } },
          { kind: { equals: 'sinal' } },
          { signalType: { in: ADVERSARY_SIGNAL_TYPES } },
          {
            createdAt: {
              greater_than: isoDaysAgo(now, SUGGESTION_INPUT_WINDOWS.adversarySignalDays),
            },
          },
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { municipality: true, triangulated: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'activity',
      where: {
        and: [
          { municipality: { in: municipalityIDs } },
          { startAt: { greater_than: isoDaysAgo(now, SUGGESTION_INPUT_WINDOWS.activityDays) } },
          { status: { in: [...AGENDA_ACTIVITY_STATUSES] } },
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { municipality: true, status: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'allocationDecision',
      where: {
        and: [
          { municipality: { in: municipalityIDs } },
          { patternId: { in: [...suggestionPatternIds] } },
          { createdAt: { greater_than: isoDaysAgo(now, SUGGESTION_INPUT_WINDOWS.decisionDays) } },
        ],
      },
      sort: '-createdAt',
      depth: 0,
      limit: 0,
      pagination: false,
      select: {
        municipality: true,
        patternId: true,
        outcome: true,
        snapshot: true,
        createdAt: true,
      },
      user,
      overrideAccess: false,
    }),
  ])

  // Most severe adversary signal per município: triangulated wins.
  const adversarySignalByMunicipality = new Map<number, { triangulated: boolean }>()
  for (const signal of signals.docs) {
    const id = relationshipId(signal.municipality)
    if (id === null) continue
    const current = adversarySignalByMunicipality.get(id)
    if (current?.triangulated) continue
    adversarySignalByMunicipality.set(id, { triangulated: Boolean(signal.triangulated) })
  }

  const agendaByMunicipality = new Map<number, { hasAgenda: boolean; completedCount: number }>()
  for (const activity of activities.docs) {
    const id = relationshipId(activity.municipality)
    if (id === null) continue
    const entry = agendaByMunicipality.get(id) ?? { hasAgenda: false, completedCount: 0 }
    entry.hasAgenda = true
    if (activity.status === 'realizado') entry.completedCount += 1
    agendaByMunicipality.set(id, entry)
  }

  // Newest decision per (município, pattern): the find is sorted descending.
  const latestDecisionByKey = new Map<string, LatestDecision>()
  for (const decision of decisions.docs) {
    const id = relationshipId(decision.municipality)
    if (id === null) continue
    const key = `${id}:${decision.patternId}`
    if (!latestDecisionByKey.has(key)) latestDecisionByKey.set(key, decision)
  }

  const suggestions: MunicipalitySuggestionViewModel[] = []
  const silenceEntries: MunicipalitySilenceEntry[] = []

  for (const municipality of municipalities) {
    const catalogEntry = getMunicipalityCatalogEntry(municipality.slug)
    const suggestedGoalByScenario = suggestedGoalBySlug.get(municipality.slug)
    const potential = potentialBySlug.get(municipality.slug)
    // Off-catalog rows are leftover data with no derived potential to reason about.
    if (!catalogEntry || !suggestedGoalByScenario || !potential) continue

    const baseline = getMunicipalityFederalBaseline(municipality.slug)
    const classification = computeMunicipalityTerritorialClass(municipality.slug)
    const pledgeAggregate =
      scope.pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    const coverage = computeGoalCoverage(
      municipality.expectedVotes,
      suggestedGoalByScenario,
      pledgeAggregate,
      DEFAULT_VOTE_ESTIMATE_SCENARIO,
    )
    const lastSignalAt = resolveMunicipalityLastSignalAt(
      municipality.lastUpdateAt ?? null,
      pledgeAggregate.lastPledgeAt,
    )
    const agenda = agendaByMunicipality.get(municipality.id)

    const input: MunicipalityTriggerInput = {
      priority: municipality.priority ?? null,
      engagementLevel: municipality.engagementLevel ?? null,
      territorialClass: classification.class,
      inCoreBlock: classification.inCoreBlock,
      lqByYear: {
        [ELECTION_YEAR_2014]: lqForYear(baseline, ELECTION_YEAR_2014),
        [ELECTION_YEAR_2018]: lqForYear(baseline, ELECTION_YEAR_2018),
        // 2022 already exists on the memoized classification — same formula,
        // and reusing it keeps a second writing from ever drifting.
        [ELECTION_YEAR_2022]: classification.lq,
      },
      ownVotesByYear: {
        [ELECTION_YEAR_2014]: baseline.votesByYear[String(ELECTION_YEAR_2014)] ?? 0,
        [ELECTION_YEAR_2018]: baseline.votesByYear[String(ELECTION_YEAR_2018)] ?? 0,
        [ELECTION_YEAR_2022]: baseline.votesByYear[String(ELECTION_YEAR_2022)] ?? 0,
      },
      projectedValidVotes: potential.projectedValidVotes,
      projectedValidVotesCut: catalogMedianProjectedValidVotes(),
      projectedValidVotesUpperCut: projectedValidVotesUpperCut(),
      uncapturedFieldVotes: uncapturedFieldVotes(baseline),
      uncapturedFieldVotesCut: catalogMedianUncapturedFieldVotes(),
      captureRate2022: potential.captureRate2022,
      fieldShareOfValid2022: fieldShareOfValid2022(baseline),
      intraFieldShare2022: potential.intraFieldShareByYear[ELECTION_YEAR_2022] ?? null,
      intraFieldShareStateStandard2022: intraFieldShareStateStandard2022(),
      advisorCount: uniqueRelationshipIds(municipality.advisors).length,
      leadershipCount: leadershipCounts.get(municipality.id) ?? 0,
      pledgeCount: pledgeAggregate.pledgeCount,
      lastSignalAgeDays: municipalitySignalAgeInDays(lastSignalAt, now),
      lastPledgeAgeDays: municipalitySignalAgeInDays(pledgeAggregate.lastPledgeAt, now),
      coverageRatio: coverage.coverageRatio,
      coverageDeficit: coverage.deficit,
      adversarySignal: adversarySignalByMunicipality.get(municipality.id) ?? null,
      hasRecentOrUpcomingActivity: agenda?.hasAgenda ?? false,
      completedActivityCount: agenda?.completedCount ?? 0,
    }

    const triggered = evaluateMunicipalityTriggers(input)

    // Silence looks at what FIRED, not at what a decision still suppresses:
    // a dismissed pattern was seen and answered — that is not silence.
    if (shouldEnterSilenceReview(input, triggered.length)) {
      silenceEntries.push({
        municipalityID: municipality.id,
        municipalityName: municipality.name,
        municipalitySlug: municipality.slug,
        lastSignalAgeDays: input.lastSignalAgeDays,
      })
    }

    // Every field comes from `input` — the snapshot's contract is "the numbers
    // the decision was made ON", which is exactly what the predicates saw.
    const metrics: SuggestionMetrics = {
      lq2022: input.lqByYear[ELECTION_YEAR_2022],
      coverageRatio: input.coverageRatio,
      coverageDeficit: input.coverageDeficit,
      projectedValidVotes: input.projectedValidVotes,
      pledgeCount: input.pledgeCount,
      leadershipCount: input.leadershipCount,
      advisorCount: input.advisorCount,
      lastSignalAgeDays: input.lastSignalAgeDays,
      lastPledgeAgeDays: input.lastPledgeAgeDays,
    }

    for (const pattern of triggered) {
      const decision = latestDecisionByKey.get(`${municipality.id}:${pattern.patternId}`)
      if (decision && isSuggestionSuppressedByDecision(decision, pattern, now)) continue
      suggestions.push({
        municipalityID: municipality.id,
        municipalityName: municipality.name,
        municipalitySlug: municipality.slug,
        patternId: pattern.patternId,
        triageLevel: pattern.triageLevel,
        factors: pattern.factors,
        metrics,
      })
    }
  }

  suggestions.sort(compareSuggestions)
  silenceEntries.sort((left, right) => {
    // Never-recorded first (the loudest silence), then oldest signal first.
    const leftAge = left.lastSignalAgeDays ?? Number.POSITIVE_INFINITY
    const rightAge = right.lastSignalAgeDays ?? Number.POSITIVE_INFINITY
    if (leftAge !== rightAge) return rightAge - leftAge
    return left.municipalityName.localeCompare(right.municipalityName, 'pt-BR')
  })

  return {
    suggestions,
    silence: silenceEntries,
    evaluatedCount: municipalities.length,
  }
}
