'use client'

import { startTransition, useActionState, type FormEvent } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
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

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the card stays open, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
      <CampaignFormActionMessage state={state} successFallbackMessage="Declaração registrada." />
    </form>
  )
}
