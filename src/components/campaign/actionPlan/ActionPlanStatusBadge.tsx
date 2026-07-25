import { Badge, type badgeVariants } from '@/components/ui/Badge'
import { actionPlanStatusLabels } from '@/lib/schemas/actionPlan'
import type { ActionPlanStatus } from '@/utilities/actionPlanUi'

type BadgeVariant = NonNullable<Parameters<typeof badgeVariants>[0]>['variant']

const statusVariant: Record<ActionPlanStatus, BadgeVariant> = {
  rascunho: 'outline',
  planejado: 'secondary',
  confirmado: 'default',
  realizado: 'estimate-confirmed',
  cancelado: 'destructive',
}

export const ActionPlanStatusBadge = ({ status }: { status: ActionPlanStatus }) => (
  <Badge variant={statusVariant[status]} data-action-plan-status={status}>
    {actionPlanStatusLabels[status]}
  </Badge>
)
