'use client'

import { useActionState } from 'react'

import { VoteEstimateScenarioInputs } from '@/components/campaign/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

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

  return (
    <form action={submitAction} className="flex flex-col gap-3">
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
      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
