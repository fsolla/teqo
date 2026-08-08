'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'

import { createMunicipalityUpdateFormAction } from '@/app/(campaign)/campanha/(app)/municipios/[slug]/updateFormActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { wizardPreviousHref, wizardReturnHref } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import { municipalityUpdatePolarityLabels } from '@/lib/schemas/municipalityUpdate'
import { WIZARD_UPDATE_BODY_STEP_TITLE, WIZARD_UPDATE_SAVE_LABEL } from '@/lib/wizardUpdateUi'

type WizardUpdateBodyStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  returnPath?: string
  isStaff: boolean
}

export const WizardUpdateBodyStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  returnPath,
  isStaff,
}: WizardUpdateBodyStepProps) => {
  const router = useRouter()
  const [state, submitAction, isPending] = useActionState(createMunicipalityUpdateFormAction, {})
  const stepTitle = WIZARD_UPDATE_BODY_STEP_TITLE

  useCampaignFormSuccessToast(state, () => {
    recordLastActedMunicipality(municipalitySlug)
    router.push(wizardReturnHref(returnPath))
  })

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      isEntryStep={false}
      stepTitle={stepTitle}
      previousHref={wizardPreviousHref({
        actionSlug,
        stepKind: 'update-body',
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
        <input type="hidden" name="municipalitySlug" value={municipalitySlug} />

        <Field>
          <FieldLabel htmlFor="wizard-update-body">Texto da atualização</FieldLabel>
          <FieldDescription>Descreva o que aconteceu de forma clara e objetiva.</FieldDescription>
          <Textarea
            id="wizard-update-body"
            name="body"
            rows={5}
            maxLength={5000}
            required
            disabled={isPending}
            className="min-h-28"
            placeholder="Ex.: Reunião com líderes comunitários, 45 apoios confirmados..."
          />
          {state.fieldErrors?.body ? <FieldError>{state.fieldErrors.body}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="wizard-update-polarity">Polaridade</FieldLabel>
          <NativeSelect
            id="wizard-update-polarity"
            name="polarity"
            defaultValue="neutra"
            required
            disabled={isPending}
            className="min-h-11 w-full sm:w-56"
          >
            {(['boa', 'neutra', 'ruim'] as const).map((option) => (
              <NativeSelectOption key={option} value={option}>
                {municipalityUpdatePolarityLabels[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Selecione a polaridade do fato observado.</FieldDescription>
        </Field>

        <div className="flex items-center gap-3">
          <input type="hidden" name="urgent" value="false" />
          <Checkbox
            id="wizard-update-urgent"
            name="urgent"
            value="true"
            defaultChecked={false}
            disabled={isPending}
          />
          <FieldLabel htmlFor="wizard-update-urgent" className="font-normal">
            Sinalizar como urgente
          </FieldLabel>
        </div>

        {isStaff ? (
          <div className="flex items-start gap-3">
            <input type="hidden" name="adversarySignal" value="false" />
            <Checkbox
              id="wizard-update-adversary"
              name="adversarySignal"
              value="true"
              defaultChecked={false}
              disabled={isPending}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="wizard-update-adversary" className="font-normal">
                Sinalizar adversário
              </FieldLabel>
              <FieldDescription>
                Marque se este é um fato relacionado a um adversário político.
              </FieldDescription>
            </div>
          </div>
        ) : (
          <input type="hidden" name="adversarySignal" value="false" />
        )}

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="min-h-11 min-w-[7rem]">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              WIZARD_UPDATE_SAVE_LABEL
            )}
          </Button>
        </div>

        <div aria-live="polite" className="sr-only">
          {isPending ? 'Salvando atualização.' : null}
        </div>
      </form>
    </CampaignWizardShell>
  )
}
