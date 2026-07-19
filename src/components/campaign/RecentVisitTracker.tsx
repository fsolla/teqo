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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      recordRecentVisit({ ...entry, visitedAt: Date.now() })
    }, RECORD_DWELL_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [entry.href, entry.label, entry.kind])

  return null
}
