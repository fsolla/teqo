'use client'

import { useActionState } from 'react'

import type { RelationOption } from '@/components/campaign/RelationMultiSelect'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { campaignDemandKindLabels, campaignDemandKinds } from '@/lib/schemas/campaignDemand'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type DemandFormProps = {
  plazaOptions: RelationOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const DemandForm = ({ plazaOptions, formAction }: DemandFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="demand-title">O que você precisa?</FieldLabel>
        <Input
          id="demand-title"
          name="title"
          required
          minLength={2}
          maxLength={160}
          className="min-h-11"
        />
        {fieldError(state.fieldErrors, 'title') ? (
          <FieldError>{fieldError(state.fieldErrors, 'title')}</FieldError>
        ) : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="demand-kind">Tipo</FieldLabel>
          <NativeSelect
            id="demand-kind"
            name="kind"
            defaultValue="material"
            className="min-h-11 w-full"
          >
            {campaignDemandKinds.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {campaignDemandKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="demand-plaza">Praça</FieldLabel>
          <NativeSelect
            id="demand-plaza"
            name="plazaId"
            required
            defaultValue=""
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="" disabled>
              Selecione a Praça…
            </NativeSelectOption>
            {plazaOptions.map((option) => (
              <NativeSelectOption key={option.id} value={String(option.id)}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {fieldError(state.fieldErrors, 'plaza') ? (
            <FieldError>{fieldError(state.fieldErrors, 'plaza')}</FieldError>
          ) : null}
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="demand-description">Detalhe a necessidade</FieldLabel>
        <Textarea id="demand-description" name="description" rows={4} maxLength={4000} />
        {fieldError(state.fieldErrors, 'description') ? (
          <FieldError>{fieldError(state.fieldErrors, 'description')}</FieldError>
        ) : null}
      </Field>

      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Abrir demanda
      </Button>
    </form>
  )
}
