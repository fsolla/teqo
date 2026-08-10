'use client'

import { useActionState, useCallback, useState } from 'react'

import { AsyncSearchCombobox } from '@/components/campaign/shared/AsyncSearchCombobox'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  CAMPAIGN_DEMAND_ACTIVITY_DESCRIPTION,
  CAMPAIGN_DEMAND_ACTIVITY_DIALOG_DESCRIPTION,
  CAMPAIGN_DEMAND_ACTIVITY_EMPTY_LABEL,
  CAMPAIGN_DEMAND_ACTIVITY_LABEL,
  CAMPAIGN_DEMAND_BODY_DESCRIPTION,
  CAMPAIGN_DEMAND_BODY_LABEL,
  CAMPAIGN_DEMAND_BODY_MAX_LENGTH,
  CAMPAIGN_DEMAND_BODY_PLACEHOLDER,
  CAMPAIGN_DEMAND_KIND_LABEL,
  CAMPAIGN_DEMAND_SUBMIT_LABEL,
  campaignDemandKindLabels,
  campaignDemandKinds,
} from '@/lib/schemas/campaignDemand'
import type { ActivityRelationOption } from '@/utilities/activityRelationOptions'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type DemandFormProps = {
  municipalityOptions: RelationOption[]
  initialActivity?: ActivityRelationOption | null
  initialMunicipalityId?: number
  searchActivities: (
    query: string,
    municipalityId: number | null,
  ) => Promise<Array<{ id: number; label: string }>>
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const DemandForm = ({
  municipalityOptions,
  initialActivity = null,
  initialMunicipalityId,
  searchActivities,
  formAction,
}: DemandFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [municipalityId, setMunicipalityId] = useState(
    initialMunicipalityId ? String(initialMunicipalityId) : '',
  )
  const [activity, setActivity] = useState<{ id: number; label: string } | null>(
    initialActivity ? { id: initialActivity.id, label: initialActivity.label } : null,
  )

  const parsedMunicipalityId = municipalityId ? Number(municipalityId) : null
  const searchActivitiesForMunicipality = useCallback(
    (query: string) => searchActivities(query, parsedMunicipalityId),
    [parsedMunicipalityId, searchActivities],
  )
  const activityQueryReady = useCallback(
    () => parsedMunicipalityId !== null,
    [parsedMunicipalityId],
  )

  const activityFieldDescription = parsedMunicipalityId
    ? CAMPAIGN_DEMAND_ACTIVITY_DESCRIPTION
    : 'Opcional. Escolha o município antes de vincular uma atividade.'

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="demand-kind">{CAMPAIGN_DEMAND_KIND_LABEL}</FieldLabel>
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
              setMunicipalityId(event.target.value)
              setActivity(null)
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
        <FieldLabel>{CAMPAIGN_DEMAND_ACTIVITY_LABEL}</FieldLabel>
        {parsedMunicipalityId ? (
          <AsyncSearchCombobox
            name="activityId"
            label={CAMPAIGN_DEMAND_ACTIVITY_LABEL}
            value={activity}
            emptyOptionLabel={CAMPAIGN_DEMAND_ACTIVITY_EMPTY_LABEL}
            dialogDescription={CAMPAIGN_DEMAND_ACTIVITY_DIALOG_DESCRIPTION}
            isQueryReady={activityQueryReady}
            queryTooShortMessage="Selecione o município para buscar atividades."
            search={searchActivitiesForMunicipality}
            onChange={setActivity}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 w-full justify-between font-normal opacity-70"
          >
            Selecione o município primeiro…
          </Button>
        )}
        <FieldDescription>{activityFieldDescription}</FieldDescription>
        {fieldError(state.fieldErrors, 'activity') ? (
          <FieldError>{fieldError(state.fieldErrors, 'activity')}</FieldError>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="demand-description">{CAMPAIGN_DEMAND_BODY_LABEL}</FieldLabel>
        <FieldDescription>{CAMPAIGN_DEMAND_BODY_DESCRIPTION}</FieldDescription>
        <Textarea
          id="demand-description"
          name="description"
          rows={5}
          minLength={2}
          maxLength={CAMPAIGN_DEMAND_BODY_MAX_LENGTH}
          required
          placeholder={CAMPAIGN_DEMAND_BODY_PLACEHOLDER}
          className="min-h-28"
        />
        {fieldError(state.fieldErrors, 'description') ? (
          <FieldError>{fieldError(state.fieldErrors, 'description')}</FieldError>
        ) : null}
      </Field>

      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        {CAMPAIGN_DEMAND_SUBMIT_LABEL}
      </Button>
    </form>
  )
}
