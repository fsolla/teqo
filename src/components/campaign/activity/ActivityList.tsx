import { ActivityCard } from '@/components/campaign/activity/ActivityCard'
import type { ActivityListViewModel } from '@/utilities/activityViewModels'

export const ActivityList = ({ activities }: { activities: ActivityListViewModel[] }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {activities.map((activity) => (
      <ActivityCard key={activity.id} activity={activity} />
    ))}
  </div>
)
