'use client'

import { useState, useTransition } from 'react'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  WIZARD_VOTES_FINAL_CTA_LABEL,
  WIZARD_VOTES_SAVED_MESSAGE,
  wizardFlowTitleForSlug,
  wizardNextStepPlaceholder,
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
}

export const WizardExpectedVotesStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  initialExpectedVotes,
}: WizardExpectedVotesStepProps) => {
  const [isPending, startTransition] = useTransition()
  const [estimates, setEstimates] = useState(initialExpectedVotes)
  const [focusedScenario, setFocusedScenario] = useState<VoteEstimateScenario>('central')
  const [violation, setViolation] = useState<WizardVoteViolation | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'editing' | 'saved'>('editing')

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
      setPhase('saved')
    })
  }

  if (phase === 'saved') {
    return (
      <CampaignWizardShell
        flowTitle={wizardFlowTitleForSlug(actionSlug)}
        stepTitle="Votos atualizados"
        isEntryStep={false}
        previousHref={CAMPAIGN_HOME}
        dismissHref={CAMPAIGN_HOME}
        municipalityLabel={municipalityName}
      >
        <div className="flex flex-col gap-4" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">{WIZARD_VOTES_SAVED_MESSAGE}</p>
          <p className="text-sm text-muted-foreground">{wizardNextStepPlaceholder(actionSlug)}</p>
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <CampaignWizardNavLink href={CAMPAIGN_HOME}>Voltar ao Início</CampaignWizardNavLink>
          </Button>
        </div>
      </CampaignWizardShell>
    )
  }

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      stepTitle={wizardNextStepTitle(actionSlug)}
      isEntryStep={false}
      previousHref={wizardActionHref(actionSlug)}
      dismissHref={CAMPAIGN_HOME}
      municipalityLabel={municipalityName}
    >
      <div
        className="flex flex-col gap-6"
        aria-busy={isPending}
        data-pending={isPending ? '' : undefined}
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

        <div aria-live="polite" className="sr-only">
          {isPending ? 'Salvando votos estimados.' : null}
        </div>

        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={isPending}
          onClick={handleConfirm}
        >
          {isPending ? (
            <>
              <Spinner className="size-4" aria-hidden />
              Salvando…
            </>
          ) : (
            WIZARD_VOTES_FINAL_CTA_LABEL
          )}
        </Button>
      </div>
    </CampaignWizardShell>
  )
}
