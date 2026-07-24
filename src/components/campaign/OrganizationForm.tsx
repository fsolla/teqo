'use client'

import { useActionState } from 'react'

import { RelationMultiSelect, type RelationOption } from '@/components/campaign/RelationMultiSelect'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { organizationKindLabels, organizationKinds } from '@/lib/schemas/organization'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type OrganizationFormProps = {
  municipalityOptions: RelationOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  initial?: {
    id: number
    kind: string
    notes: string | null
    municipalityIDs: number[]
  }
  initialName?: string
}

export const OrganizationForm = ({
  municipalityOptions,
  formAction,
  initial,
  initialName,
}: OrganizationFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const isEdit = Boolean(initial)

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      {initial ? <input type="hidden" name="organizationId" value={initial.id} /> : null}
      {isEdit ? (
        <p className="text-sm text-muted-foreground">
          O nome da organização não pode ser alterado após a criação.
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor="organization-name">Nome</FieldLabel>
          <Input
            id="organization-name"
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={initialName}
            className="min-h-11"
          />
          {fieldError(state.fieldErrors, 'name') ? (
            <FieldError>{fieldError(state.fieldErrors, 'name')}</FieldError>
          ) : null}
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="organization-kind">Tipo</FieldLabel>
        <NativeSelect
          id="organization-kind"
          name="kind"
          defaultValue={initial?.kind ?? 'sindicato'}
          className="min-h-11 w-full sm:w-64"
        >
          {organizationKinds.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {organizationKindLabels[kind]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <RelationMultiSelect
        name="municipalities"
        label="Praças de atuação"
        options={municipalityOptions}
        initialSelectedIDs={initial?.municipalityIDs ?? []}
        error={fieldError(state.fieldErrors, 'municipalities')}
        placeholder="Adicionar Praça…"
      />

      <Field>
        <FieldLabel htmlFor="organization-notes">Observações</FieldLabel>
        <Textarea
          id="organization-notes"
          name="notes"
          rows={4}
          maxLength={4000}
          defaultValue={initial?.notes ?? undefined}
        />
      </Field>

      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === 'success' ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        {isEdit ? 'Salvar organização' : 'Cadastrar organização'}
      </Button>
    </form>
  )
}
