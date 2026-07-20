'use client'

import { useCallback, useState } from 'react'

import { ActionQueuesCard } from '@/components/campaign/ActionQueuesCard'
import { RecentlyVisitedCard } from '@/components/campaign/RecentlyVisitedCard'
import { UpcomingActionPlansCard } from '@/components/campaign/UpcomingActionPlansCard'
import { cn } from '@/lib/utils'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import type { GeneralDashboardViewModel } from '@/utilities/campaignDashboardViewModels'
import { listRecentVisits } from '@/utilities/recentVisits'

type GeneralDashboardTopRowProps = {
  queues: GeneralDashboardViewModel['queues']
  upcomingPlans: ActionPlanUpcomingPreviewRecord[]
  now: Date
}

export const GeneralDashboardTopRow = ({
  queues,
  upcomingPlans,
  now,
}: GeneralDashboardTopRowProps) => {
  const [hasRecentVisits, setHasRecentVisits] = useState(() => listRecentVisits().length > 0)
  const handleVisitCountChange = useCallback((count: number) => {
    setHasRecentVisits(count > 0)
  }, [])

  return (
    <div className={cn('grid gap-6 lg:grid-cols-6 lg:items-stretch')}>
      <section
        aria-labelledby="action-queues"
        className={cn('h-full', hasRecentVisits ? 'lg:col-span-3' : 'lg:col-span-4')}
      >
        <ActionQueuesCard queues={queues} />
      </section>
      <div className="h-full lg:col-span-2">
        <UpcomingActionPlansCard plans={upcomingPlans} />
      </div>
      <div className={cn('h-full min-w-0', hasRecentVisits ? 'lg:col-span-1' : 'contents')}>
        <RecentlyVisitedCard now={now} compact onVisitCountChange={handleVisitCountChange} />
      </div>
    </div>
  )
}
