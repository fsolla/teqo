import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import {
  SupportStatusBadge,
  supportStatusLabel,
  supportStatusSummary,
} from '@/components/campaign/SupportStatusBadge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/Empty'
import { formatElectionNumber } from '@/lib/electionInsights'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import type { GeneralDashboardViewModel } from '@/utilities/campaignDashboardViewModels'

export const LeadershipStatusCard = ({
  supportCounts,
}: {
  supportCounts: GeneralDashboardViewModel['supportCounts']
}) => {
  const total = leadershipSupportStatuses.reduce((sum, status) => sum + supportCounts[status], 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lideranças por status de apoio</CardTitle>
        <CardDescription>
          Contatos de liderança em todos os núcleos, classificados pelo nível de engajamento com a
          campanha.
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="min-h-11">
            <Link href="/campanha/nucleos">
              Ver núcleos
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {total > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {formatElectionNumber(total)}
              </span>{' '}
              {total === 1 ? 'liderança na campanha' : 'lideranças na campanha'}
            </p>
            <dl className="grid grid-cols-2 gap-0 divide-x divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-4 sm:divide-y-0">
              {leadershipSupportStatuses.map((status) => {
                const count = supportCounts[status]
                const emphasize = status === 'engajado'

                return (
                  <div
                    key={status}
                    className={cn(
                      'flex min-w-0 flex-col gap-2 px-4 py-3',
                      emphasize ? 'bg-muted/40' : undefined,
                    )}
                    title={supportStatusSummary(status)}
                  >
                    <dt>
                      <SupportStatusBadge status={status} />
                    </dt>
                    <dd
                      className={cn(
                        'tabular-nums tracking-tight text-foreground',
                        emphasize ? 'text-2xl font-semibold' : 'text-lg font-medium',
                      )}
                      aria-label={`${supportStatusLabel(status)}: ${formatElectionNumber(count)}`}
                    >
                      {formatElectionNumber(count)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </>
        ) : (
          <Empty className="border bg-muted/20 py-6">
            <EmptyHeader>
              <EmptyTitle>Nenhuma liderança cadastrada</EmptyTitle>
              <EmptyDescription>
                Cadastre lideranças nos núcleos para acompanhar quem está engajado, a abordar ou em
                disputa.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href="/campanha/nucleos">Ir para núcleos</Link>
            </Button>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
