'use client'

import { useEffect } from 'react'

import {
  RECORD_DWELL_MS,
  recordRecentVisit,
  type RecentVisitEntry,
} from '@/utilities/recentVisits'

export const RecentVisitTracker = ({
  entry,
}: {
  entry: Omit<RecentVisitEntry, 'visitedAt'>
}) => {
  // Primitive dependencies: the effect must re-run on visit identity changes,
  // not on parent re-renders handing down a fresh `entry` object.
  const { href, label, kind } = entry

  useEffect(() => {
    const timer = window.setTimeout(() => {
      recordRecentVisit({ href, label, kind, visitedAt: Date.now() })
    }, RECORD_DWELL_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [href, label, kind])

  return null
}
