'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  WIZARD_VOTES_INVALID_DRAFT_MESSAGE,
  WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER,
  WIZARD_VOTES_SAVE_ERROR_MESSAGE,
  WIZARD_VOTES_SAVED_MESSAGE,
  wizardFlowTitleForSlug,
  wizardVoteReturnToScenarioLabel,
} from '@/lib/campaignWizardCopy'
import { formatElectionNumber } from '@/lib/electionFormat'
import { cn } from '@/lib/utils'
import { voteEstimateScenarioLabels, type VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  applyVoteShortcut,
  draftTextForVoteValue,
  getNextWizardVoteScenario,
  getPreviousWizardVoteScenario,
  getWizardVoteViolation,
  mergeWizardVoteEstimate,
  parseWizardVoteDraft,
  VOTE_SHORTCUTS,
  voteShortcutLabels,
  wizardVoteFinalCtaLabel,
  wizardVoteStepCtaLabel,
  wizardVoteStepTitle,
  type VoteShortcut,
  type WizardVoteEditScenario,
} from '@/lib/wizardVoteEstimate'

type WizardExpectedVotesStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  initialExpectedVotes: VoteEstimateScenarioViewModel
  currentScenario: WizardVoteEditScenario
}

export const WizardExpectedVotesStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  initialExpectedVotes,
  currentScenario,
}: WizardExpectedVotesStepProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState<VoteEstimateScenarioViewModel>(initialExpectedVotes)
  const [draft, setDraft] = useState(() =>
    draftTextForVoteValue(initialExpectedVotes[currentScenario]),
  )
  const [draftError, setDraftError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'editing' | 'saved'>('editing')
  const [violationEditedScenario, setViolationEditedScenario] =
    useState<WizardVoteEditScenario | null>(null)
  const previousScenarioRef = useRef(currentScenario)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (previousScenarioRef.current === currentScenario) return

    setDraft(draftTextForVoteValue(confirmed[currentScenario]))
    setDraftError(null)

    const violation = violationEditedScenario != null ? getWizardVoteViolation(confirmed) : null
    const keepViolationState =
      violationEditedScenario != null &&
      violation != null &&
      violation.violatingScenario === currentScenario

    if (!keepViolationState) {
      setViolationEditedScenario(null)
    }

    previousScenarioRef.current = currentScenario
  }, [confirmed, currentScenario, violationEditedScenario])

  const activeViolation = violationEditedScenario != null ? getWizardVoteViolation(confirmed) : null
  const showViolationBanner =
    violationEditedScenario != null &&
    activeViolation != null &&
    activeViolation.violatingScenario === currentScenario

  const previousScenario = getPreviousWizardVoteScenario(currentScenario)
  const previousHref = previousScenario
    ? wizardActionHref(actionSlug, municipalitySlug, previousScenario)
    : wizardActionHref(actionSlug)

  const handleShortcut = (shortcut: VoteShortcut) => {
    const currentValue = parseWizardVoteDraft(draft)
    const nextValue = applyVoteShortcut(currentValue, shortcut)
    setDraft(draftTextForVoteValue(nextValue))
    setDraftError(null)
    setSaveError(null)
    setViolationEditedScenario(null)
    inputRef.current?.focus()
  }

  const handleConfirm = () => {
    if (isPending) return

    const trimmed = draft.trim()
    const parsed = trimmed ? parseWizardVoteDraft(draft) : null
    if (trimmed && parsed === null) {
      setDraftError(WIZARD_VOTES_INVALID_DRAFT_MESSAGE)
      return
    }

    const nextConfirmed = mergeWizardVoteEstimate(confirmed, currentScenario, parsed)
    const violation = getWizardVoteViolation(nextConfirmed)

    if (violation) {
      setConfirmed(nextConfirmed)
      setViolationEditedScenario(currentScenario)
      setSaveError(null)
      if (violation.violatingScenario !== currentScenario) {
        router.replace(wizardActionHref(actionSlug, municipalitySlug, violation.violatingScenario))
      }
      return
    }

    setConfirmed(nextConfirmed)
    setViolationEditedScenario(null)
    setSaveError(null)
    setDraftError(null)

    const nextScenario = getNextWizardVoteScenario(currentScenario)
    if (nextScenario) {
      router.replace(wizardActionHref(actionSlug, municipalitySlug, nextScenario))
      return
    }

    startTransition(async () => {
      const { ok, payload } = await postCampaignJson<MunicipalityListExpectedVotesResponse>(
        MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
        {
          municipalityId,
          expectedVotes: nextConfirmed,
        },
      )

      if (!ok || payload.status !== 'success') {
        setSaveError(payload.status === 'error' ? payload.message : WIZARD_VOTES_SAVE_ERROR_MESSAGE)
        return
      }

      setConfirmed(payload.savedExpectedVotes)
      setPhase('saved')
    })
  }

  const handleReturnToEdited = () => {
    if (!violationEditedScenario) return
    router.replace(wizardActionHref(actionSlug, municipalitySlug, violationEditedScenario))
    setViolationEditedScenario(null)
  }

  const currentValue = confirmed[currentScenario]
  const nextScenario = getNextWizardVoteScenario(currentScenario)
  const ctaLabel =
    nextScenario == null ? wizardVoteFinalCtaLabel : wizardVoteStepCtaLabel(currentScenario)

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
      stepTitle={wizardVoteStepTitle(currentScenario)}
      isEntryStep={false}
      previousHref={previousHref}
      dismissHref={CAMPAIGN_HOME}
      municipalityLabel={municipalityName}
    >
      <div
        className="flex flex-col gap-6"
        aria-busy={isPending}
        data-pending={isPending ? '' : undefined}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Valor atual:{' '}
            {currentValue == null ? 'não informado' : formatElectionNumber(currentValue)}
          </p>
          <label htmlFor="wizard-expected-votes-input" className="sr-only">
            {voteEstimateScenarioLabels[currentScenario]} em {municipalityName}
          </label>
          <Input
            ref={inputRef}
            id="wizard-expected-votes-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value.replace(/\D/g, ''))
              setDraftError(null)
              setSaveError(null)
              setViolationEditedScenario(null)
            }}
            onFocus={(event) => event.currentTarget.select()}
            disabled={isPending}
            className={cn(
              'h-auto min-h-14 border-input px-3 py-3 text-center text-2xl font-medium tabular-nums',
              'md:min-h-16 md:text-3xl',
            )}
          />
        </div>

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

        {showViolationBanner && activeViolation ? (
          <Alert variant="pending" className="border-estimate-pending">
            <AlertDescription className="flex flex-col gap-2 text-sm">
              <span>{activeViolation.message}</span>
              <Button
                type="button"
                variant="link"
                className="h-auto justify-start p-0 text-sm"
                onClick={handleReturnToEdited}
              >
                {wizardVoteReturnToScenarioLabel(
                  voteEstimateScenarioLabels[violationEditedScenario],
                )}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {draftError ? (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{draftError}</AlertDescription>
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
            ctaLabel
          )}
        </Button>
      </div>
    </CampaignWizardShell>
  )
}
