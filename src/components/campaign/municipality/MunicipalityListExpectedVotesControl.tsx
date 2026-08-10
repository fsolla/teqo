'use client'

import { useState } from 'react'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { StaffMunicipalityVotesDisplay } from '@/components/campaign/votePledge/StaffMunicipalityVotesDisplay'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  voteEstimatesEqual,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'
import type { MunicipalityPledgeCoverageView } from '@/utilities/votePledgeViews'
import type { ReactNode } from 'react'

const AUTOSAVE_MS = 600

/**
 * `municipalityName` is the Drawer's subject line and part of the trigger's
 * accessible name, so a Drawer must always name its subject — the union makes
 * that a compile error instead of a review note. It stays optional for a Popover
 * because the third call site (`MunicipalityGoalAccountCard` on the detail page)
 * already sits under the município's own heading; inside the list, the Popover
 * does pass it, since the name cell is a plain `<td>` and not a `<th scope="row">`,
 * so nothing else announces which row a focused trigger belongs to.
 */
type MunicipalityListExpectedVotesControlProps = {
  municipalityID: number
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage: MunicipalityPledgeCoverageView | null
  /**
   * B193 — replaces the internal votes display trigger (e.g. the dense mobile
   * card's scenario strip). Receives the LIVE autosave value and the active
   * scenario, so the strip reflects an in-flight edit; the `aria-label` below
   * still names the reading.
   */
  trigger?: (
    value: VoteEstimateScenarioViewModel,
    activeScenario: VoteEstimateScenario,
  ) => ReactNode
  /** B193 — dense card styling override (same slot as the sibling controls). */
  triggerClassName?: string
} & (
  | { variant: 'popover'; municipalityName?: string }
  | { variant: 'sheet'; municipalityName: string }
)

export const MunicipalityListExpectedVotesControl = ({
  municipalityID,
  municipalityName,
  expectedVotes,
  pledgeCoverage,
  variant,
  trigger,
  triggerClassName,
}: MunicipalityListExpectedVotesControlProps) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const activeScenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const [focusedScenario, setFocusedScenario] = useState<VoteEstimateScenario>('central')
  const { open, onOpenChange, value, change, isPending, errorMessage, statusMessage } =
    useCampaignCellAutosave<VoteEstimateScenarioViewModel, MunicipalityListExpectedVotesResponse>({
      value: expectedVotes,
      equals: voteEstimatesEqual,
      endpoint: MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
      buildBody: (values) => ({ municipalityId: municipalityID, expectedVotes: values }),
      readSaved: (payload) => payload.savedExpectedVotes,
      errorMessage: MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
      pendingMessage: 'Salvando votos estimados.',
    })

  // An `aria-label` replaces the trigger's content, and the content here is the
  // number itself — so the label has to carry it, and name the scenario it
  // belongs to (the picker can disagree with the column's sort, E9). All three
  // scenarios ride along: the strip shows the whole interval (B193), so the
  // announcement must too.
  const scenarioSummary = VOTE_ESTIMATE_SCENARIOS.map((scenario) => {
    const scenarioValue = value[scenario]
    return `${voteEstimateScenarioLabels[scenario]}: ${
      scenarioValue == null ? 'sem estimativa' : formatElectionNumber(scenarioValue)
    }`
  }).join('; ')
  const triggerLabel = [
    'Editar votos estimados',
    municipalityName ? ` em ${municipalityName}` : '',
    ` — ${scenarioSummary}`,
  ].join('')

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Editar votos estimados"
      description={municipalityName}
      triggerLabel={triggerLabel}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      triggerClassName={triggerClassName ?? 'group flex w-full items-center justify-center'}
      align="center"
      contentClassName="w-[15.5rem] p-3"
      preventPopoverAutoFocus
      trigger={
        trigger ? (
          trigger(value, activeScenario)
        ) : (
          <StaffMunicipalityVotesDisplay
            expectedVotes={value}
            pledgeCoverage={pledgeCoverage}
            activeScenario={activeScenario}
            layout="compact"
            align="center"
            suppressHoverPreview={open}
            valueClassName="font-medium tabular-nums"
          />
        )
      }
    >
      <div className="relative flex flex-col gap-2.5">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando votos estimados"
          />
        ) : null}
        <VoteEstimateScenarioInputs
          fieldPrefix="expectedVotes"
          values={value}
          idPrefix={`municipality-list-expected-votes-${municipalityID}`}
          variant="compact"
          // Desktop: the popover is a transient overlay and typing is the
          // point. On touch the Drawer would raise the virtual keyboard before
          // the field is even read, so the first tap picks the scenario.
          autoFocusScenario={variant === 'sheet' ? undefined : 'central'}
          activeScenario={focusedScenario}
          onFocusScenario={setFocusedScenario}
          onValuesChange={(values) => change(values, AUTOSAVE_MS)}
        />
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </CampaignCellEditOverlay>
  )
}
