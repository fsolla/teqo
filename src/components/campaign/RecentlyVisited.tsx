'use client'

import { useCallback, useState } from 'react'

import { RecentlyVisitedCard } from '@/components/campaign/RecentlyVisitedCard'
import { UpcomingActionPlansCard } from '@/components/campaign/UpcomingActionPlansCard'
import { cn } from '@/lib/utils'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import { listRecentVisits } from '@/utilities/recentVisits'

type RecentlyVisitedProps = {
  now: Date
  upcomingPlans: ActionPlanUpcomingPreviewRecord[]
}

export const RecentlyVisited = ({ now, upcomingPlans }: RecentlyVisitedProps) => {
  const [hasRecent, setHasRecent] = useState(() => listRecentVisits().length > 0)
  const handleVisitCountChange = useCallback((count: number) => {
    setHasRecent(count > 0)
  }, [])

  return (
    <div className={cn('grid gap-6', hasRecent ? 'lg:grid-cols-2 lg:items-start' : undefined)}>
      <RecentlyVisitedCard
        now={now}
        clearControl="labeled"
        onVisitCountChange={handleVisitCountChange}
      />
      <UpcomingActionPlansCard plans={upcomingPlans} />
    </div>
  )
}
