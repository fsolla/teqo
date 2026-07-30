'use client'

import { useActionState, useEffect, useRef } from 'react'

import {
  createLeadershipWizardFormAction,
  updateLeadershipWizardFormAction,
} from '@/app/(campaign)/campanha/(app)/acoes/wizardLeadershipFormActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { WizardLeadershipTileViewModel } from '@/lib/wizardLeadershipContract'
import { fieldError } from '@/utilities/campaignFormFields'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

type WizardLeadershipFormProps = {
  municipalityId: number
  municipalitySlug: string
  leadership: WizardLeadershipTileViewModel | null
  onSaved: () => void
  onCancel: () => void
}

export const WizardLeadershipForm = ({
  municipalityId,
  municipalitySlug,
  leadership,
  onSaved,
  onCancel,
}: WizardLeadershipFormProps) => {
  const isCreate = leadership === null
  const formAction = isCreate ? createLeadershipWizardFormAction : updateLeadershipWizardFormAction
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const nameRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    nameRef.current?.focus()
  }, [leadership?.id])

  useEffect(() => {
    if (state.status === 'success' && !savedRef.current) {
      savedRef.current = true
      onSaved()
    }
    if (state.status !== 'success') {
      savedRef.current = false
    }
  }, [onSaved, state.status])

  return (
    <form action={submitAction} className="flex flex-col gap-4" aria-busy={isPending}>
      <input type="hidden" name="municipalityId" value={municipalityId} />
      <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
      {!isCreate ? <input type="hidden" name="leadershipId" value={leadership.id} /> : null}

      <Field>
        <FieldLabel htmlFor="wizard-leadership-name">Nome</FieldLabel>
        <Input
          ref={nameRef}
          id="wizard-leadership-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={leadership?.name ?? ''}
          className="min-h-11"
        />
        {fieldError(state.fieldErrors, 'name') ? (
          <FieldError>{fieldError(state.fieldErrors, 'name')}</FieldError>
        ) : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="wizard-leadership-phone">Celular</FieldLabel>
          <Input
            id="wizard-leadership-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel-national"
            defaultValue={leadership?.phone ?? ''}
            className="min-h-11"
          />
          {fieldError(state.fieldErrors, 'phone') ? (
            <FieldError>{fieldError(state.fieldErrors, 'phone')}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-leadership-email">E-mail</FieldLabel>
          <Input
            id="wizard-leadership-email"
            name="email"
            type="email"
            defaultValue={leadership?.email ?? ''}
            className="min-h-11"
          />
          {fieldError(state.fieldErrors, 'email') ? (
            <FieldError>{fieldError(state.fieldErrors, 'email')}</FieldError>
          ) : null}
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-leadership-status">Status de apoio</FieldLabel>
        <NativeSelect
          id="wizard-leadership-status"
          name="supportStatus"
          defaultValue={leadership?.supportStatus ?? 'a_abordar'}
          className="min-h-11 w-full"
        >
          {leadershipSupportStatuses.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {supportStatusLabels[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="wizard-leadership-notes">Observação</FieldLabel>
        <Textarea
          id="wizard-leadership-notes"
          name="notes"
          rows={3}
          maxLength={3000}
          defaultValue={leadership?.notes ?? ''}
        />
      </Field>

      <Field orientation="horizontal" className="items-center gap-2">
        <input type="hidden" name="exclusive" value="false" />
        <Checkbox
          id="wizard-leadership-exclusive"
          name="exclusive"
          value="true"
          defaultChecked={leadership?.exclusive ?? true}
        />
        <FieldLabel htmlFor="wizard-leadership-exclusive" className="font-normal">
          Apoio exclusivo
        </FieldLabel>
      </Field>

      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="submit" disabled={isPending} className="min-h-11">
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
    </form>
  )
}
