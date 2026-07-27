'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { MunicipalityListExpectedVotesResponse } from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { StaffMunicipalityVotesDisplay } from '@/components/campaign/votePledge/StaffMunicipalityVotesDisplay'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimateScenarioLabels,
  voteEstimatesEqual,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'
import type { MunicipalityPledgeCoverageView } from '@/utilities/votePledgeViews'

const AUTOSAVE_MS = 600
const EXPECTED_VOTES_ENDPOINT = '/campanha/municipios/expected-votes'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar os votos estimados. Tente novamente.'

/**
 * `municipalityName` is the Drawer's subject line and part of the trigger's
 * accessible name, so a Drawer must always name its subject — the union makes
 * that a compile error instead of a review note. It stays optional for a Popover
 * because the third call site (`MunicipalityGoalAccountCard` on the detail page)
 * already sits under the município's own heading; inside the list, the Popover
 * does pass it, since the name cell is a plain `<td>` and not a `<th scope="row">`,
 * so nothing else announces which row a focused trigger belongs to.
 */
type MunicipalityListExpectedVotesControlProps = {
  municipalityID: number
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage: MunicipalityPledgeCoverageView | null
} & (
  | { variant: 'popover'; municipalityName?: string }
  | { variant: 'sheet'; municipalityName: string }
)

export const MunicipalityListExpectedVotesControl = ({
  municipalityID,
  municipalityName,
  expectedVotes,
  pledgeCoverage,
  variant,
}: MunicipalityListExpectedVotesControlProps) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const activeScenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const [open, setOpen] = useState(false)
  const [displayVotes, setDisplayVotes] = useState(expectedVotes)
  const [draft, setDraft] = useState(expectedVotes)
  const [isDirty, setIsDirty] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const committedVotesRef = useRef(expectedVotes)
  const lastPropsVotesRef = useRef(expectedVotes)
  const saveGenerationRef = useRef(0)
  const openRef = useRef(false)

  /**
   * Closing commits the draft and unmounts the Alert that would carry a
   * failure, so a save that fails on the way out would silently revert the
   * number. A toast outlives the overlay; while it is open the inline Alert is
   * still the closer channel.
   */
  const reportFailure = (message: string) => {
    setErrorMessage(message)
    if (!openRef.current) toast.error(message)
  }

  // Adopt server props only when they change from outside (navigation / RSC refresh).
  useEffect(() => {
    if (voteEstimatesEqual(expectedVotes, lastPropsVotesRef.current)) return
    lastPropsVotesRef.current = expectedVotes
    committedVotesRef.current = expectedVotes
    setDisplayVotes(expectedVotes)
    setDraft(expectedVotes)
    setIsDirty(false)
  }, [expectedVotes])

  useEffect(
    () => () => {
      clearTimeout(saveTimeoutRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const saveDraft = async (values: VoteEstimateScenarioViewModel) => {
    if (voteEstimatesEqual(values, committedVotesRef.current)) return

    const generation = ++saveGenerationRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsPending(true)
    setErrorMessage(null)

    try {
      const response = await fetch(EXPECTED_VOTES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ municipalityId: municipalityID, expectedVotes: values }),
      })

      const payload = (await response.json()) as MunicipalityListExpectedVotesResponse

      if (generation !== saveGenerationRef.current) return

      if (!response.ok || payload.status !== 'success') {
        setDisplayVotes(committedVotesRef.current)
        setDraft(committedVotesRef.current)
        reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }

      committedVotesRef.current = payload.savedExpectedVotes
      setDisplayVotes(payload.savedExpectedVotes)
      setDraft(payload.savedExpectedVotes)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      setDisplayVotes(committedVotesRef.current)
      setDraft(committedVotesRef.current)
      reportFailure(SAVE_ERROR_MESSAGE)
    } finally {
      if (generation === saveGenerationRef.current) {
        setIsPending(false)
      }
    }
  }

  const scheduleSave = (values: VoteEstimateScenarioViewModel) => {
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void saveDraft(values)
    }, AUTOSAVE_MS)
  }

  const handleValuesChange = (values: VoteEstimateScenarioViewModel) => {
    setIsDirty(true)
    setDraft(values)
    setDisplayVotes(values)
    scheduleSave(values)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    openRef.current = nextOpen
    if (nextOpen) {
      setIsDirty(false)
      setErrorMessage(null)
      setDraft(displayVotes)
    } else if (open) {
      clearTimeout(saveTimeoutRef.current)
      if (!voteEstimatesEqual(draft, committedVotesRef.current)) {
        void saveDraft(draft)
      }
      setIsDirty(false)
    }
    setOpen(nextOpen)
  }

  const statusMessage = errorMessage
    ? errorMessage
    : isPending
      ? 'Salvando votos estimados.'
      : isDirty
        ? 'Alterações serão salvas automaticamente.'
        : ''
  // An `aria-label` replaces the trigger's content, and the content here is the
  // number itself — so the label has to carry it, and name the scenario it
  // belongs to (the picker can disagree with the column's sort, E9).
  const activeValue = displayVotes[activeScenario]
  const triggerLabel = [
    'Editar votos estimados',
    municipalityName ? ` em ${municipalityName}` : '',
    ` — ${voteEstimateScenarioLabels[activeScenario]}: `,
    activeValue == null ? 'sem estimativa' : formatElectionNumber(activeValue),
  ].join('')

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title="Editar votos estimados"
      description={municipalityName}
      triggerLabel={triggerLabel}
      triggerBusy={isPending}
      triggerClassName="group flex w-full items-center justify-center"
      align="center"
      contentClassName="w-[15.5rem] p-3"
      preventPopoverAutoFocus
      trigger={
        <StaffMunicipalityVotesDisplay
          expectedVotes={displayVotes}
          pledgeCoverage={pledgeCoverage}
          activeScenario={activeScenario}
          layout="compact"
          align="center"
          suppressHoverPreview={open}
          valueClassName="font-medium tabular-nums"
        />
      }
    >
      <div className="relative flex flex-col gap-2.5">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando votos estimados"
          />
        ) : null}
        <VoteEstimateScenarioInputs
          fieldPrefix="expectedVotes"
          values={draft}
          idPrefix={`municipality-list-expected-votes-${municipalityID}`}
          variant="compact"
          // Desktop: the popover is a transient overlay and typing is the
          // point. On touch the Drawer would raise the virtual keyboard before
          // the field is even read, so the first tap picks the scenario.
          autoFocusScenario={variant === 'sheet' ? undefined : 'central'}
          onValuesChange={handleValuesChange}
        />
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </div>
    </CampaignCellEditOverlay>
  )
}
