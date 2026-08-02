'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { createMunicipalityListSignalFormAction } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffFormActions'
import { WizardSignalSkipTrailing } from '@/components/campaign/municipality/WizardSignalSkipTrailing'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import {
  resolveWizardChainEntry,
  wizardChainContinueHref,
  wizardChainEndHref,
} from '@/lib/wizardActionChain'
import { wizardStepPreviousHref } from '@/lib/wizardBack'
import { resolveWizardSignalSkip, WIZARD_SIGNAL_SAVE_LABEL } from '@/lib/wizardSignalUi'

type WizardSignalBodyStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  signalType: MunicipalitySignalType
  entryAction?: CampaignWizardActionId
  returnPath?: string
}

export const WizardSignalBodyStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  signalType,
  entryAction,
  returnPath,
}: WizardSignalBodyStepProps) => {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [state, submitAction, isPending] = useActionState(
    createMunicipalityListSignalFormAction,
    {},
  )
  const skip = resolveWizardSignalSkip(entryAction, municipalitySlug, returnPath)
  const canSave = body.trim().length > 0 && !isPending

  useCampaignFormSuccessToast(state, () => {
    recordLastActedMunicipality(municipalitySlug)
    const sessionEntry = resolveWizardChainEntry(entryAction, 'register-signal')
    router.replace(
      wizardChainContinueHref(sessionEntry, 'register-signal', municipalitySlug, returnPath),
    )
  })

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      isEntryStep={false}
      stepTitle={null}
      previousHref={wizardStepPreviousHref({
        step: 'signal-body',
        actionSlug,
        municipalitySlug,
        entryAction,
        returnPath,
      })}
      dismissHref={wizardChainEndHref(returnPath)}
      municipalityLabel={municipalityName}
      skip={skip}
      trailingAction={skip ? <WizardSignalSkipTrailing skip={skip} /> : undefined}
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
        <input type="hidden" name="signalType" value={signalType} />

        <div className="flex flex-col gap-2">
          <label htmlFor="wizard-signal-body" className="text-sm font-medium">
            O que aconteceu?
          </label>
          <Textarea
            id="wizard-signal-body"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            maxLength={5000}
            required
            disabled={isPending}
            autoFocus
            className="min-h-28"
            placeholder="Descreva o fato com o contexto que a equipe precisa lembrar depois."
          />
        </div>

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSave} className="min-h-11 min-w-[7rem]">
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
