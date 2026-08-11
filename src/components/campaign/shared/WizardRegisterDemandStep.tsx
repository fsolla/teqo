'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useState } from 'react'

import { createWizardDemandFormAction } from '@/app/(campaign)/campanha/(app)/acoes/formActions'
import { searchDemandActivityOptions } from '@/app/(campaign)/campanha/(app)/demandas/activitySearchActions'
import { DemandFields, type DemandActivityValue } from '@/components/campaign/demand/DemandFields'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { WizardStepFormChrome } from '@/components/campaign/shared/WizardStepFormChrome'
import { wizardPreviousHref, wizardReturnHref } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { WIZARD_DEMAND_PENDING_ARIA, wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import { CAMPAIGN_DEMAND_SUBMIT_LABEL } from '@/lib/schemas/campaignDemand'

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
  const [activity, setActivity] = useState<DemandActivityValue | null>(null)

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
      <WizardStepFormChrome
        action={submitAction}
        isPending={isPending}
        pendingAnnouncement={WIZARD_DEMAND_PENDING_ARIA}
        ctaLabel={CAMPAIGN_DEMAND_SUBMIT_LABEL}
        ctaClassName="min-w-[8rem]"
      >
        <input type="hidden" name="municipalityId" value={municipalityId} />

        <DemandFields
          idPrefix="wizard-demand"
          disabled={isPending}
          state={state}
          activity={activity}
          onActivityChange={setActivity}
          searchActivities={searchActivities}
        />

        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
      </WizardStepFormChrome>
    </CampaignWizardShell>
  )
}
