'use client'

import { useActionState, useState } from 'react'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { campaignDemandKindLabels, campaignDemandKinds } from '@/lib/schemas/campaignDemand'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { ActionPlanRelationOption } from '@/utilities/campaignRelationOptions'

type DemandFormProps = {
  municipalityOptions: RelationOption[]
  actionPlanOptions: ActionPlanRelationOption[]
  initialMunicipalityId?: number
  initialActionPlanId?: number
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const DemandForm = ({
  municipalityOptions,
  actionPlanOptions,
  initialMunicipalityId,
  initialActionPlanId,
  formAction,
}: DemandFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [municipalityId, setMunicipalityId] = useState(
    initialMunicipalityId ? String(initialMunicipalityId) : '',
  )
  const [actionPlanId, setActionPlanId] = useState(
    initialActionPlanId ? String(initialActionPlanId) : '',
  )
  const visibleActionPlans = municipalityId
    ? actionPlanOptions.filter((plan) => String(plan.municipalityId) === municipalityId)
    : actionPlanOptions

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
          <FieldLabel htmlFor="demand-municipality">Município</FieldLabel>
          <NativeSelect
            id="demand-municipality"
            name="municipalityId"
            required
            value={municipalityId}
            onChange={(event) => {
              const nextMunicipalityId = event.target.value
              setMunicipalityId(nextMunicipalityId)
              const selectedPlan = actionPlanOptions.find(
                (plan) => String(plan.id) === actionPlanId,
              )
              if (selectedPlan && String(selectedPlan.municipalityId) !== nextMunicipalityId) {
                setActionPlanId('')
              }
            }}
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="" disabled>
              Selecione o município…
            </NativeSelectOption>
            {municipalityOptions.map((option) => (
              <NativeSelectOption key={option.id} value={String(option.id)}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {fieldError(state.fieldErrors, 'municipality') ? (
            <FieldError>{fieldError(state.fieldErrors, 'municipality')}</FieldError>
          ) : null}
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="demand-action-plan">Plano de ação relacionado</FieldLabel>
        <NativeSelect
          id="demand-action-plan"
          name="actionPlanId"
          value={actionPlanId}
          onChange={(event) => {
            const nextPlanId = event.target.value
            setActionPlanId(nextPlanId)
            const selectedPlan = actionPlanOptions.find((plan) => String(plan.id) === nextPlanId)
            if (selectedPlan) setMunicipalityId(String(selectedPlan.municipalityId))
          }}
          className="min-h-11 w-full"
        >
          <NativeSelectOption value="">Nenhum plano</NativeSelectOption>
          {visibleActionPlans.map((option) => (
            <NativeSelectOption key={option.id} value={String(option.id)}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>
          Opcional. Ao escolher um plano, o município correspondente é preenchido automaticamente.
        </FieldDescription>
        {fieldError(state.fieldErrors, 'actionPlan') ? (
          <FieldError>{fieldError(state.fieldErrors, 'actionPlan')}</FieldError>
        ) : null}
      </Field>
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
