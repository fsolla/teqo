'use client'

import { startTransition, useActionState, type FormEvent } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type PledgeEstimateFormProps = {
  pledgeID: number
  currentEstimatedVotes: VoteEstimateScenarioViewModel
  currentEstimateNote: string | null
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only inline estimate. The leader never sees these fields. */
export const PledgeEstimateForm = ({
  pledgeID,
  currentEstimatedVotes,
  currentEstimateNote,
  formAction,
}: PledgeEstimateFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the card stays open, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="pledgeId" value={pledgeID} />
      <VoteEstimateScenarioInputs
        fieldPrefix="estimatedVotes"
        values={currentEstimatedVotes}
        idPrefix={`pledge-estimate-${pledgeID}`}
      />
      <Field>
        <FieldLabel htmlFor={`pledge-note-${pledgeID}`} className="text-xs">
          Justificativa
        </FieldLabel>
        <Input
          id={`pledge-note-${pledgeID}`}
          name="estimateNote"
          maxLength={1000}
          defaultValue={currentEstimateNote ?? undefined}
          className="min-h-11"
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        className="min-h-11 self-start"
      >
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar estimativa
      </Button>
      {fieldError(state.fieldErrors, 'estimatedVotes') ||
      fieldError(state.fieldErrors, 'pessimistic') ||
      fieldError(state.fieldErrors, 'central') ||
      fieldError(state.fieldErrors, 'optimistic') ? (
        <FieldError>
          {fieldError(state.fieldErrors, 'estimatedVotes') ||
            fieldError(state.fieldErrors, 'pessimistic') ||
            fieldError(state.fieldErrors, 'central') ||
            fieldError(state.fieldErrors, 'optimistic')}
        </FieldError>
      ) : null}
      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
    </form>
  )
}
