'use client'

import { useMemo } from 'react'

import { AgendaViewSelector } from '@/components/campaign/activity/AgendaViewSelector'
import { SetCampaignHeaderAction } from '@/components/campaign/shell/CampaignPageChromeContext'
import type { ActivityAgendaState } from '@/utilities/activityUi'

/**
 * C95 — agenda page → app chrome bridge for the view-mode selector: registers
 * the compact dropdown into the app header (desktop cluster + mobile top bar)
 * via the C94/C95 shared header-action slot. Mounted before `AgendaFeedChrome`
 * so the cluster renders `[Semana ▾][Link de import][Notificações][IA]`.
 */
export const AgendaViewChrome = ({ state }: { state: ActivityAgendaState }) => {
  const selector = useMemo(() => <AgendaViewSelector state={state} />, [state])

  return <SetCampaignHeaderAction id="agenda-view">{selector}</SetCampaignHeaderAction>
}
