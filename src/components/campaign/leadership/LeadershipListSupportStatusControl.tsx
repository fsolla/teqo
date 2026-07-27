'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { LeadershipListSupportStatusResponse } from '@/app/(campaign)/campanha/(app)/liderancas/support-status/types'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
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
  const openRef = useRef(false)

  /**
   * Closing flushes the pending save and unmounts the Alert that would carry a
   * failure, so a save that fails on the way out would revert the badge with
   * nobody told. Same channel as the município controls: toast once closed,
   * inline Alert while open.
   */
  const reportFailure = (message: string) => {
    setErrorMessage(message)
    if (!openRef.current) toast.error(message)
  }

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
        reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }

      committedStatusRef.current = payload.savedSupportStatus
      setValue(payload.savedSupportStatus)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      setValue(committedStatusRef.current)
      setIsDirty(false)
      reportFailure(SAVE_ERROR_MESSAGE)
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
    openRef.current = nextOpen
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
    // The leaderships list is table-only, so this stays a Popover at every
    // viewport — the shell is here for the trigger and content it already owns,
    // not for a Drawer this surface has nowhere to put (B42).
    <CampaignCellEditOverlay
      variant="popover"
      open={open}
      onOpenChange={handleOpenChange}
      title="Editar status de apoio"
      triggerLabel={`Editar status de apoio — ${supportStatusLabels[value]}`}
      triggerBusy={isPending}
      contentClassName="w-64 p-3"
      preventPopoverAutoFocus
      trigger={<SupportStatusBadge status={value} />}
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
    </CampaignCellEditOverlay>
  )
}
