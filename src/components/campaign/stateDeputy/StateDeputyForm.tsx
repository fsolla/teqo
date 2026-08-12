'use client'

import { useActionState } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type StateDeputyFormProps = {
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  initial?: {
    id: number
    party: string | null
    ballotName: string | null
    notes: string | null
  }
  initialName?: string
}

export const StateDeputyForm = ({ formAction, initial, initialName }: StateDeputyFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const isEdit = Boolean(initial)

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      {initial ? <input type="hidden" name="stateDeputyId" value={initial.id} /> : null}
      {!isEdit ? (
        <Field>
          <FieldLabel htmlFor="state-deputy-name">Nome</FieldLabel>
          <Input
            id="state-deputy-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initialName}
            className="min-h-11"
          />
          {fieldError(state.fieldErrors, 'name') ? (
            <FieldError>{fieldError(state.fieldErrors, 'name')}</FieldError>
          ) : null}
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor="state-deputy-party">Partido</FieldLabel>
        <Input
          id="state-deputy-party"
          name="party"
          maxLength={32}
          defaultValue={initial?.party ?? undefined}
          className="min-h-11"
          placeholder="Ex.: PT"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="state-deputy-ballot-name">Nome de legenda</FieldLabel>
        <Input
          id="state-deputy-ballot-name"
          name="ballotName"
          maxLength={30}
          defaultValue={initial?.ballotName ?? undefined}
          className="min-h-11"
          placeholder="Ex.: Sollinha"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="state-deputy-notes">Observações</FieldLabel>
        <Textarea
          id="state-deputy-notes"
          name="notes"
          rows={4}
          maxLength={4000}
          defaultValue={initial?.notes ?? undefined}
        />
      </Field>

      <CampaignFormActionMessage state={state} />
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        {isEdit ? 'Salvar dobradinha' : 'Cadastrar dobradinha'}
      </Button>
    </form>
  )
}
