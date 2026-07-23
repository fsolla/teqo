'use client'

import { useEffect, useRef, useState } from 'react'

import { VoteEstimateScenarioStrip } from '@/components/campaign/VoteEstimateScenarioStrip'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  voteEstimatesEqual,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

const scenarioFieldName = (
  fieldPrefix: 'estimatedVotes' | 'expectedVotes',
  scenario: VoteEstimateScenario,
): string => `${fieldPrefix}${scenario.charAt(0).toUpperCase()}${scenario.slice(1)}`

const parseScenarioInput = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

const toDraftText = (value: number | null | undefined): string =>
  value == null ? '' : String(value)

const draftsFromValues = (
  values: VoteEstimateScenarioViewModel,
): Record<VoteEstimateScenario, string> => ({
  pessimistic: toDraftText(values.pessimistic),
  central: toDraftText(values.central),
  optimistic: toDraftText(values.optimistic),
})

const valuesFromDrafts = (
  drafts: Record<VoteEstimateScenario, string>,
): VoteEstimateScenarioViewModel => ({
  pessimistic: parseScenarioInput(drafts.pessimistic),
  central: parseScenarioInput(drafts.central),
  optimistic: parseScenarioInput(drafts.optimistic),
})

const compactInputClassName =
  'h-9 min-h-9 rounded-md px-1.5 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

type VoteEstimateScenarioInputsProps = {
  fieldPrefix: 'estimatedVotes' | 'expectedVotes'
  values: VoteEstimateScenarioViewModel
  idPrefix: string
  variant?: 'labeled' | 'compact'
  autoFocusScenario?: VoteEstimateScenario
  onValuesChange?: (values: VoteEstimateScenarioViewModel) => void
}

const CompactVoteEstimateScenarioInputs = ({
  fieldPrefix,
  values,
  idPrefix,
  autoFocusScenario,
  onValuesChange,
}: Omit<VoteEstimateScenarioInputsProps, 'variant'> & {
  onValuesChange: (values: VoteEstimateScenarioViewModel) => void
}) => {
  const [drafts, setDrafts] = useState(() => draftsFromValues(values))
  const committedValuesRef = useRef(values)

  useEffect(() => {
    if (voteEstimatesEqual(values, committedValuesRef.current)) return
    committedValuesRef.current = values
    setDrafts(draftsFromValues(values))
  }, [values])

  const handleDraftChange = (scenario: VoteEstimateScenario, raw: string) => {
    const sanitized = raw.replace(/\D/g, '')
    const nextDrafts = { ...drafts, [scenario]: sanitized }
    setDrafts(nextDrafts)
    const nextValues = valuesFromDrafts(nextDrafts)
    committedValuesRef.current = nextValues
    onValuesChange(nextValues)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <VoteEstimateScenarioStrip
        values={values}
        labelMode="none"
        markerMode="active-only"
        stretch
      />
      <div className="grid grid-cols-3 gap-1.5">
        {VOTE_ESTIMATE_SCENARIOS.map((scenario) => (
          <Input
            key={scenario}
            id={`${idPrefix}-${scenario}`}
            name={scenarioFieldName(fieldPrefix, scenario)}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus={autoFocusScenario === scenario}
            value={drafts[scenario]}
            onChange={(event) => handleDraftChange(scenario, event.currentTarget.value)}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={voteEstimateScenarioLabels[scenario]}
            className={cn(
              compactInputClassName,
              scenario === 'central'
                ? 'border-primary/50 bg-primary/5 font-medium ring-1 ring-primary/15'
                : 'bg-muted/30',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export const VoteEstimateScenarioInputs = ({
  fieldPrefix,
  values,
  idPrefix,
  variant = 'labeled',
  autoFocusScenario,
  onValuesChange,
}: VoteEstimateScenarioInputsProps) => {
  if (variant === 'compact') {
    if (!onValuesChange) {
      throw new Error('VoteEstimateScenarioInputs compact variant requires onValuesChange.')
    }
    return (
      <CompactVoteEstimateScenarioInputs
        fieldPrefix={fieldPrefix}
        values={values}
        idPrefix={idPrefix}
        autoFocusScenario={autoFocusScenario}
        onValuesChange={onValuesChange}
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {VOTE_ESTIMATE_SCENARIOS.map((scenario) => (
        <Field key={scenario}>
          <FieldLabel htmlFor={`${idPrefix}-${scenario}`}>
            {voteEstimateScenarioLabels[scenario]}
          </FieldLabel>
          <Input
            id={`${idPrefix}-${scenario}`}
            name={scenarioFieldName(fieldPrefix, scenario)}
            type="number"
            min={0}
            max={1_000_000}
            inputMode="numeric"
            defaultValue={values[scenario] ?? undefined}
            className="min-h-11"
          />
        </Field>
      ))}
    </div>
  )
}
