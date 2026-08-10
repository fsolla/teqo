'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useState } from 'react'

import { createWizardDemandFormAction } from '@/app/(campaign)/campanha/(app)/acoes/formActions'
import { searchDemandActivityOptions } from '@/app/(campaign)/campanha/(app)/demandas/activitySearchActions'
import { AsyncSearchCombobox } from '@/components/campaign/shared/AsyncSearchCombobox'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { wizardPreviousHref, wizardReturnHref } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { WIZARD_DEMAND_PENDING_ARIA, wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
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

type WizardRegisterDemandStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  returnPath?: string
}

/**
 * Final step of the "Registrar pedido" wizard (A5/B195): the demand form
 * inside the wizard shell — municipality in the app header (no step title, no
 * municipality selector), single free-text field, save → toast → origin.
 */
export const WizardRegisterDemandStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  returnPath,
}: WizardRegisterDemandStepProps) => {
  const router = useRouter()
  const [state, submitAction, isPending] = useActionState(createWizardDemandFormAction, {})
  const [activity, setActivity] = useState<{ id: number; label: string } | null>(null)

  const searchActivities = useCallback(
    (query: string) => searchDemandActivityOptions(query, municipalityId),
    [municipalityId],
  )

  useCampaignFormSuccessToast(state, () => {
    recordLastActedMunicipality(municipalitySlug)
    router.push(wizardReturnHref(returnPath))
  })

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      isEntryStep={false}
      previousHref={wizardPreviousHref({
        actionSlug,
        stepKind: 'register-demand',
        municipalitySlug,
        returnPath,
      })}
      dismissHref={wizardReturnHref(returnPath)}
      municipalityLabel={municipalityName}
      contentFocus="none"
    >
      <form
        action={submitAction}
        className="flex flex-col gap-6"
        aria-busy={isPending || undefined}
        data-pending={isPending ? '' : undefined}
      >
        <input type="hidden" name="municipalityId" value={municipalityId} />

        <Field>
          <FieldLabel htmlFor="wizard-demand-kind">{CAMPAIGN_DEMAND_KIND_LABEL}</FieldLabel>
          <NativeSelect
            id="wizard-demand-kind"
            name="kind"
            defaultValue="material"
            required
            disabled={isPending}
            className="min-h-11 w-full sm:w-56"
          >
            {campaignDemandKinds.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {campaignDemandKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel>{CAMPAIGN_DEMAND_ACTIVITY_LABEL}</FieldLabel>
          <AsyncSearchCombobox
            name="activityId"
            label={CAMPAIGN_DEMAND_ACTIVITY_LABEL}
            value={activity}
            emptyOptionLabel={CAMPAIGN_DEMAND_ACTIVITY_EMPTY_LABEL}
            dialogDescription={CAMPAIGN_DEMAND_ACTIVITY_DIALOG_DESCRIPTION}
            search={searchActivities}
            onChange={setActivity}
          />
          <FieldDescription>{CAMPAIGN_DEMAND_ACTIVITY_DESCRIPTION}</FieldDescription>
          {state.fieldErrors?.activity ? (
            <FieldError>{state.fieldErrors.activity}</FieldError>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="wizard-demand-description">{CAMPAIGN_DEMAND_BODY_LABEL}</FieldLabel>
          <FieldDescription>{CAMPAIGN_DEMAND_BODY_DESCRIPTION}</FieldDescription>
          <Textarea
            id="wizard-demand-description"
            name="description"
            rows={5}
            minLength={2}
            maxLength={CAMPAIGN_DEMAND_BODY_MAX_LENGTH}
            required
            disabled={isPending}
            placeholder={CAMPAIGN_DEMAND_BODY_PLACEHOLDER}
            className="min-h-28"
          />
          {state.fieldErrors?.description ? (
            <FieldError>{state.fieldErrors.description}</FieldError>
          ) : null}
        </Field>

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="min-h-11 min-w-[8rem]">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              CAMPAIGN_DEMAND_SUBMIT_LABEL
            )}
          </Button>
        </div>

        <div aria-live="polite" className="sr-only">
          {isPending ? WIZARD_DEMAND_PENDING_ARIA : null}
        </div>
      </form>
    </CampaignWizardShell>
  )
}
