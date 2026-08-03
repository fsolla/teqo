'use client'

import { useState } from 'react'

import {
  MUNICIPALITY_PLEDGE_ESTIMATED_VOTES_ENDPOINT,
  type MunicipalityPledgeEstimatedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/pledge-estimated-votes/types'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  effectivePledgeVotesForScenario,
  getVoteEstimateForScenario,
  voteEstimateScenarioLabels,
  voteEstimatesEqual,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

const AUTOSAVE_MS = 600
const SAVE_ERROR_MESSAGE =
  'Não foi possível salvar a estimativa. Verifique seu acesso e tente novamente.'

type MunicipalityV2EstimatedVotesCellProps = {
  pledgeID: number | null
  leadershipName: string
  declaredVotes: number | null
  estimatedVotes: VoteEstimateScenarioViewModel
  variant: 'popover' | 'sheet'
}

type EditableProps = Omit<MunicipalityV2EstimatedVotesCellProps, 'pledgeID'> & {
  pledgeID: number
}

const MunicipalityV2EstimatedVotesCellEditable = ({
  pledgeID,
  leadershipName,
  declaredVotes,
  estimatedVotes,
  variant,
}: EditableProps) => {
  const declared = declaredVotes ?? 0
  const centralEstimate = getVoteEstimateForScenario(estimatedVotes, DEFAULT_VOTE_ESTIMATE_SCENARIO)
  const effectiveCentral = effectivePledgeVotesForScenario(
    declared,
    estimatedVotes,
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )

  const { open, onOpenChange, value, change, isPending, errorMessage, statusMessage } =
    useCampaignCellAutosave<VoteEstimateScenarioViewModel, MunicipalityPledgeEstimatedVotesResponse>(
      {
        value: estimatedVotes,
        equals: voteEstimatesEqual,
        endpoint: MUNICIPALITY_PLEDGE_ESTIMATED_VOTES_ENDPOINT,
        buildBody: (votes) => ({ pledgeId: pledgeID, estimatedVotes: votes }),
        readSaved: (payload) => payload.savedEstimatedVotes,
        errorMessage: SAVE_ERROR_MESSAGE,
        pendingMessage: 'Salvando estimativa.',
      },
    )

  const [focusedScenario, setFocusedScenario] = useState<VoteEstimateScenario>('central')

  const triggerLabel = [
    'Editar estimativa de ',
    leadershipName,
    ' — ',
    voteEstimateScenarioLabels[DEFAULT_VOTE_ESTIMATE_SCENARIO],
    ': ',
    centralEstimate == null
      ? formatElectionNumber(effectiveCentral)
      : formatElectionNumber(centralEstimate),
  ].join('')

  const display =
    centralEstimate == null ? (
      <span className="font-medium tabular-nums text-muted-foreground">
        {formatElectionNumber(effectiveCentral)}
      </span>
    ) : (
      <span className="font-medium tabular-nums">{formatElectionNumber(centralEstimate)}</span>
    )

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Editar estimativa"
      description={leadershipName}
      triggerLabel={triggerLabel}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      triggerClassName="group flex w-full items-center justify-end"
      align="end"
      contentClassName="w-[15.5rem] p-3"
      preventPopoverAutoFocus
      trigger={display}
    >
      <div className="relative flex flex-col gap-2.5">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando estimativa"
          />
        ) : null}
        <VoteEstimateScenarioInputs
          fieldPrefix="estimatedVotes"
          values={value}
          idPrefix={`municipality-v2-estimated-${pledgeID}`}
          variant="compact"
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

export const MunicipalityV2EstimatedVotesCell = ({
  pledgeID,
  leadershipName,
  declaredVotes,
  estimatedVotes,
  variant,
}: MunicipalityV2EstimatedVotesCellProps) => {
  if (pledgeID === null) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <MunicipalityV2EstimatedVotesCellEditable
      pledgeID={pledgeID}
      leadershipName={leadershipName}
      declaredVotes={declaredVotes}
      estimatedVotes={estimatedVotes}
      variant={variant}
    />
  )
}
