import { CandidateComparePicker } from '@/components/campaign/map/CandidateComparePicker'
import { MunicipalityBaselineCard } from '@/components/campaign/municipality/MunicipalityBaselineCard'
import { MunicipalityCandidateComparisonTable } from '@/components/campaign/municipality/MunicipalityCandidateComparisonTable'
import { MunicipalityDossier } from '@/components/campaign/municipality/MunicipalityDossier'
import { MunicipalityGoalAccountCard } from '@/components/campaign/municipality/MunicipalityGoalAccountCard'
import { MunicipalityLeadershipsPanel } from '@/components/campaign/municipality/MunicipalityLeadershipsPanel'
import { MunicipalityPledgesPanel } from '@/components/campaign/municipality/MunicipalityPledgesPanel'
import { MunicipalityStrategyCard } from '@/components/campaign/municipality/MunicipalityStrategyCard'
import { MunicipalityTicketPartnersCard } from '@/components/campaign/municipality/MunicipalityTicketPartnersCard'
import { MunicipalityUpdateFeed } from '@/components/campaign/municipality/MunicipalityUpdateFeed'
import { MunicipalityUpdateForm } from '@/components/campaign/municipality/MunicipalityUpdateForm'
import { MunicipalityVisitEligibilityCard } from '@/components/campaign/municipality/MunicipalityVisitEligibilityCard'
import { MunicipalityZoneNeighborhoodsCard } from '@/components/campaign/municipality/MunicipalityZoneNeighborhoodsCard'
import { CampaignListPagination } from '@/components/campaign/shared/CampaignListPagination'
import { SuggestionsPanel } from '@/components/campaign/suggestion/SuggestionsPanel'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { getCampaignUser } from '@/utilities/campaignAuth'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadMunicipalityLeaderships } from '@/utilities/leadership/leadershipData'
import {
  loadMunicipalityCandidateComparison,
  MAX_COMPARISON_CANDIDATES,
} from '@/utilities/municipality/municipalityCandidateComparison'
import type { MunicipalityDetailSearchParams } from '@/utilities/municipality/municipalityDetailTabUi'
import { loadMunicipalityDossierData } from '@/utilities/municipality/municipalityDossierData'
import {
  municipalityElectionGeographyForSlug,
  type MunicipalityElectionGeography,
} from '@/utilities/municipality/municipalityElectionGeography'
import { loadMunicipalityElectoralBaseline } from '@/utilities/municipality/municipalityElectoralBaseline'
import { loadMunicipalityGoalAccount } from '@/utilities/municipality/municipalityGoalAccount'
import type { getMunicipalityDetailViewModel } from '@/utilities/municipality/municipalityPageData'
import { formatMunicipalitySuggestionEmptyMessage } from '@/utilities/municipality/municipalitySignal'
import { loadMunicipalityTicketPartners } from '@/utilities/municipality/municipalityTicketPartnerData'
import { loadMunicipalitySuggestions } from '@/utilities/municipality/municipalityTriggers'
import {
  loadMunicipalityUpdatesFeed,
  parseMunicipalityUpdateFeedParams,
} from '@/utilities/municipality/municipalityUpdatePageData'
import type { loadAdvisorSummaries } from '@/utilities/municipality/municipalityViewModels'
import { loadMunicipalityVisitEligibility } from '@/utilities/visit/visitPlannerData'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'
import {
  aggregateMunicipalityPledgesFromRows,
  toMunicipalityPledgeCoverageView,
  type MunicipalityPledgeAggregate,
  type MunicipalityPledgeCoverageView,
} from '@/utilities/votePledgeViews'

import type { getPayload } from 'payload'
import { Suspense } from 'react'

import { resolveSuggestionFormAction } from '../../suggestionFormActions'
import { declareVotesFormAction, estimateVotesFormAction } from './pledgeFormActions'
import { createMunicipalityUpdateFormAction } from './updateFormActions'

type PayloadUser = {
  payload: Awaited<ReturnType<typeof getPayload>>
  user: NonNullable<Awaited<ReturnType<typeof getCampaignUser>>>
}

type MunicipalityDetailView = Awaited<ReturnType<typeof getMunicipalityDetailViewModel>>

export const MunicipalityTabFallback = () => (
  <div aria-hidden="true" className="flex flex-col gap-4">
    <div className="h-40 w-full animate-pulse rounded-xl border bg-muted/40" />
    <div className="h-64 w-full animate-pulse rounded-xl border bg-muted/40" />
  </div>
)

export const OverviewTab = async ({
  view,
  payloadUser: { payload, user },
}: {
  view: MunicipalityDetailView
  payloadUser: PayloadUser
}) => {
  const zoneNeighborhoodsCard =
    view.kind === 'zona' ? <MunicipalityZoneNeighborhoodsCard municipalitySlug={view.slug} /> : null

  const pledges = await loadMunicipalityPledges(payload, user, view.id)
  const pledgeAggregate = aggregateMunicipalityPledgesFromRows(pledges)
  const pledgeCoverage = toMunicipalityPledgeCoverageView(pledgeAggregate)

  return (
    <div className="flex flex-col gap-6">
      {zoneNeighborhoodsCard}
      {view.strategy ? (
        <>
          <MunicipalityStrategyCard strategy={view.strategy} municipalitySlug={view.slug} canEdit />
          <GoalAccountCard
            payloadUser={{ payload, user }}
            municipalityID={view.id}
            slug={view.slug}
            expectedVotes={view.strategy.expectedVotes}
            pledgeCoverage={pledgeCoverage}
            pledgeAggregate={pledgeAggregate}
          />
          {/* Two round trips deep (território scope, then its aggregates), against
              one for the goal account — so it streams instead of holding the tab. */}
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-64 animate-pulse rounded-xl border bg-muted/40"
              />
            }
          >
            <VisitEligibilityCard payloadUser={{ payload, user }} slug={view.slug} />
          </Suspense>
          {/* E11 — the evaluator adds its own reads (signals, agenda, decisions),
              so it streams like the eligibility card above. */}
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-40 animate-pulse rounded-xl border bg-muted/40"
              />
            }
          >
            <SuggestionsCard payloadUser={{ payload, user }} municipalityID={view.id} />
          </Suspense>
        </>
      ) : null}
      <MunicipalityPledgesPanel pledges={pledges} estimateFormAction={estimateVotesFormAction} />
    </div>
  )
}

/**
 * E11 — the município's own triggered patterns, full list (the dashboard shows
 * the statewide top-5). A silent prioritized município says so instead of
 * showing a bare "nothing here": silence is the question (§6.4).
 */
const SuggestionsCard = async ({
  payloadUser: { payload, user },
  municipalityID,
}: {
  payloadUser: PayloadUser
  municipalityID: number
}) => {
  const bundle = await loadMunicipalitySuggestions(payload, user, { municipalityID })
  const silence = bundle.silence.find((entry) => entry.municipalityID === municipalityID)

  return (
    <SuggestionsPanel
      titleId="municipality-suggestions-title"
      suggestions={bundle.suggestions}
      activeCount={bundle.suggestions.length}
      resolveAction={resolveSuggestionFormAction}
      emptyState={
        <p className="text-sm text-muted-foreground">
          {formatMunicipalitySuggestionEmptyMessage(
            silence ? { lastSignalAgeDays: silence.lastSignalAgeDays } : null,
          )}
        </p>
      }
    />
  )
}

const GoalAccountCard = async ({
  payloadUser: { payload, user },
  municipalityID,
  slug,
  expectedVotes,
  pledgeCoverage,
  pledgeAggregate,
}: {
  payloadUser: PayloadUser
  municipalityID: number
  slug: string
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage: MunicipalityPledgeCoverageView | null
  pledgeAggregate: MunicipalityPledgeAggregate
}) => {
  const { suggestedGoal, goalCoverage, potential, territorialClass, territoryCaptureBenchmark } =
    await loadMunicipalityGoalAccount(payload, user, { slug, expectedVotes }, pledgeAggregate)

  return (
    <MunicipalityGoalAccountCard
      municipalityID={municipalityID}
      expectedVotes={expectedVotes}
      pledgeCoverage={pledgeCoverage}
      suggestedGoal={suggestedGoal}
      goalCoverage={goalCoverage}
      potential={potential}
      territorialClass={territorialClass}
      territoryCaptureBenchmark={territoryCaptureBenchmark}
    />
  )
}

/**
 * E13 — the checklist that authorizes a day of the candidate's agenda, right
 * after the goal account it reads its headroom from. The loader is scoped to
 * the município's own identity territory: "encaixe em giro" is a statement
 * about the neighbours, so it cannot be answered for one município alone.
 */
const VisitEligibilityCard = async ({
  payloadUser: { payload, user },
  slug,
}: {
  payloadUser: PayloadUser
  slug: string
}) => {
  const { candidate, phase } = await loadMunicipalityVisitEligibility(payload, user, slug)
  if (!candidate) return null

  return <MunicipalityVisitEligibilityCard candidate={candidate} phase={phase} />
}

export const DossierTab = async ({
  view,
  advisorSummaries,
  payloadUser: { payload, user },
}: {
  view: MunicipalityDetailView
  advisorSummaries: Awaited<ReturnType<typeof loadAdvisorSummaries>>
  payloadUser: PayloadUser
}) => {
  const data = await loadMunicipalityDossierData(payload, user, view)
  return <MunicipalityDossier view={view} advisors={advisorSummaries} data={data} />
}

export const ElectionsTab = async ({
  slug,
  rawSearchParams,
  payloadUser: { user },
}: {
  slug: string
  rawSearchParams: MunicipalityDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const geography = municipalityElectionGeographyForSlug(slug)
  const rawCompare = rawSearchParams.compare
  const compareNumbers = [
    ...new Set(
      (Array.isArray(rawCompare) ? rawCompare : rawCompare ? [rawCompare] : [])
        .filter((value) => /^[1-9]\d*$/.test(value))
        .map(Number),
    ),
  ].slice(0, MAX_COMPARISON_CANDIDATES)

  const [baseline, comparisonRows, candidateOptions] = await Promise.all([
    geography ? loadMunicipalityElectoralBaseline(user, geography) : null,
    geography
      ? loadMunicipalityCandidateComparison(user, geography, compareNumbers)
      : ([] as Awaited<ReturnType<typeof loadMunicipalityCandidateComparison>>),
    loadFederalCandidateOptions(user),
  ])

  return (
    <div className="flex flex-col gap-6">
      <MunicipalityBaselineCard baseline={baseline} municipalitySlug={slug} />
      <section
        aria-labelledby="municipality-comparison-title"
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="municipality-comparison-title" className="text-base font-medium">
            Comparativo entre candidatos
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare a votação de deputados federais neste município através dos anos (fonte TSE,
            votos nominais do 1º turno).
          </p>
        </div>
        <CandidateComparePicker
          options={candidateOptions}
          selectedNumbers={compareNumbers}
          maxSelected={MAX_COMPARISON_CANDIDATES}
        />
        {comparisonRows.length ? (
          <MunicipalityCandidateComparisonTable rows={comparisonRows} />
        ) : null}
      </section>
      {/* A6 — its own registry/votes reads, so it streams instead of holding
          the baseline card and the comparison table above. */}
      <Suspense
        fallback={
          <div aria-hidden="true" className="h-56 animate-pulse rounded-xl border bg-muted/40" />
        }
      >
        <TicketPartnersSection geography={geography} user={user} />
      </Suspense>
    </div>
  )
}

/**
 * A6 — dobradinha opportunities for 2026: who runs again, ranked by alignment
 * and local 2022 force. Lives on the Elections tab with the other TSE-derived
 * reads; until the post-15/08 reconcile the card reports the pending state.
 */
const TicketPartnersSection = async ({
  geography,
  user,
}: {
  geography: MunicipalityElectionGeography | null
  user: PayloadUser['user']
}) => {
  if (!geography) return null
  const result = await loadMunicipalityTicketPartners(user, geography)
  return <MunicipalityTicketPartnersCard result={result} />
}

export const LeadershipsTab = async ({
  municipalityID,
  payloadUser: { payload, user },
}: {
  municipalityID: number
  payloadUser: PayloadUser
}) => {
  const [leaderships, pledges] = await Promise.all([
    loadMunicipalityLeaderships(payload, user, municipalityID),
    loadMunicipalityPledges(payload, user, municipalityID),
  ])

  return (
    <MunicipalityLeadershipsPanel
      municipalityID={municipalityID}
      leaderships={leaderships}
      pledges={pledges}
      declareFormAction={declareVotesFormAction}
    />
  )
}

export const UpdatesTab = async ({
  municipalityID,
  municipalitySlug,
  rawSearchParams,
  payloadUser: { payload, user },
}: {
  municipalityID: number
  municipalitySlug: string
  rawSearchParams: MunicipalityDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const feedState = parseMunicipalityUpdateFeedParams(rawSearchParams)
  const feed = await loadMunicipalityUpdatesFeed(payload, user, municipalityID, feedState)
  const isStaff = isStaffCampaignRole(user.role)

  return (
    <div className="flex flex-col gap-6">
      <MunicipalityUpdateForm
        municipalityID={municipalityID}
        formAction={createMunicipalityUpdateFormAction}
        isStaff={isStaff}
      />
      <MunicipalityUpdateFeed updates={feed.updates} />
      <CampaignListPagination
        page={feed.page}
        totalPages={feed.totalPages}
        hrefForPage={(page) =>
          `/campanha/municipios/${municipalitySlug}?tab=updates&updatePage=${page}`
        }
      />
    </div>
  )
}
