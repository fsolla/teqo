'use client'

import { useActionState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type DeclareVotesFormProps = {
  municipalityID: number
  /** Present when staff declare on behalf of a leadership. */
  leadershipID?: number
  currentDeclaredVotes: number | null
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const DeclareVotesForm = ({
  municipalityID,
  leadershipID,
  currentDeclaredVotes,
  formAction,
}: DeclareVotesFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex flex-col gap-3">
      <input type="hidden" name="municipalityId" value={municipalityID} />
      {leadershipID !== undefined ? (
        <input type="hidden" name="leadershipId" value={leadershipID} />
      ) : null}
      <Field>
        <FieldLabel htmlFor={`declare-votes-${municipalityID}-${leadershipID ?? 'own'}`}>
          {leadershipID !== undefined
            ? 'Quantos votos a liderança traz neste município?'
            : 'Quantos votos você está trazendo neste município?'}
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`declare-votes-${municipalityID}-${leadershipID ?? 'own'}`}
            name="declaredVotes"
            type="number"
            min={0}
            max={1000000}
            required
            inputMode="numeric"
            defaultValue={currentDeclaredVotes ?? undefined}
            className="min-h-11 w-36"
          />
          <Button type="submit" disabled={isPending} className="min-h-11">
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {currentDeclaredVotes == null ? 'Declarar' : 'Atualizar'}
          </Button>
        </div>
        {fieldError(state.fieldErrors, 'declaredVotes') ? (
          <FieldError>{fieldError(state.fieldErrors, 'declaredVotes')}</FieldError>
        ) : null}
      </Field>
      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === 'success' ? (
        <Alert>
          <AlertDescription>{state.message ?? 'Declaração registrada.'}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
