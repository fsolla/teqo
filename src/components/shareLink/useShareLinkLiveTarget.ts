'use client'

import { useEffect, useState } from 'react'

import type { ShareLinkLiveTarget } from '@/lib/shareLink'

const POLL_INTERVAL_MS = 30_000

/**
 * S29/S44 — the fresh "no ar" read behind the share-link surfaces. It polls
 * the route handler every 30s (paused on hidden tabs), refetches immediately on
 * mount/wake, and only ever ACTIVATES: a `target: null` answer never clears the
 * state, so an already-open page keeps the destination it saw (the kill switch
 * is the link's `published` flag, handled by the server read). `initial` seeds
 * the server-resolved state (the home section renders live in the HTML for
 * whoever arrives during the broadcast).
 */
export const useShareLinkLiveTarget = (
  slug: string,
  initial: ShareLinkLiveTarget | null = null,
): ShareLinkLiveTarget | null => {
  const [live, setLive] = useState<ShareLinkLiveTarget | null>(initial)

  useEffect(() => {
    let cancelled = false

    const refetch = async () => {
      try {
        const response = await fetch(`/api/share-link/${encodeURIComponent(slug)}/live`, {
          cache: 'no-store',
        })
        if (!response.ok) return
        const { target } = (await response.json()) as { target: ShareLinkLiveTarget | null }
        if (cancelled || !target) return
        setLive((current) =>
          current?.href === target.href && current?.label === target.label ? current : target,
        )
      } catch {
        // A transient failure is a lost tick: the next poll retries.
      }
    }

    // Read immediately: the server render may be a cached pre-broadcast page
    // that is already out of date.
    void refetch()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [slug])

  return live
}
