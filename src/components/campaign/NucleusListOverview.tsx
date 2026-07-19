import Link from 'next/link'

import { CampaignDataFreshness } from '@/components/campaign/CampaignDataFreshness'
import { CampaignMetricStrip, type CampaignMetric } from '@/components/campaign/CampaignMetricStrip'
import { campaignPrioritySurfaceClassName } from '@/components/campaign/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/Progress'
import { formatElectionNumber } from '@/lib/electionInsights'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import type { NucleusListOverviewViewModel } from '@/utilities/nucleusListOverviewViewModels'
import { nucleusUpdateKindLabels } from '@/utilities/nucleusUpdateUi'

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const NucleusListOverview = ({
  view,
  now,
}: {
  view: NucleusListOverviewViewModel
  now: Date
}) => {
  const secondaryMetrics: CampaignMetric[] = [
    {
      label: 'Cobertura com coordenador',
      value: `${view.coverage.percent}%`,
      progress: view.coverage.percent,
    },
    {
      label: 'Meta regular 2026',
      value: numberFormatter.format(view.voteGoals.regular),
    },
  ]

  return (
    <section aria-labelledby="nucleus-list-overview" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
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
        <CampaignDataFreshness asOf={now} />
      </div>

      <Card className={campaignPrioritySurfaceClassName}>
        <CardHeader>
          <CardDescription>Estimativa de votos (prioridade)</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums tracking-tight">
            {numberFormatter.format(view.estimate.confirmedTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          <p className="text-sm text-muted-foreground">
            {numberFormatter.format(view.coverage.coordinatedCount)} de{' '}
            {numberFormatter.format(view.totalFiltered)} com coordenador
            {view.highPriorityCount > 0
              ? ` · ${numberFormatter.format(view.highPriorityCount)} prioritários`
              : ''}
          </p>
          {view.baseline2022 && view.baseline2022.gapTotal !== null ? (
            <p className="text-sm text-muted-foreground">
              Baseline 2022:{' '}
              <span className="font-medium text-estimate-confirmed-foreground">
                {numberFormatter.format(view.baseline2022.above)} acima
              </span>
              {' · '}
              <span className="font-medium text-estimate-pending-foreground">
                {numberFormatter.format(view.baseline2022.below)} abaixo
              </span>
              {' · '}
              <span className="tabular-nums">
                {view.baseline2022.gapTotal >= 0 ? '+' : ''}
                {numberFormatter.format(view.baseline2022.gapTotal)} gap
              </span>
            </p>
          ) : null}
          {view.trend ? (
            <p className="text-sm text-muted-foreground">
              Tendência:{' '}
              <span className="font-medium text-estimate-confirmed-foreground">
                {formatElectionNumber(view.trend.increase)} aumento
              </span>
              {' · '}
              <span className="font-medium text-foreground">
                {formatElectionNumber(view.trend.stable)} mantém
              </span>
              {' · '}
              <span className="font-medium text-estimate-pending-foreground">
                {formatElectionNumber(view.trend.decline)} queda
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Demais indicadores</h3>
        <CampaignMetricStrip className="sm:grid-cols-2" metrics={secondaryMetrics} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Últimas atualizações</CardTitle>
          </CardHeader>
          <CardContent>
            {view.recentUpdates.length ? (
              <ul className="flex flex-col gap-2">
                {view.recentUpdates.map((update) => (
                  <li
                    key={update.id}
                    className="flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{update.authorName}</span>
                      <Badge variant={update.kind === 'urgente' ? 'destructive' : 'secondary'}>
                        {nucleusUpdateKindLabels[update.kind]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeAge(new Date(update.createdAt).getTime(), now.getTime())}
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
              <ul className="flex flex-col gap-2">
                {view.upcomingActionPlans.map((plan) => (
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
      </div>
    </section>
  )
}
