import { ArrowRightIcon, CheckCircle2Icon } from 'lucide-react'
import Link from 'next/link'

import { campaignPrioritySurfaceClassName } from '@/components/campaign/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import { cn } from '@/lib/utils'
import type {
  DashboardQueueItem,
  GeneralDashboardViewModel,
} from '@/utilities/campaignDashboardViewModels'

export const buildDashboardQueueItemHref = (
  slug: string,
  openCoordinatorAssignment: boolean,
): string => `/campanha/nucleos/${slug}${openCoordinatorAssignment ? '?assignCoordinators=1' : ''}`

const QueueSection = ({
  title,
  items,
  priority = false,
  openCoordinatorAssignment = false,
}: {
  title: string
  items: DashboardQueueItem[]
  priority?: boolean
  openCoordinatorAssignment?: boolean
}) => (
  <div className={priority ? 'rounded-lg bg-muted/40 p-2' : undefined}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3
        className={priority ? 'text-sm font-semibold' : 'text-sm font-medium text-muted-foreground'}
      >
        {priority ? `Prioridade · ${title}` : title}
      </h3>
      <Badge variant={priority ? 'estimate-pending' : 'secondary'}>{items.length}</Badge>
    </div>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-between">
            <Link href={buildDashboardQueueItemHref(item.slug, openCoordinatorAssignment)}>
              <span className="min-w-0 text-left">
                <strong className="block truncate font-medium">{item.name}</strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.territory}
                </span>
              </span>
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  </div>
)

type ActionQueues = GeneralDashboardViewModel['queues']

export const ActionQueuesCard = ({ queues }: { queues: ActionQueues }) => {
  const sections = [
    {
      key: 'withoutCoordinator',
      title: 'Sem coordenador',
      items: queues.withoutCoordinator,
      priority: true,
      openCoordinatorAssignment: true,
    },
    {
      key: 'withoutRecentUpdate',
      title: 'Sem atualização há mais de 7 dias',
      items: queues.withoutRecentUpdate,
      priority: false,
      openCoordinatorAssignment: false,
    },
    {
      key: 'pendingEstimate',
      title: 'Estimativas pendentes',
      items: queues.pendingEstimate,
      priority: false,
      openCoordinatorAssignment: false,
    },
  ] as const

  const activeSections = sections.filter((section) => section.items.length > 0)
  const allClear = activeSections.length === 0

  return (
    <Card className={cn('flex h-full flex-col', campaignPrioritySurfaceClassName)}>
      <CardHeader>
        <CardTitle id="action-queues">Filas de ação</CardTitle>
        <CardDescription>
          {allClear
            ? 'Nenhuma pendência de coordenação, cadência ou estimativa.'
            : 'Trate a prioridade primeiro; as demais filas vêm em seguida.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {allClear ? (
          <Empty className="border bg-muted/20 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2Icon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Tudo em dia</EmptyTitle>
              <EmptyDescription>
                Nenhum núcleo aguarda coordenador, cadência ou confirmação de estimativa.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {activeSections.map((section) => (
              <QueueSection
                key={section.key}
                title={section.title}
                items={section.items}
                priority={section.priority}
                openCoordinatorAssignment={section.openCoordinatorAssignment}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
