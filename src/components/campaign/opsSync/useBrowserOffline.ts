'use client'

import { useEffect, useState } from 'react'

/**
 * Browser online/offline only — matches OfflineBoundary Local trigger.
 *
 * Returns false until mount so SSR/hydration and first paint stay on the
 * online controls (saved-filter create, etc.). After mount, follows
 * `navigator.onLine`.
 */
export const useBrowserOffline = (): boolean => {
  const [mounted, setMounted] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setMounted(true)
    setOffline(!navigator.onLine)

    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return mounted && offline
}
