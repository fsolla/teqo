'use client'

import { useEffect, useRef, useState } from 'react'

import type { LeadershipListSupportStatusResponse } from '@/app/(campaign)/campanha/(app)/liderancas/support-status/types'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import { supportStatusLabels } from '@/utilities/leadershipLabels'

const STATUS_AUTOSAVE_MS = 150
const SUPPORT_STATUS_ENDPOINT = '/campanha/liderancas/support-status'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar o status. Tente novamente.'
const DEFAULT_STATUS: SupportStatus = 'a_abordar'

type LeadershipListSupportStatusControlProps = {
  leadershipID: number
  status: SupportStatus | null
}

export const LeadershipListSupportStatusControl = ({
  leadershipID,
  status,
}: LeadershipListSupportStatusControlProps) => {
  const initialStatus = status ?? DEFAULT_STATUS
  const [open, setOpen] = useState(false)
  // Single value drives both the trigger badge and the select — unlike
  // `MunicipalityListExpectedVotesControl`/`Trend`, there is only one field
  // here, so a "display" value distinct from the "draft" would just be a
  // second name for the same state.
  const [value, setValue] = useState(initialStatus)
  const [isDirty, setIsDirty] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const committedStatusRef = useRef(initialStatus)
  const lastPropsStatusRef = useRef(initialStatus)
  const saveGenerationRef = useRef(0)

  // Adopt server props only when they change from outside (navigation / RSC refresh).
  useEffect(() => {
    const next = status ?? DEFAULT_STATUS
    if (next === lastPropsStatusRef.current) return
    lastPropsStatusRef.current = next
    committedStatusRef.current = next
    setValue(next)
    setIsDirty(false)
  }, [status])

  useEffect(
    () => () => {
      clearTimeout(saveTimeoutRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const saveStatus = async (nextStatus: SupportStatus) => {
    if (nextStatus === committedStatusRef.current) return

    const generation = ++saveGenerationRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsPending(true)
    setErrorMessage(null)

    try {
      const response = await fetch(SUPPORT_STATUS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ leadershipId: leadershipID, supportStatus: nextStatus }),
      })

      const payload = (await response.json()) as LeadershipListSupportStatusResponse

      if (generation !== saveGenerationRef.current) return

      if (!response.ok || payload.status !== 'success') {
        setValue(committedStatusRef.current)
        setIsDirty(false)
        setErrorMessage(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }

      committedStatusRef.current = payload.savedSupportStatus
      setValue(payload.savedSupportStatus)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      setValue(committedStatusRef.current)
      setIsDirty(false)
      setErrorMessage(SAVE_ERROR_MESSAGE)
    } finally {
      if (generation === saveGenerationRef.current) {
        setIsPending(false)
      }
    }
  }

  const handleStatusChange = (raw: string) => {
    if (!isSupportStatus(raw)) return
    setIsDirty(true)
    setValue(raw)
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = undefined
      void saveStatus(raw)
    }, STATUS_AUTOSAVE_MS)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsDirty(false)
      setErrorMessage(null)
    } else if (saveTimeoutRef.current !== undefined) {
      // Flush a pending debounced save instead of letting the unmount
      // cleanup drop it — closing right after picking an option must not
      // silently discard the change (same precedent as `flushDraft` in
      // `MunicipalityListTrendControl`).
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = undefined
      void saveStatus(value)
    }
    setOpen(nextOpen)
  }

  const statusMessage = errorMessage
    ? errorMessage
    : isPending
      ? 'Salvando status de apoio.'
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
          aria-busy={isPending || undefined}
          className={cn(
            'min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open ? 'bg-muted/60' : undefined,
          )}
          aria-label="Editar status de apoio"
        >
          <SupportStatusBadge status={value} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="relative flex flex-col gap-3">
          {isPending ? (
            <Spinner
              className="absolute top-0 right-0 size-3.5 text-muted-foreground"
              aria-label="Salvando status de apoio"
            />
          ) : null}
          <Field>
            <FieldLabel htmlFor={`leadership-list-support-status-${leadershipID}`}>
              Status de apoio
            </FieldLabel>
            <NativeSelect
              id={`leadership-list-support-status-${leadershipID}`}
              value={value}
              onChange={(event) => handleStatusChange(event.target.value)}
              className="min-h-11 w-full"
            >
              {leadershipSupportStatuses.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {supportStatusLabels[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
