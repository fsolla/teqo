'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER,
  WIZARD_VOTES_SAVE_ERROR_MESSAGE,
  WIZARD_VOTES_SAVED_MESSAGE,
  wizardFlowTitleForSlug,
  wizardNextStepTitle,
} from '@/lib/campaignWizardCopy'
import { type VoteEstimateScenario, type VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  applyVoteShortcut,
  getWizardVoteViolation,
  getWizardVoteViolationHighlights,
  VOTE_SHORTCUTS,
  voteShortcutLabels,
  wizardVoteFinalCtaLabel,
  type VoteShortcut,
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
  municipalitySlug: _municipalitySlug,
  initialExpectedVotes,
}: WizardExpectedVotesStepProps) => {
  const [isPending, startTransition] = useTransition()
  const [estimates, setEstimates] = useState(initialExpectedVotes)
  const [focusedScenario, setFocusedScenario] = useState<VoteEstimateScenario>('central')
  const [violationMessage, setViolationMessage] = useState<string | null>(null)
  const [highlightScenarios, setHighlightScenarios] = useState<ReadonlySet<VoteEstimateScenario>>(
    new Set(),
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'editing' | 'saved'>('editing')

  const clearViolationState = () => {
    setViolationMessage(null)
    setHighlightScenarios(new Set())
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

    const violation = getWizardVoteViolation(estimates)
    if (violation) {
      setViolationMessage(violation.message)
      setHighlightScenarios(new Set(getWizardVoteViolationHighlights(estimates)))
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
        setSaveError(payload.status === 'error' ? payload.message : WIZARD_VOTES_SAVE_ERROR_MESSAGE)
        return
      }

      setEstimates(payload.savedExpectedVotes)
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
          <p className="text-sm text-muted-foreground">{WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER}</p>
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link href={CAMPAIGN_HOME}>Voltar ao Início</Link>
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
          errorScenarios={highlightScenarios}
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

        {violationMessage ? (
          <Alert variant="pending" className="border-estimate-pending">
            <AlertDescription className="text-sm">{violationMessage}</AlertDescription>
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
            wizardVoteFinalCtaLabel
          )}
        </Button>
      </div>
    </CampaignWizardShell>
  )
}
