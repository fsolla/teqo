'use client'

import { CalendarIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CalendarFeedDialog,
  type CalendarFeedSummary,
  type CreateCalendarFeedResult,
} from '@/components/campaign/activity/CalendarFeedDialog'
import { SetCampaignHeaderAction } from '@/components/campaign/shell/CampaignPageChromeContext'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { Button } from '@/components/ui/button'

type AgendaFeedChromeProps = {
  feeds: CalendarFeedSummary[]
  onCreateFeed: (label: string) => Promise<CreateCalendarFeedResult>
  onRevokeFeed: (feedId: number) => Promise<{ ok: boolean }>
}

/**
 * Agenda page → app chrome bridge for the calendar-feed surface (C94, gate
 * unlocked by C93): registers the desktop header icon (agenda-contextual),
 * exposes the sheet to the mobile FAB quick action and owns the single shared
 * dialog instance.
 */
export const AgendaFeedChrome = ({ feeds, onCreateFeed, onRevokeFeed }: AgendaFeedChromeProps) => {
  const { setContext } = useCampaignQuickActionContext()
  const [open, setOpen] = useState(false)
  const openFeed = useCallback(() => setOpen(true), [])

  useEffect(() => {
    setContext((current) => ({ ...current, openCalendarFeed: openFeed }))
    return () => {
      setContext((current) => ({ ...current, openCalendarFeed: undefined }))
    }
  }, [setContext, openFeed])

  const headerButton = useMemo(
    () => (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 hidden shrink-0 md:inline-flex"
        aria-label="Link de import"
        title="Link de import"
        onClick={openFeed}
      >
        <CalendarIcon className="size-5" aria-hidden />
      </Button>
    ),
    [openFeed],
  )

  return (
    <>
      <SetCampaignHeaderAction id="calendar-feed">{headerButton}</SetCampaignHeaderAction>

      <CalendarFeedDialog
        open={open}
        onOpenChange={setOpen}
        feeds={feeds}
        onCreateFeed={onCreateFeed}
        onRevokeFeed={onRevokeFeed}
      />
    </>
  )
}
