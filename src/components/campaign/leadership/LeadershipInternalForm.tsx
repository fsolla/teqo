'use client'

import { startTransition, useActionState, type FormEvent } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { LeadershipDetailViewModel } from '@/utilities/leadership/leadershipData'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

type LeadershipInternalFormProps = {
  leadership: LeadershipDetailViewModel
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  stateDeputyOptions: RelationOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only internal evaluation + links (municipalities, organizations). */
export const LeadershipInternalForm = ({
  leadership,
  municipalityOptions,
  organizationOptions,
  stateDeputyOptions,
  formAction,
}: LeadershipInternalFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the card stays open, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="leadershipId" value={leadership.id} />

      <RelationMultiSelect
        name="municipalities"
        label="Municípios em que atua"
        options={municipalityOptions}
        initialSelectedIDs={leadership.municipalityIDs}
        error={fieldError(state.fieldErrors, 'municipalities')}
        placeholder="Adicionar município…"
      />

      <RelationMultiSelect
        name="organizations"
        label="Organizações"
        options={organizationOptions}
        initialSelectedIDs={leadership.organizationIDs}
        error={fieldError(state.fieldErrors, 'organizations')}
        placeholder="Adicionar organização…"
      />

      <RelationMultiSelect
        name="stateDeputies"
        label="Dobradinhas"
        options={stateDeputyOptions}
        initialSelectedIDs={leadership.stateDeputyIDs}
        error={fieldError(state.fieldErrors, 'stateDeputies')}
        placeholder="Adicionar dobradinha…"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leadership-internal-status">Status de apoio</FieldLabel>
          <NativeSelect
            id="leadership-internal-status"
            name="supportStatus"
            defaultValue={leadership.supportStatus ?? 'a_abordar'}
            className="min-h-11 w-full"
          >
            {leadershipSupportStatuses.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {supportStatusLabels[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field orientation="horizontal" className="items-center gap-2 self-end pb-2">
          <Checkbox
            id="leadership-internal-exclusive"
            name="exclusive"
            value="true"
            defaultChecked={leadership.exclusive}
          />
          <FieldLabel htmlFor="leadership-internal-exclusive" className="font-normal">
            Apoio exclusivo
          </FieldLabel>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="leadership-internal-notes">Observações internas</FieldLabel>
        <Textarea
          id="leadership-internal-notes"
          name="notes"
          rows={3}
          maxLength={3000}
          defaultValue={leadership.notes ?? undefined}
        />
      </Field>

      <CampaignFormActionMessage state={state} />
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar
      </Button>
    </form>
  )
}
