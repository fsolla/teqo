'use client'

import { useEffect, useRef, useState } from 'react'

import { CampaignMetricStrip } from '@/components/campaign/CampaignMetricStrip'
import { campaignPrioritySurfaceClassName } from '@/components/campaign/CampaignPageShell'
import { useMunicipalityEstimateScenario } from '@/components/campaign/MunicipalityEstimateScenarioContext'
import {
  VOTE_ESTIMATE_SCENARIO_OVERVIEW_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/VoteEstimateScenarioField'
import { VoteEstimateScenarioStrip } from '@/components/campaign/VoteEstimateScenarioStrip'
import { formatElectionNumber } from '@/lib/electionInsights'
import { cn } from '@/lib/utils'
import type { MunicipalityListOverviewData } from '@/utilities/municipalityPageData'
import {
  formatVoteEstimateEndpointsLabel,
  hasAnyVoteEstimate,
  voteEstimateScenarioLabels,
} from '@/utilities/voteEstimate'

const SCENARIO_FLASH_MS = 420

export const MunicipalityListOverview = ({ view }: { view: MunicipalityListOverviewData }) => {
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
      aria-label="Visão geral das Praças filtradas"
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
            label: `${scenarioLabel} nas Praças filtradas`,
            value: formatElectionNumber(activeTotal),
            detail: heroDetail,
            emphasize: true,
            valueAriaLabel: `${scenarioLabel} nas Praças filtradas: ${formatElectionNumber(activeTotal)}${
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
            value: `${view.withAdvisorCount} de ${view.municipalityCount} Praças`,
            progress:
              view.municipalityCount > 0
                ? Math.round((view.withAdvisorCount / view.municipalityCount) * 100)
                : undefined,
          },
        ]}
      />
    </section>
  )
}
