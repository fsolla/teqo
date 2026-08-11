'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { WizardStepFormChrome } from '@/components/campaign/shared/WizardStepFormChrome'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { wizardPreviousHref, wizardReturnHref } from '@/lib/campaignActionRoutes'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import {
  WIZARD_VOTES_FINAL_CTA_LABEL,
  WIZARD_VOTES_SAVED_MESSAGE,
  wizardFlowTitleForSlug,
  wizardNextStepTitle,
} from '@/lib/campaignWizardCopy'
import { type VoteEstimateScenario, type VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  applyVoteShortcut,
  getWizardVoteViolation,
  VOTE_SHORTCUTS,
  voteShortcutLabels,
  type VoteShortcut,
  type WizardVoteViolation,
} from '@/lib/wizardVoteEstimate'

type WizardExpectedVotesStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  initialExpectedVotes: VoteEstimateScenarioViewModel
  returnPath?: string
}

export const WizardExpectedVotesStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  initialExpectedVotes,
  returnPath,
}: WizardExpectedVotesStepProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [estimates, setEstimates] = useState(initialExpectedVotes)
  const [focusedScenario, setFocusedScenario] = useState<VoteEstimateScenario>('central')
  const [violation, setViolation] = useState<WizardVoteViolation | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const clearViolationState = () => {
    if (violation) setViolation(null)
  }

  const handleValuesChange = (next: VoteEstimateScenarioViewModel) => {
    setEstimates(next)
    clearViolationState()
    setSaveError(null)
  }

  const handleShortcut = (shortcut: VoteShortcut) => {
    const nextValue = applyVoteShortcut(estimates[focusedScenario], shortcut)
    handleValuesChange({ ...estimates, [focusedScenario]: nextValue })
  }

  const continueAfterVotes = () => {
    router.push(wizardReturnHref(returnPath))
  }

  const handleConfirm = () => {
    if (isPending) return

    const nextViolation = getWizardVoteViolation(estimates)
    if (nextViolation) {
      setViolation(nextViolation)
      setSaveError(null)
      return
    }

    clearViolationState()

    startTransition(async () => {
      const { ok, payload } = await postCampaignJson<MunicipalityListExpectedVotesResponse>(
        MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
        {
          municipalityId,
          expectedVotes: estimates,
        },
      )

      if (!ok || payload.status !== 'success') {
        setSaveError(
          payload.status === 'error'
            ? payload.message
            : MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
        )
        return
      }

      setEstimates(payload.savedExpectedVotes)
      recordLastActedMunicipality(municipalitySlug)
      toast.success(WIZARD_VOTES_SAVED_MESSAGE)
      continueAfterVotes()
    })
  }

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      stepTitle={wizardNextStepTitle(actionSlug)}
      isEntryStep={false}
      previousHref={wizardPreviousHref({
        actionSlug,
        stepKind: 'votes',
        municipalitySlug,
        returnPath,
      })}
      dismissHref={wizardReturnHref(returnPath)}
      municipalityLabel={municipalityName}
      contentFocus="none"
    >
      <WizardStepFormChrome
        onCtaClick={handleConfirm}
        isPending={isPending}
        pendingAnnouncement="Salvando votos estimados."
        ctaLabel={WIZARD_VOTES_FINAL_CTA_LABEL}
        ctaClassName="w-full"
      >
        <VoteEstimateScenarioInputs
          fieldPrefix="expectedVotes"
          values={estimates}
          idPrefix={`wizard-expected-votes-${municipalityId}`}
          variant="compact"
          autoFocusScenario="central"
          activeScenario={focusedScenario}
          onFocusScenario={setFocusedScenario}
          errorScenarios={violation ? new Set(violation.highlightScenarios) : undefined}
          disabled={isPending}
          onValuesChange={handleValuesChange}
        />

        <div className="flex flex-wrap gap-2">
          {VOTE_SHORTCUTS.map((shortcut) => (
            <Button
              key={shortcut}
              type="button"
              variant="outline"
              className="min-h-11 min-w-[3.25rem] flex-1 px-2 sm:flex-none"
              disabled={isPending}
              onClick={() => handleShortcut(shortcut)}
            >
              {voteShortcutLabels[shortcut]}
            </Button>
          ))}
        </div>

        {violation ? (
          <Alert variant="pending" className="border-estimate-pending">
            <AlertDescription className="text-sm">{violation.message}</AlertDescription>
          </Alert>
        ) : null}

        {saveError ? (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{saveError}</AlertDescription>
          </Alert>
        ) : null}
      </WizardStepFormChrome>
    </CampaignWizardShell>
  )
}
