'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CalendarPlusIcon } from 'lucide-react'

import type {
  GoogleCalendarListActionResult,
  GoogleCalendarOAuthStartResult,
  GoogleCalendarSyncActionResult,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { GoogleCalendarPickerDialog } from '@/components/campaign/activity/GoogleCalendarPickerDialog'
import { GoogleCalendarSyncDialog } from '@/components/campaign/activity/GoogleCalendarSyncDialog'
import { SetCampaignHeaderAction } from '@/components/campaign/shell/CampaignPageChromeContext'
import { useBridgedQuickAction } from '@/components/campaign/shell/CampaignQuickActionContext'
import { Button } from '@/components/ui/button'
import type { GoogleCalendarSyncStatus } from '@/utilities/googleCalendarSync'

type AgendaGoogleSyncChromeProps = {
  initialState: GoogleCalendarSyncActionResult
  onSyncNow: () => Promise<GoogleCalendarSyncActionResult>
  onSetDisabled: (disabled: boolean) => Promise<GoogleCalendarSyncActionResult>
  /** C149 — starts the OAuth handshake; the dialog navigates to the consent URL. */
  onStartOAuth: () => Promise<GoogleCalendarOAuthStartResult>
  /** C149 — drops the OAuth connection from the Teqo. */
  onDisconnect: () => Promise<GoogleCalendarSyncActionResult>
  /** C150 — lists the connected account's writable calendars (picker). */
  onListCalendars: () => Promise<GoogleCalendarListActionResult>
  /** C150 — sets the campaign's primary calendar. */
  onChooseCalendar: (calendarId: string) => Promise<GoogleCalendarSyncActionResult>
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

const ADD_TO_GOOGLE_LABEL = 'Adicionar ao meu Google Calendar'

/**
 * C114 — agenda page → app chrome bridge for the Google Calendar mirror
 * (same pattern as AgendaFeedChrome/C94): the status pill registers in the
 * desktop header cluster (after "Link de import"), the mobile FAB opens the
 * same dialog, and a paused mirror auto-retries once on mount.
 *
 * C150 — the chrome also owns the primary-calendar picker (one overlay at a
 * time: opening the picker closes the mirror dialog and closing it brings the
 * dialog back) and registers the one-click "add to my Google Calendar" link
 * for every staff member as soon as a primary calendar exists.
 */
export const AgendaGoogleSyncChrome = ({
  initialState,
  onSyncNow,
  onSetDisabled,
  onStartOAuth,
  onDisconnect,
  onListCalendars,
  onChooseCalendar,
}: AgendaGoogleSyncChromeProps) => {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [state, setState] = useState(initialState)
  const autoRetriedRef = useRef(false)

  const openSync = useCallback(() => setOpen(true), [])

  useBridgedQuickAction('openGoogleCalendarSync', openSync)

  // Shared envelope: every action result that succeeded becomes the rendered
  // state; failures are left for the caller's UI to surface.
  const applyState = useCallback(async (run: () => Promise<GoogleCalendarSyncActionResult>) => {
    const result = await run()
    if (result.ok) setState(result)
    return result
  }, [])

  // "Re-tenta sem ação manual": a paused mirror tries once when the agenda
  // page loads (the staff is operating — the natural retry moment).
  const handleSyncNow = useCallback(() => applyState(onSyncNow), [applyState, onSyncNow])

  useEffect(() => {
    if (state.status === 'paused' && !autoRetriedRef.current) {
      autoRetriedRef.current = true
      void handleSyncNow()
    }
  }, [state.status, handleSyncNow])

  const handleSetDisabled = useCallback(
    (disabled: boolean) => applyState(() => onSetDisabled(disabled)),
    [applyState, onSetDisabled],
  )

  // C149 — the connection card follows the disconnect without a page reload.
  const handleDisconnect = useCallback(() => applyState(onDisconnect), [applyState, onDisconnect])

  // C150 — one overlay at a time: the picker replaces the mirror dialog while
  // open (nested Radix/vaul overlays have fragile focus/scroll on mobile).
  const openPicker = useCallback(() => {
    setOpen(false)
    setPickerOpen(true)
  }, [])

  const handlePickerOpenChange = useCallback((next: boolean) => {
    setPickerOpen(next)
    if (!next) setOpen(true)
  }, [])

  const handleChooseCalendar = useCallback(
    (calendarId: string) => applyState(() => onChooseCalendar(calendarId)),
    [applyState, onChooseCalendar],
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

  const addToGoogle = useMemo(() => {
    if (!state.addLink) return null
    return (
      <>
        <Button asChild size="sm" className="hidden shrink-0 whitespace-nowrap md:inline-flex">
          <a
            href={state.addLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ADD_TO_GOOGLE_LABEL}
          >
            <CalendarPlusIcon className="mr-2 size-4" aria-hidden />
            {ADD_TO_GOOGLE_LABEL}
          </a>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:hidden"
          aria-label={ADD_TO_GOOGLE_LABEL}
          title={ADD_TO_GOOGLE_LABEL}
        >
          <a href={state.addLink} target="_blank" rel="noopener noreferrer">
            <CalendarPlusIcon className="size-5" aria-hidden />
          </a>
        </Button>
      </>
    )
  }, [state.addLink])

  return (
    <>
      <SetCampaignHeaderAction id="google-calendar-sync">{pill}</SetCampaignHeaderAction>
      <SetCampaignHeaderAction id="google-calendar-add">{addToGoogle}</SetCampaignHeaderAction>

      <GoogleCalendarSyncDialog
        open={open}
        onOpenChange={setOpen}
        state={state}
        onSyncNow={handleSyncNow}
        onSetDisabled={handleSetDisabled}
        onStartOAuth={onStartOAuth}
        onDisconnect={handleDisconnect}
        onOpenPicker={openPicker}
      />

      <GoogleCalendarPickerDialog
        open={pickerOpen}
        onOpenChange={handlePickerOpenChange}
        currentCalendarId={state.calendarId}
        onListCalendars={onListCalendars}
        onChooseCalendar={handleChooseCalendar}
      />
    </>
  )
}
