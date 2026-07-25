import Link from 'next/link'
import { CalendarIcon, MapPinIcon, UserIcon } from 'lucide-react'

import { ActionPlanStatusBadge } from '@/components/campaign/actionPlan/ActionPlanStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import type { ActionPlanListViewModel } from '@/utilities/actionPlanViewModels'

const formatWhen = (plan: ActionPlanListViewModel): string =>
  plan.startAt ? formatBahiaDateTimeLabel(plan.startAt) : 'Data a definir'

export const ActionPlanCard = ({ plan }: { plan: ActionPlanListViewModel }) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{actionPlanKindLabels[plan.kind]}</Badge>
        <ActionPlanStatusBadge status={plan.status} />
        {plan.deputyPresent ? <Badge>Deputado presente</Badge> : null}
      </div>
      <CardTitle>
        <Link
          href={`/campanha/planos/${plan.slug}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {plan.title}
        </Link>
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{formatWhen(plan)}</span>
      </div>
      {plan.locationLabel ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
          <Badge variant="outline">{plan.locationLabel}</Badge>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <UserIcon aria-hidden="true" className="size-4 shrink-0" />
          Resp: {plan.responsibleName ?? 'Não definido'}
        </span>
        {plan.taskProgress.total > 0 ? (
          <span className="font-medium tabular-nums text-muted-foreground">
            {plan.taskProgress.done}/{plan.taskProgress.total} tarefas
          </span>
        ) : null}
      </div>
    </CardContent>
  </Card>
)
