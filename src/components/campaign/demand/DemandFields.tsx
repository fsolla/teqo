'use client'

import {
  DemandResponsibleMultiSelect,
  type DemandResponsibleOption,
} from '@/components/campaign/demand/DemandResponsibleMultiSelect'
import { AsyncSearchCombobox } from '@/components/campaign/shared/AsyncSearchCombobox'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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
  CAMPAIGN_DEMAND_RESPONSIBLES_DESCRIPTION,
  CAMPAIGN_DEMAND_RESPONSIBLES_LABEL,
  campaignDemandKindLabels,
  campaignDemandKinds,
} from '@/lib/schemas/campaignDemand'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

export type DemandActivityValue = { id: number; label: string }

type DemandFieldsProps = {
  idPrefix: string
  disabled?: boolean
  state: CampaignFormActionState
  activity: DemandActivityValue | null
  onActivityChange: (value: DemandActivityValue | null) => void
  searchActivities: (query: string) => Promise<DemandActivityValue[]>
  /** Present on `/demandas/nova`: the municipality selector gates the activity search. */
  municipality?: {
    options: RelationOption[]
    value: string
    onValueChange: (value: string) => void
  }
  /** C143 — explicit-responsible picker; `aside` splits a right column (nova). */
  responsibles?: {
    currentUser: { id: number; name: string } | null
    search: (query: string) => Promise<RelationOption[]>
    layout: 'aside' | 'stacked'
  }
}

/**
 * Shared demand-create fields (D11): Tipo, Atividade and the single free-text
 * description, used by the wizard final step (fixed municipality, stacked) and
 * by `DemandForm` (selectable municipality, two-column grid).
 */
export const DemandFields = ({
  idPrefix,
  disabled,
  state,
  activity,
  onActivityChange,
  searchActivities,
  municipality,
  responsibles,
}: DemandFieldsProps) => {
  const municipalityReady = municipality ? municipality.value !== '' : true

  const activityField = (
    <Field>
      <FieldLabel>{CAMPAIGN_DEMAND_ACTIVITY_LABEL}</FieldLabel>
      {municipality && !municipalityReady ? (
        <Button
          type="button"
          variant="outline"
          disabled
          className="min-h-11 w-full justify-between font-normal opacity-70"
        >
          Selecione o município primeiro…
        </Button>
      ) : (
        <AsyncSearchCombobox
          name="activityId"
          label={CAMPAIGN_DEMAND_ACTIVITY_LABEL}
          value={activity}
          emptyOptionLabel={CAMPAIGN_DEMAND_ACTIVITY_EMPTY_LABEL}
          dialogDescription={CAMPAIGN_DEMAND_ACTIVITY_DIALOG_DESCRIPTION}
          isQueryReady={municipality ? () => municipalityReady : undefined}
          queryTooShortMessage={
            municipality ? 'Selecione o município para buscar atividades.' : undefined
          }
          search={searchActivities}
          onChange={onActivityChange}
        />
      )}
      <FieldDescription>
        {municipality && !municipalityReady
          ? 'Opcional. Escolha o município antes de vincular uma atividade.'
          : CAMPAIGN_DEMAND_ACTIVITY_DESCRIPTION}
      </FieldDescription>
      {fieldError(state.fieldErrors, 'activity') ? (
        <FieldError>{fieldError(state.fieldErrors, 'activity')}</FieldError>
      ) : null}
    </Field>
  )

  const kindField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-kind`}>{CAMPAIGN_DEMAND_KIND_LABEL}</FieldLabel>
      <NativeSelect
        id={`${idPrefix}-kind`}
        name="kind"
        defaultValue="material"
        required
        disabled={disabled}
        className={cn('min-h-11 w-full', !municipality && 'sm:w-56')}
      >
        {campaignDemandKinds.map((kind) => (
          <NativeSelectOption key={kind} value={kind}>
            {campaignDemandKindLabels[kind]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )

  const coreFields = (
    <>
      {municipality ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {kindField}
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-municipality`}>Município</FieldLabel>
            <NativeSelect
              id={`${idPrefix}-municipality`}
              name="municipalityId"
              required
              value={municipality.value}
              onChange={(event) => {
                municipality.onValueChange(event.target.value)
                onActivityChange(null)
              }}
              className="min-h-11 w-full"
            >
              <NativeSelectOption value="" disabled>
                Selecione o município…
              </NativeSelectOption>
              {municipality.options.map((option) => (
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
      ) : (
        kindField
      )}

      {activityField}

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-description`}>{CAMPAIGN_DEMAND_BODY_LABEL}</FieldLabel>
        <FieldDescription>{CAMPAIGN_DEMAND_BODY_DESCRIPTION}</FieldDescription>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={5}
          minLength={2}
          maxLength={CAMPAIGN_DEMAND_BODY_MAX_LENGTH}
          required
          disabled={disabled}
          placeholder={CAMPAIGN_DEMAND_BODY_PLACEHOLDER}
          className="min-h-28"
        />
        {fieldError(state.fieldErrors, 'description') ? (
          <FieldError>{fieldError(state.fieldErrors, 'description')}</FieldError>
        ) : null}
      </Field>
    </>
  )

  if (!responsibles) return coreFields

  const creatorValue: DemandResponsibleOption[] = responsibles.currentUser
    ? [
        {
          id: responsibles.currentUser.id,
          name: responsibles.currentUser.name,
        },
      ]
    : []

  const responsiblesField = (
    <Field>
      <FieldLabel>{CAMPAIGN_DEMAND_RESPONSIBLES_LABEL}</FieldLabel>
      <DemandResponsibleMultiSelect
        name="responsibles"
        value={creatorValue}
        creatorUserId={responsibles.currentUser?.id ?? null}
        search={responsibles.search}
        triggerPlaceholder="Buscar assessor…"
        triggerAriaLabel={CAMPAIGN_DEMAND_RESPONSIBLES_LABEL}
        disabled={disabled}
      />
      <FieldDescription>{CAMPAIGN_DEMAND_RESPONSIBLES_DESCRIPTION}</FieldDescription>
    </Field>
  )

  if (responsibles.layout === 'aside') {
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">{coreFields}</div>
        {responsiblesField}
      </div>
    )
  }

  return (
    <>
      {coreFields}
      {responsiblesField}
    </>
  )
}
