'use client'

import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { MunicipalitySliceTotals } from '@/lib/municipalitySliceTotals'
import { cn } from '@/lib/utils'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  formatVoteEstimateScenarioAriaLabel,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'

/** Compact labels of the approved draft; the full label rides in `title` and the sr-only summary. */
const scenarioShortLabels: Record<VoteEstimateScenario, string> = {
  pessimistic: 'Pess.',
  central: 'Média',
  optimistic: 'Otim.',
}

const formatScenarioValue = (value: number | null): string =>
  value == null ? '—' : formatElectionNumber(value)

/**
 * B202 — the compact totals line of the municipality list footer: Solla 2022
 * votes + the three 2026 expectation scenarios summed over the WHOLE filtered
 * slice, plus how many rows carry at least one estimate. Only the active
 * scenario (the same client state the votes column reads) is emphasized; a
 * scenario nobody filled renders "—", never a fake zero. The numbers arrive
 * pre-summed from the server — this leaf owns only the emphasis.
 */
export const MunicipalitySliceTotalsLine = ({ totals }: { totals: MunicipalitySliceTotals }) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const activeScenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const { expectedByScenario, rowCount, votes2022, withEstimateCount } = totals

  const coverageSummary =
    withEstimateCount > 0 ? `; ${withEstimateCount} de ${rowCount} com expectativa` : ''
  const screenReaderSummary = `Total do recorte: 2022 ${formatElectionNumber(votes2022)}; ${formatVoteEstimateScenarioAriaLabel(expectedByScenario)}${coverageSummary}`

  return (
    <p
      data-slot="municipality-slice-totals"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground tabular-nums"
    >
      <span>Total do recorte:</span>
      <span>
        2022{' '}
        <span className="font-semibold text-foreground">{formatElectionNumber(votes2022)}</span>
      </span>
      {VOTE_ESTIMATE_SCENARIOS.map((scenario) => (
        <span key={scenario} className="inline-flex items-center gap-2">
          <span aria-hidden="true">·</span>
          <span title={voteEstimateScenarioLabels[scenario]}>
            {scenarioShortLabels[scenario]}{' '}
            <span className={cn('text-foreground', scenario === activeScenario && 'font-semibold')}>
              {formatScenarioValue(expectedByScenario[scenario])}
            </span>
          </span>
        </span>
      ))}
      {withEstimateCount > 0 ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">·</span>
          <span>
            {withEstimateCount} de {rowCount} com expectativa
          </span>
        </span>
      ) : null}
      <span className="sr-only">{screenReaderSummary}</span>
    </p>
  )
}
