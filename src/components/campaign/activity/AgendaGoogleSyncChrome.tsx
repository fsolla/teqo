'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { GoogleCalendarSyncActionResult } from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { GoogleCalendarSyncDialog } from '@/components/campaign/activity/GoogleCalendarSyncDialog'
import { SetCampaignHeaderAction } from '@/components/campaign/shell/CampaignPageChromeContext'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import type { GoogleCalendarSyncStatus } from '@/utilities/googleCalendarSync'

type AgendaGoogleSyncChromeProps = {
  initialState: GoogleCalendarSyncActionResult
  onSyncNow: () => Promise<GoogleCalendarSyncActionResult>
  onSetDisabled: (disabled: boolean) => Promise<GoogleCalendarSyncActionResult>
}

const PILL_COPY: Record<
  GoogleCalendarSyncStatus,
  { label: string; dot: string; className: string }
> = {
  synced: {
    label: 'Google: sincronizado',
    dot: 'bg-green-500',
    className: 'text-green-700',
  },
  paused: {
    label: 'Google: pausado — re-tentando',
    dot: 'bg-amber-500',
    className: 'text-amber-700',
  },
  'not-configured': {
    label: 'Google: não configurado',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground',
  },
  disabled: {
    label: 'Google: desativado',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground',
  },
}

/**
 * C114 — agenda page → app chrome bridge for the Google Calendar mirror
 * (same pattern as AgendaFeedChrome/C94): the status pill registers in the
 * desktop header cluster (after "Link de import"), the mobile FAB opens the
 * same dialog, and a paused mirror auto-retries once on mount.
 */
export const AgendaGoogleSyncChrome = ({
  initialState,
  onSyncNow,
  onSetDisabled,
}: AgendaGoogleSyncChromeProps) => {
  const { setContext } = useCampaignQuickActionContext()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState(initialState)
  const autoRetriedRef = useRef(false)

  const openSync = useCallback(() => setOpen(true), [])

  useEffect(() => {
    setContext((current) => ({ ...current, openGoogleCalendarSync: openSync }))
    return () => {
      setContext((current) => ({ ...current, openGoogleCalendarSync: undefined }))
    }
  }, [setContext, openSync])

  // "Re-tenta sem ação manual": a paused mirror tries once when the agenda
  // page loads (the staff is operating — the natural retry moment).
  const handleSyncNow = useCallback(async () => {
    const result = await onSyncNow()
    if (result.ok) setState(result)
    return result
  }, [onSyncNow])

  useEffect(() => {
    if (state.status === 'paused' && !autoRetriedRef.current) {
      autoRetriedRef.current = true
      void handleSyncNow()
    }
  }, [state.status, handleSyncNow])

  const handleSetDisabled = useCallback(
    async (disabled: boolean) => {
      const result = await onSetDisabled(disabled)
      if (result.ok) setState(result)
      return result
    },
    [onSetDisabled],
  )

  const pill = useMemo(() => {
    const copy = PILL_COPY[state.status]
    return (
      <button
        type="button"
        className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring md:inline-flex ${copy.className}`}
        aria-label={copy.label}
        title={copy.label}
        onClick={openSync}
      >
        <span className={`size-1.5 rounded-full ${copy.dot}`} aria-hidden />
        {copy.label}
      </button>
    )
  }, [state.status, openSync])

  return (
    <>
      <SetCampaignHeaderAction id="google-calendar-sync">{pill}</SetCampaignHeaderAction>

      <GoogleCalendarSyncDialog
        open={open}
        onOpenChange={setOpen}
        state={state}
        onSyncNow={handleSyncNow}
        onSetDisabled={handleSetDisabled}
      />
    </>
  )
}
