'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { setMunicipalityPoliticalTrendFormAction } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffFormActions'
import { WizardTrendSkipTrailing } from '@/components/campaign/municipality/WizardTrendSkipTrailing'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import {
  resolveWizardTrendSkip,
  WIZARD_TREND_CLEAR_LABEL,
  WIZARD_TREND_SAVE_LABEL,
} from '@/lib/politicalTrendWizardUi'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import {
  resolveWizardChainEntry,
  wizardChainContinueHref,
  wizardChainEndHref,
} from '@/lib/wizardActionChain'
import { wizardStepPreviousHref } from '@/lib/wizardBack'
import { politicalTrendLabels } from '@/utilities/municipality/municipalityLabels'

type WizardTrendNoteStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  trendStatus: PoliticalTrendStatusValue
  initialNote: string
  entryAction?: CampaignWizardActionId
  returnPath?: string
}

export const WizardTrendNoteStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  trendStatus,
  initialNote,
  entryAction,
  returnPath,
}: WizardTrendNoteStepProps) => {
  const router = useRouter()
  const [note, setNote] = useState(initialNote)
  const [state, submitAction, isPending] = useActionState(
    setMunicipalityPoliticalTrendFormAction,
    {},
  )
  const skip = resolveWizardTrendSkip(entryAction, municipalitySlug, returnPath)
  const stepTitle = `Mudar tendência para ${politicalTrendLabels[trendStatus]}`

  useCampaignFormSuccessToast(state, () => {
    recordLastActedMunicipality(municipalitySlug)
    const sessionEntry = resolveWizardChainEntry(entryAction, 'change-trend')
    router.replace(
      wizardChainContinueHref(sessionEntry, 'change-trend', municipalitySlug, returnPath),
    )
  })

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      isEntryStep={false}
      stepTitle={stepTitle}
      previousHref={wizardStepPreviousHref({
        step: 'trend-note',
        actionSlug,
        municipalitySlug,
        entryAction,
        returnPath,
      })}
      dismissHref={wizardChainEndHref(returnPath)}
      municipalityLabel={municipalityName}
      skip={skip}
      trailingAction={skip ? <WizardTrendSkipTrailing skip={skip} /> : undefined}
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
        <input type="hidden" name="trendStatus" value={trendStatus} />

        <div className="flex flex-col gap-2">
          <label htmlFor="wizard-trend-note" className="text-sm font-medium">
            Por que mudar a tendência?
          </label>
          <Textarea
            id="wizard-trend-note"
            name="trendNote"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            maxLength={2000}
            required
            disabled={isPending}
            autoFocus
            className="min-h-28"
            placeholder="Descreva o que mudou na leitura política do município."
          />
        </div>

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isPending || note.length === 0}
            className="min-h-11"
            onClick={() => setNote('')}
          >
            {WIZARD_TREND_CLEAR_LABEL}
          </Button>
          <Button type="submit" disabled={isPending} className="min-h-11 min-w-[7rem]">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              WIZARD_TREND_SAVE_LABEL
            )}
          </Button>
        </div>

        <div aria-live="polite" className="sr-only">
          {isPending ? 'Salvando tendência.' : null}
        </div>
      </form>
    </CampaignWizardShell>
  )
}
