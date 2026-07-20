import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { cn } from '@/lib/utils'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'

export const UpcomingActionPlansCard = ({
  plans,
  className,
}: {
  plans: ActionPlanUpcomingPreviewRecord[]
  className?: string
}) => (
  <Card className={cn('flex h-full flex-col', className)}>
    <CardHeader>
      <CardTitle>Próximos eventos</CardTitle>
      <CardAction>
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link href="/campanha/planos">
            Ver todos
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent className="flex-1">
      {plans.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{actionPlanKindLabels[plan.kind]}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatBahiaDateTimeLabel(plan.startAt)}
                  {plan.city ? ` · ${plan.city}` : ''}
                </span>
              </div>
              <Link
                href={`/campanha/planos/${plan.slug}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {plan.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum evento agendado</p>
      )}
    </CardContent>
  </Card>
)
