'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { resolveOpsHybridEnabled } from '@/lib/campaignOps/opsHybridFlag'

/**
 * Dual-path shell (OH9): SSR and first client paint always render `children`
 * (RSC). After mount, when OPS_HYBRID is on and the *browser* is offline,
 * swap to `fallback` (Local mirror view).
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
  const hybrid = resolveOpsHybridEnabled()
  const [mounted, setMounted] = useState(false)
  const [browserOffline, setBrowserOffline] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBrowserOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)

    const onOnline = () => setBrowserOffline(false)
    const onOffline = () => setBrowserOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return <div className="contents">{mounted && hybrid && browserOffline ? fallback : children}</div>
}
