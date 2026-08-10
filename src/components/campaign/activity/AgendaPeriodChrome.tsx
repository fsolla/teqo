'use client'

import { useMemo } from 'react'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'

/**
 * C101 — agenda page → app header bridge for the period context: while the
 * mobile calendar navigates, the top bar title shows the visible period
 * ("9 Agosto", "3–9 Agosto", "Agosto") instead of the catalog "Agenda", and
 * tapping it returns to today (the "Hoje" toolbar button is hidden on
 * phones). Desktop never mounts this — the agenda only renders it when the
 * mobile top bar is the visible chrome.
 */
export const AgendaPeriodChrome = ({
  label,
  onToday,
}: {
  label: string | null
  onToday: () => void
}) => {
  const chrome = useMemo(
    () =>
      label ? { title: label, onTitleClick: { action: onToday, hint: 'Voltar para hoje' } } : null,
    [label, onToday],
  )

  if (!chrome) return null

  return <SetCampaignPageChrome chrome={chrome} />
}
