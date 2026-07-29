'use client'

import { CircleAlertIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useMunicipalityEstimateScenario } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignMetricStrip } from '@/components/campaign/shared/CampaignMetricStrip'
import { campaignPrioritySurfaceClassName } from '@/components/campaign/shell/CampaignPageShell'
import {
  VOTE_ESTIMATE_SCENARIO_OVERVIEW_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/votePledge/VoteEstimateScenarioField'
import { VoteEstimateScenarioStrip } from '@/components/campaign/votePledge/VoteEstimateScenarioStrip'
import { formatElectionNumber } from '@/lib/electionFormat'
import { cn } from '@/lib/utils'
import {
  formatVoteEstimateEndpointsLabel,
  hasAnyVoteEstimate,
  voteEstimateScenarioLabels,
} from '@/lib/voteEstimate'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/municipality/goalCoverage'
import type { MunicipalityListOverviewData } from '@/utilities/municipality/municipalityPageData'

const SCENARIO_FLASH_MS = 420

/**
 * E9 "coluna da vergonha": the assessoria ratio hides the only gap the
 * coordination can close today, so the priority municipalities with nobody
 * answering for them are named as their own number — and the number is the
 * link that filters the list down to exactly those rows (`shameHref` is
 * `null` when that filter is already applied, so the count doesn't pretend to
 * navigate somewhere new).
 */
const AssessoriaGapDetail = ({
  priorityWithoutAdvisorCount,
  shameHref,
}: {
  priorityWithoutAdvisorCount: number
  shameHref: string | null
}) => {
  if (priorityWithoutAdvisorCount === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma prioritária sem responsável</p>
  }

  const label = `${formatElectionNumber(priorityWithoutAdvisorCount)} ${
    priorityWithoutAdvisorCount === 1 ? 'prioritária' : 'prioritárias'
  } sem responsável`

  if (!shameHref) {
    return <p className="text-xs font-medium text-destructive tabular-nums">{label}</p>
  }

  return (
    <CampaignTransitionAnchor
      href={shameHref}
      scroll={false}
      className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-destructive tabular-nums underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </CampaignTransitionAnchor>
  )
}

export const MunicipalityListOverview = ({
  view,
  shameHref,
}: {
  view: MunicipalityListOverviewData
  shameHref: string | null
}) => {
  const { scenario, setScenario } = useMunicipalityEstimateScenario()
  const [isFlashing, setIsFlashing] = useState(false)
  const skipFlashRef = useRef(true)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (skipFlashRef.current) {
      skipFlashRef.current = false
      return
    }
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return
    setIsFlashing(true)
    clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), SCENARIO_FLASH_MS)
    return () => clearTimeout(flashTimeoutRef.current)
  }, [scenario])

  const scenarioTotals = view.staffVoteTotalByScenario
  const activeTotal = scenarioTotals[scenario]
  const endpointsLabel = formatVoteEstimateEndpointsLabel(scenarioTotals)
  const scenarioLabel = voteEstimateScenarioLabels[scenario]
  const hasScenarioTotals = hasAnyVoteEstimate(scenarioTotals)
  const goalCoverage = view.goalCoverageByScenario[scenario]

  const heroDetail = (
    <div className="flex flex-col gap-1.5">
      {hasScenarioTotals ? (
        <VoteEstimateScenarioStrip
          values={scenarioTotals}
          activeScenario={scenario}
          labelMode="endpoints"
          markerMode="active-only"
          stretch
          className="max-w-none"
        />
      ) : null}
      {endpointsLabel ? (
        <p className="text-xs text-muted-foreground tabular-nums">{endpointsLabel}</p>
      ) : null}
      {view.missingEstimateCount > 0 ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatElectionNumber(view.missingEstimateCount)}{' '}
          {view.missingEstimateCount === 1 ? 'declaração' : 'declarações'} sem estimativa
        </p>
      ) : null}
    </div>
  )

  return (
    <section
      aria-label="Visão geral dos municípios filtrados"
      aria-live="polite"
      className={cn(
        'rounded-xl transition-[box-shadow,background-color] duration-300',
        campaignPrioritySurfaceClassName,
        isFlashing ? 'ring-2 ring-primary/35' : undefined,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-foreground/10 px-4 py-2 sm:flex-row sm:items-end sm:justify-between">
        <VoteEstimateScenarioField
          id="municipality-overview-estimate-scenario"
          value={scenario}
          onChange={setScenario}
          hint={VOTE_ESTIMATE_SCENARIO_OVERVIEW_HINT}
        />
      </div>
      <CampaignMetricStrip
        className="rounded-none ring-0"
        metrics={[
          {
            label: `${scenarioLabel} nos municípios filtrados`,
            value: formatElectionNumber(activeTotal),
            detail: heroDetail,
            emphasize: true,
            valueAriaLabel: `${scenarioLabel} nos municípios filtrados: ${formatElectionNumber(activeTotal)}${
              endpointsLabel ? `; ${endpointsLabel}` : ''
            }${
              view.missingEstimateCount > 0
                ? `; ${formatElectionNumber(view.missingEstimateCount)} sem estimativa`
                : ''
            }`,
          },
          {
            label: 'Declarações de votos',
            value: view.pledgeCount ? formatElectionNumber(view.pledgeCount) : 'Nenhuma',
          },
          {
            label: 'Cobertura de assessoria',
            value: `${view.withAdvisorCount} de ${view.municipalityCount} municípios`,
            detail: (
              <AssessoriaGapDetail
                priorityWithoutAdvisorCount={view.priorityWithoutAdvisorCount}
                shameHref={shameHref}
              />
            ),
            progress:
              view.municipalityCount > 0
                ? Math.round((view.withAdvisorCount / view.municipalityCount) * 100)
                : undefined,
          },
          {
            label: 'Cobertura da meta',
            value: formatGoalCoverageRatioLabel(goalCoverage),
            detail: formatGoalCoverageDeficitLabel(goalCoverage),
            progress: goalCoverageProgressPercent(goalCoverage),
          },
        ]}
      />
    </section>
  )
}
