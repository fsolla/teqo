'use client'

import { useEffect, useRef, useState } from 'react'

import type {
  MunicipalityListPoliticalTrendResponse,
  MunicipalityListSavedPoliticalTrend,
} from '@/app/(campaign)/campanha/(app)/municipios/political-trend/types'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/municipality'
import { cn } from '@/lib/utils'
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
  status: MunicipalityListSavedPoliticalTrend['status']
  trendNote: string | null
}

export const MunicipalityListTrendControl = ({
  municipalityID,
  status,
  trendNote,
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
        setErrorMessage(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }

      committedTrendRef.current = payload.savedTrend
      adoptTrend(payload.savedTrend)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      adoptTrend(committedTrendRef.current)
      setIsDirty(false)
      setErrorMessage(SAVE_ERROR_MESSAGE)
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
  const statusMessage = errorMessage
    ? errorMessage
    : isPending
      ? 'Salvando tendência.'
      : isDirty
        ? 'Alterações serão salvas automaticamente.'
        : ''

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <CampaignHoverTooltip
        content={hasNote ? <p className="whitespace-pre-wrap">{displayTrend.note}</p> : null}
        align="start"
        openOnTouch={false}
        disabled={open}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-busy={isPending || undefined}
            className={cn(
              'min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open ? 'bg-muted/60' : undefined,
            )}
            aria-label="Editar tendência política"
          >
            {displayTrend.status ? (
              <Badge variant={politicalTrendBadgeVariant[displayTrend.status]}>
                {politicalTrendLabels[displayTrend.status]}
              </Badge>
            ) : (
              <Badge variant="outline">Não registrada</Badge>
            )}
          </button>
        </PopoverTrigger>
      </CampaignHoverTooltip>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-72 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
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
      </PopoverContent>
    </Popover>
  )
}
