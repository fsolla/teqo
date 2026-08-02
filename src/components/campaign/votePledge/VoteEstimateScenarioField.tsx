'use client'

import { CampaignInfoHint } from '@/components/campaign/shared/CampaignInfoHint'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import {
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'

export const VOTE_ESTIMATE_SCENARIO_MAP_HINT = 'Pinta o mapa e os totais da lista abaixo.'

type VoteEstimateScenarioFieldProps = {
  id: string
  value: VoteEstimateScenario
  onChange: (scenario: VoteEstimateScenario) => void
  hint: string
  className?: string
}

export const VoteEstimateScenarioField = ({
  id,
  value,
  onChange,
  hint,
  className,
}: VoteEstimateScenarioFieldProps) => (
  <Field className={cn('w-full sm:w-44', className)}>
    <div className="flex items-center gap-0.5">
      <FieldLabel htmlFor={id} className="mb-0">
        Cenário
      </FieldLabel>
      <CampaignInfoHint label="Sobre o cenário de estimativa">
        <p>{hint}</p>
      </CampaignInfoHint>
    </div>
    <NativeSelect
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as VoteEstimateScenario)}
      className="min-h-11 w-full"
    >
      {VOTE_ESTIMATE_SCENARIOS.map((scenario) => (
        <NativeSelectOption key={scenario} value={scenario}>
          {voteEstimateScenarioLabels[scenario]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  </Field>
)
