'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { useBrowserOffline } from '@/components/campaign/opsSync/useBrowserOffline'

/**
 * Dual-path shell (OH9): SSR and first client paint always render `children`
 * (RSC). After mount, when the *browser* is offline, swap to `fallback` (Local
 * mirror view).
 *
 * Sync-failure is intentionally NOT a Local trigger — RSC still works online;
 * chrome owns “Dados podem estar desatualizados” via `useOpsOffline()`.
 *
 * `display: contents` keeps page shell flex/gap intact — this wrapper must not
 * become the sole flex child of `CampaignPageShell`.
 */
export const OfflineBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) => {
  const [mounted, setMounted] = useState(false)
  const browserOffline = useBrowserOffline()

  useEffect(() => {
    setMounted(true)
  }, [])

  return <div className="contents">{mounted && browserOffline ? fallback : children}</div>
}
