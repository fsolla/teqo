import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/Progress'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import type { NucleusListOverviewViewModel } from '@/utilities/nucleusListOverviewViewModels'
import { nucleusUpdateKindLabels } from '@/utilities/nucleusUpdateUi'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const relativeDateLabel = (value: string, now: Date): string => {
  const days = Math.floor((new Date(value).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return relativeFormatter.format(days, 'day')
}

export const NucleusListOverview = ({
  view,
  now,
}: {
  view: NucleusListOverviewViewModel
  now: Date
}) => (
  <section aria-labelledby="nucleus-list-overview" className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h2 id="nucleus-list-overview" className="sr-only">
        Visão geral dos núcleos filtrados
      </h2>
      <p className="text-sm text-muted-foreground">
        Mostrando agregados de{' '}
        <strong className="font-medium text-foreground tabular-nums">
          {numberFormatter.format(view.totalFiltered)}
        </strong>{' '}
        {view.totalFiltered === 1 ? 'núcleo filtrado' : 'núcleos filtrados'}
      </p>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>Estimativa de votos</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {numberFormatter.format(view.estimate.confirmedTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{view.estimate.confirmedPercent}% com estimativa confirmada</span>
              <span className="text-muted-foreground">
                {numberFormatter.format(view.estimate.confirmedCount)} confirmadas ·{' '}
                {numberFormatter.format(view.estimate.unconfirmedCount)} pendentes
              </span>
            </div>
            <Progress
              value={view.estimate.confirmedPercent}
              aria-label={`Estimativa confirmada: ${view.estimate.confirmedPercent}%`}
            />
          </div>
          {view.estimate.pendingSuggestionsCount ? (
            <Badge variant="estimate-pending" className="w-fit">
              {numberFormatter.format(view.estimate.pendingSuggestionsCount)}{' '}
              {view.estimate.pendingSuggestionsCount === 1
                ? 'sugestão pendente'
                : 'sugestões pendentes'}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Cobertura</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{view.coverage.percent}%</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress
            value={view.coverage.percent}
            aria-label={`Cobertura com coordenador: ${view.coverage.percent}%`}
          />
          <p className="text-sm text-muted-foreground">
            {numberFormatter.format(view.coverage.coordinatedCount)} de{' '}
            {numberFormatter.format(view.totalFiltered)} com coordenador
          </p>
        </CardContent>
      </Card>

      {view.baseline2022 ? (
        <Card>
          <CardHeader>
            <CardDescription>Baseline 2022</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {view.baseline2022.gapTotal === null
                ? '—'
                : `${view.baseline2022.gapTotal >= 0 ? '+' : ''}${numberFormatter.format(view.baseline2022.gapTotal)}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {view.baseline2022.gapTotal === null
                ? 'Sem estimativas comparáveis ao patamar de 2022'
                : view.baseline2022.gapTotal >= 0
                  ? 'votos acima do patamar'
                  : 'votos abaixo do patamar'}
            </p>
            <p className="text-sm">
              <span className="font-semibold text-[color:var(--estimate-confirmed-foreground)]">
                {numberFormatter.format(view.baseline2022.above)} acima
              </span>
              {' · '}
              <span className="font-semibold text-[color:var(--estimate-pending-foreground)]">
                {numberFormatter.format(view.baseline2022.below)} abaixo
              </span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Últimas atualizações</CardTitle>
      </CardHeader>
      <CardContent>
        {view.recentUpdates.length ? (
          <ul className="flex flex-col gap-3">
            {view.recentUpdates.map((update) => (
              <li
                key={update.id}
                className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{update.authorName}</span>
                  <Badge variant={update.kind === 'urgente' ? 'destructive' : 'secondary'}>
                    {nucleusUpdateKindLabels[update.kind]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {relativeDateLabel(update.createdAt, now)}
                  </span>
                </div>
                <Link
                  href={`/campanha/nucleos/${update.nucleusSlug}?tab=updates`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {update.nucleusName}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma atualização recente</p>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Próximos eventos</CardTitle>
      </CardHeader>
      <CardContent>
        {view.upcomingActionPlans.length ? (
          <ul className="flex flex-col gap-3">
            {view.upcomingActionPlans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
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
  </section>
)
