import { CalendarIcon, MapPinIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'

import { ActivityStatusBadge } from '@/components/campaign/activity/ActivityStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { activityKindLabels } from '@/lib/schemas/activity'
import type { ActivityListViewModel } from '@/utilities/activityViewModels'

const formatWhen = (activity: ActivityListViewModel): string =>
  activity.startAt ? formatBahiaDateTimeLabel(activity.startAt) : 'Data a definir'

export const ActivityCard = ({ activity }: { activity: ActivityListViewModel }) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{activityKindLabels[activity.kind]}</Badge>
        <ActivityStatusBadge status={activity.status} />
        {activity.deputyPresent ? <Badge>Deputado presente</Badge> : null}
      </div>
      <CardTitle>
        <Link
          href={`/campanha/atividades/${activity.slug}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {activity.title}
        </Link>
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{formatWhen(activity)}</span>
      </div>
      {activity.locationLabel ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
          <Badge variant="outline">{activity.locationLabel}</Badge>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <UserIcon aria-hidden="true" className="size-4 shrink-0" />
          Resp: {activity.responsibleName ?? 'Não definido'}
        </span>
        {activity.taskProgress.total > 0 ? (
          <span className="font-medium tabular-nums text-muted-foreground">
            {activity.taskProgress.done}/{activity.taskProgress.total} tarefas
          </span>
        ) : null}
      </div>
    </CardContent>
  </Card>
)
