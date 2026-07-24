'use client'

import { useEffect, useRef, useState } from 'react'

import type { MunicipalityListExpectedVotesResponse } from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/MunicipalityEstimateScenarioContext'
import { StaffMunicipalityVotesDisplay } from '@/components/campaign/StaffMunicipalityVotesDisplay'
import { VoteEstimateScenarioInputs } from '@/components/campaign/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimatesEqual,
  type VoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'
import type { MunicipalityPledgeCoverageView } from '@/utilities/votePledgeData'

const AUTOSAVE_MS = 600
const EXPECTED_VOTES_ENDPOINT = '/campanha/municipios/expected-votes'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar os votos estimados. Tente novamente.'

type MunicipalityListExpectedVotesControlProps = {
  municipalityID: number
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage: MunicipalityPledgeCoverageView | null
}

export const MunicipalityListExpectedVotesControl = ({
  municipalityID,
  expectedVotes,
  pledgeCoverage,
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
        setErrorMessage(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
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
      setErrorMessage(SAVE_ERROR_MESSAGE)
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

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'group relative flex min-h-11 w-full items-center justify-center rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open ? 'bg-muted/60' : undefined,
          )}
          aria-label="Editar votos estimados"
        >
          <StaffMunicipalityVotesDisplay
            expectedVotes={displayVotes}
            pledgeCoverage={pledgeCoverage}
            activeScenario={activeScenario}
            layout="compact"
            align="center"
            suppressHoverPreview={open}
            valueClassName="font-medium tabular-nums"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-[15.5rem] p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
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
            autoFocusScenario="central"
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
      </PopoverContent>
    </Popover>
  )
}
