'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'

import { createMunicipalityListSignalFormAction } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffFormActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { wizardSignalHref } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import { municipalitySignalTypeLabels } from '@/lib/schemas/municipalityUpdate'
import {
  shouldShowWizardSignalSkip,
  WIZARD_SIGNAL_BODY_STEP_TITLE_PREFIX,
  WIZARD_SIGNAL_SAVE_LABEL,
  WIZARD_SIGNAL_SKIP_LABEL,
  wizardSignalSkipHref,
} from '@/lib/wizardSignalUi'

type WizardSignalBodyStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  signalType: MunicipalitySignalType
  entryAction?: CampaignWizardActionId
}

export const WizardSignalBodyStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  signalType,
  entryAction,
}: WizardSignalBodyStepProps) => {
  const router = useRouter()
  const [state, submitAction, isPending] = useActionState(
    createMunicipalityListSignalFormAction,
    {},
  )
  const showSkip = shouldShowWizardSignalSkip(entryAction)
  const stepTitle = `${WIZARD_SIGNAL_BODY_STEP_TITLE_PREFIX}: ${municipalitySignalTypeLabels[signalType]}`

  useCampaignFormSuccessToast(state, () => {
    router.push(CAMPAIGN_HOME)
  })

  return (
    <CampaignWizardShell
      stepTitle={stepTitle}
      previousHref={wizardSignalHref(actionSlug, municipalitySlug, undefined, entryAction)}
      municipalityLabel={municipalityName}
      trailingAction={
        showSkip ? (
          <Button variant="link" size="sm" className="h-auto px-2 py-1 text-xs" asChild>
            <Link href={wizardSignalSkipHref()}>{WIZARD_SIGNAL_SKIP_LABEL}</Link>
          </Button>
        ) : undefined
      }
    >
      <form
        action={submitAction}
        className="flex flex-col gap-6"
        aria-busy={isPending || undefined}
        data-pending={isPending ? '' : undefined}
      >
        <input type="hidden" name="municipalityId" value={municipalityId} />
        <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
        <input type="hidden" name="signalType" value={signalType} />

        <div className="flex flex-col gap-2">
          <label htmlFor="wizard-signal-body" className="text-sm font-medium">
            O que aconteceu?
          </label>
          <Textarea
            id="wizard-signal-body"
            name="body"
            rows={5}
            maxLength={5000}
            required
            disabled={isPending}
            className="min-h-28"
            placeholder="Descreva o fato com o contexto que a equipe precisa lembrar depois."
          />
        </div>

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="min-h-11 min-w-[7rem]">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              WIZARD_SIGNAL_SAVE_LABEL
            )}
          </Button>
        </div>

        <div aria-live="polite" className="sr-only">
          {isPending ? 'Salvando sinal.' : null}
        </div>
      </form>
    </CampaignWizardShell>
  )
}
