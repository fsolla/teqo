import { Badge, type badgeVariants } from '@/components/ui/Badge'
import { activityStatusLabels } from '@/lib/schemas/activity'
import type { ActivityStatus } from '@/utilities/activityUi'

type BadgeVariant = NonNullable<Parameters<typeof badgeVariants>[0]>['variant']

const statusVariant: Record<ActivityStatus, BadgeVariant> = {
  confirmado: 'default',
  realizado: 'estimate-confirmed',
  cancelado: 'destructive',
}

export const ActivityStatusBadge = ({ status }: { status: ActivityStatus }) => (
  <Badge variant={statusVariant[status]} data-activity-status={status}>
    {activityStatusLabels[status]}
  </Badge>
)
