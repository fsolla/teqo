'use client'

import { useActionState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type PledgeEstimateFormProps = {
  pledgeID: number
  currentEstimatedVotes: number | null
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
    <form action={submitAction} className="flex flex-col gap-2">
      <input type="hidden" name="pledgeId" value={pledgeID} />
      <div className="flex flex-wrap items-end gap-2">
        <Field>
          <FieldLabel htmlFor={`pledge-estimate-${pledgeID}`} className="text-xs">
            Estimativa do assessor
          </FieldLabel>
          <Input
            id={`pledge-estimate-${pledgeID}`}
            name="estimatedVotes"
            type="number"
            min={0}
            max={1000000}
            inputMode="numeric"
            defaultValue={currentEstimatedVotes ?? undefined}
            className="min-h-11 w-32"
          />
        </Field>
        <Field className="min-w-40 flex-1">
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
        <Button type="submit" variant="secondary" disabled={isPending} className="min-h-11">
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
      {fieldError(state.fieldErrors, 'estimatedVotes') ? (
        <FieldError>{fieldError(state.fieldErrors, 'estimatedVotes')}</FieldError>
      ) : null}
      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
