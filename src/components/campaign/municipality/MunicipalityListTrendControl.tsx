'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  MunicipalityListPoliticalTrendResponse,
  MunicipalityListSavedPoliticalTrend,
} from '@/app/(campaign)/campanha/(app)/municipios/political-trend/types'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/municipality'
import { politicalTrendBadgeVariant, politicalTrendLabels } from '@/utilities/municipalityLabels'

const NOTE_AUTOSAVE_MS = 600
const STATUS_AUTOSAVE_MS = 150
const POLITICAL_TREND_ENDPOINT = '/campanha/municipios/political-trend'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar a tendência. Tente novamente.'
const NOTE_MAX_LENGTH = 2000

const normalizeNote = (note: string | null | undefined): string | null => {
  const trimmed = note?.trim()
  return trimmed ? trimmed : null
}

const trendsEqual = (
  left: MunicipalityListSavedPoliticalTrend,
  right: MunicipalityListSavedPoliticalTrend,
): boolean => left.status === right.status && normalizeNote(left.note) === normalizeNote(right.note)

type MunicipalityListTrendControlProps = {
  municipalityID: number
  municipalityName: string
  status: MunicipalityListSavedPoliticalTrend['status']
  trendNote: string | null
  variant: CampaignCellEditOverlayVariant
}

export const MunicipalityListTrendControl = ({
  municipalityID,
  municipalityName,
  status,
  trendNote,
  variant,
}: MunicipalityListTrendControlProps) => {
  const initialTrend: MunicipalityListSavedPoliticalTrend = {
    status,
    note: normalizeNote(trendNote),
  }
  const [open, setOpen] = useState(false)
  const [displayTrend, setDisplayTrend] = useState(initialTrend)
  const [draft, setDraft] = useState(initialTrend)
  const [noteDraft, setNoteDraft] = useState(trendNote ?? '')
  const [isDirty, setIsDirty] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const committedTrendRef = useRef(initialTrend)
  const lastPropsTrendRef = useRef(initialTrend)
  const saveGenerationRef = useRef(0)
  /** Skip abort+re-POST when blur and popover-close flush the same payload. */
  const inFlightTrendRef = useRef<MunicipalityListSavedPoliticalTrend | null>(null)
  const openRef = useRef(false)

  /**
   * Closing is what commits the draft, and closing also unmounts the Alert and
   * the live region that would carry a failure — so a save that fails on the
   * way out reverts the badge with nobody told. A toast outlives the overlay;
   * while it is still open the inline Alert remains the closer channel.
   */
  const reportFailure = (message: string) => {
    setErrorMessage(message)
    if (!openRef.current) toast.error(message)
  }

  const adoptTrend = (trend: MunicipalityListSavedPoliticalTrend) => {
    setDisplayTrend(trend)
    setDraft(trend)
    setNoteDraft(trend.note ?? '')
  }

  // Adopt server props only when they change from outside (navigation / RSC refresh).
  useEffect(() => {
    const next: MunicipalityListSavedPoliticalTrend = {
      status,
      note: normalizeNote(trendNote),
    }
    if (trendsEqual(next, lastPropsTrendRef.current)) return
    lastPropsTrendRef.current = next
    committedTrendRef.current = next
    adoptTrend(next)
    setIsDirty(false)
  }, [status, trendNote])

  useEffect(
    () => () => {
      clearTimeout(saveTimeoutRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const saveDraft = async (values: MunicipalityListSavedPoliticalTrend) => {
    const normalized: MunicipalityListSavedPoliticalTrend = {
      status: values.status,
      note: normalizeNote(values.note),
    }
    if (trendsEqual(normalized, committedTrendRef.current)) return
    if (inFlightTrendRef.current && trendsEqual(normalized, inFlightTrendRef.current)) return

    const generation = ++saveGenerationRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    inFlightTrendRef.current = normalized

    setIsPending(true)
    setErrorMessage(null)

    try {
      const response = await fetch(POLITICAL_TREND_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          municipalityId: municipalityID,
          status: normalized.status,
          note: normalized.note,
        }),
      })

      const payload = (await response.json()) as MunicipalityListPoliticalTrendResponse

      if (generation !== saveGenerationRef.current) return

      if (!response.ok || payload.status !== 'success') {
        adoptTrend(committedTrendRef.current)
        setIsDirty(false)
        reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }

      committedTrendRef.current = payload.savedTrend
      adoptTrend(payload.savedTrend)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      adoptTrend(committedTrendRef.current)
      setIsDirty(false)
      reportFailure(SAVE_ERROR_MESSAGE)
    } finally {
      if (generation === saveGenerationRef.current) {
        inFlightTrendRef.current = null
        setIsPending(false)
      }
    }
  }

  const scheduleSave = (values: MunicipalityListSavedPoliticalTrend, delayMs: number) => {
    if (trendsEqual(values, committedTrendRef.current)) {
      clearTimeout(saveTimeoutRef.current)
      setIsDirty(false)
      return
    }
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void saveDraft(values)
    }, delayMs)
  }

  const handleStatusChange = (raw: string) => {
    const next: MunicipalityListSavedPoliticalTrend = {
      status: parsePoliticalTrendStatusFormValue(raw || undefined),
      note: normalizeNote(noteDraft),
    }
    setIsDirty(true)
    setDraft(next)
    setDisplayTrend(next)
    scheduleSave(next, STATUS_AUTOSAVE_MS)
  }

  const handleNoteChange = (raw: string) => {
    const next: MunicipalityListSavedPoliticalTrend = {
      status: draft.status,
      note: normalizeNote(raw),
    }
    setNoteDraft(raw)
    setIsDirty(true)
    setDraft(next)
    setDisplayTrend(next)
    scheduleSave(next, NOTE_AUTOSAVE_MS)
  }

  const flushDraft = () => {
    clearTimeout(saveTimeoutRef.current)
    const next: MunicipalityListSavedPoliticalTrend = {
      status: draft.status,
      note: normalizeNote(noteDraft),
    }
    if (!trendsEqual(next, committedTrendRef.current)) {
      void saveDraft(next)
    }
    setIsDirty(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    openRef.current = nextOpen
    if (nextOpen) {
      setIsDirty(false)
      setErrorMessage(null)
      adoptTrend(displayTrend)
    } else if (open) {
      flushDraft()
    }
    setOpen(nextOpen)
  }

  const hasNote = Boolean(displayTrend.note)
  const trendLabel = displayTrend.status
    ? politicalTrendLabels[displayTrend.status]
    : 'Não registrada'
  const statusMessage = errorMessage
    ? errorMessage
    : isPending
      ? 'Salvando tendência.'
      : isDirty
        ? 'Alterações serão salvas automaticamente.'
        : ''

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title="Editar tendência"
      description={municipalityName}
      // The label names the current reading: an `aria-label` replaces the
      // badge's own text, so without it the trigger would announce the verb and
      // swallow the value every sighted user reads off the pill. Same shape as
      // `MunicipalityListSignalControl`'s.
      triggerLabel={`Editar tendência política em ${municipalityName} — ${trendLabel}`}
      triggerBusy={isPending}
      tooltipContent={hasNote ? <p className="whitespace-pre-wrap">{displayTrend.note}</p> : null}
      contentClassName="w-72 p-3"
      preventPopoverAutoFocus
      trigger={
        displayTrend.status ? (
          <Badge variant={politicalTrendBadgeVariant[displayTrend.status]}>{trendLabel}</Badge>
        ) : (
          <Badge variant="outline">{trendLabel}</Badge>
        )
      }
    >
      <div className="relative flex flex-col gap-3">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando tendência"
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor={`municipality-list-trend-${municipalityID}`}>Tendência</FieldLabel>
          <NativeSelect
            id={`municipality-list-trend-${municipalityID}`}
            value={draft.status ?? ''}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Não registrada</NativeSelectOption>
            {(Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>).map(
              (trendStatus) => (
                <NativeSelectOption key={trendStatus} value={trendStatus}>
                  {politicalTrendLabels[trendStatus]}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`municipality-list-trend-note-${municipalityID}`}>
            Justificativa
          </FieldLabel>
          <Textarea
            id={`municipality-list-trend-note-${municipalityID}`}
            value={noteDraft}
            onChange={(event) => handleNoteChange(event.target.value)}
            onBlur={flushDraft}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            className="min-h-20 resize-y"
            placeholder="Por que essa leitura?"
          />
        </Field>
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
