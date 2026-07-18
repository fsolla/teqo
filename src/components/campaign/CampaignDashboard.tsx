import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ClipboardListIcon,
  MessageCircleIcon,
  PlusIcon,
  UserRoundPlusIcon,
} from 'lucide-react'
import Link from 'next/link'

import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { NucleusCard } from '@/components/campaign/NucleusCard'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/Empty'
import { Progress } from '@/components/ui/Progress'
import { actionPlanKindLabels } from '@/lib/schemas/actionPlan'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import type {
  DashboardQueueItem,
  GeneralDashboardViewModel,
  ScopedDashboardViewModel,
} from '@/utilities/campaignDashboardViewModels'
import { buildLeadershipPanelHref } from '@/utilities/leadershipUi'
import { getCampaignScopeLabel } from '@/utilities/nucleusUi'
import { buildWhatsAppUrl } from '@/utilities/phone'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const lastUpdateLabel = (value: string | null, now: Date): string => {
  if (!value) return 'Nenhuma atualização'
  const days = Math.floor((new Date(value).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return `Última atualização ${relativeFormatter.format(days, 'day')}`
}

export const buildDashboardQueueItemHref = (
  slug: string,
  openCoordinatorAssignment: boolean,
): string => `/campanha/nucleos/${slug}${openCoordinatorAssignment ? '?assignCoordinators=1' : ''}`

const KpiCard = ({
  label,
  value,
  progress,
}: {
  label: string
  value: string
  progress?: number
}) => (
  <Card>
    <CardHeader>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
    </CardHeader>
    {progress !== undefined ? (
      <CardContent>
        <Progress value={progress} aria-label={`${label}: ${progress}%`} />
      </CardContent>
    ) : null}
  </Card>
)

const QueueList = ({
  title,
  items,
  empty,
  openCoordinatorAssignment = false,
}: {
  title: string
  items: DashboardQueueItem[]
  empty: string
  openCoordinatorAssignment?: boolean
}) => (
  <Card>
    <CardHeader className="flex-row items-center justify-between">
      <CardTitle>{title}</CardTitle>
      <Badge variant={items.length ? 'estimate-pending' : 'secondary'}>{items.length}</Badge>
    </CardHeader>
    <CardContent>
      {items.length ? (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-between">
                <Link href={buildDashboardQueueItemHref(item.slug, openCoordinatorAssignment)}>
                  <span className="min-w-0 text-left">
                    <strong className="block truncate">{item.name}</strong>
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
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </CardContent>
  </Card>
)

const UpcomingActionPlansCard = ({ plans }: { plans: ActionPlanUpcomingPreviewRecord[] }) => (
  <Card>
    <CardHeader className="flex-row items-center justify-between">
      <CardTitle>Próximos eventos</CardTitle>
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href="/campanha/planos">
          Ver todos
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </CardHeader>
    <CardContent>
      {plans.length ? (
        <ul className="flex flex-col gap-3">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
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

const GeneralDashboard = ({ view }: { view: GeneralDashboardViewModel }) => (
  <div className="mr-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Visão geral da campanha</h1>
        <p className="text-muted-foreground">Cobertura, mobilização e pendências dos núcleos.</p>
        <CampaignScopeBadge>
          {getCampaignScopeLabel('geral', view.kpis.activeNuclei)}
        </CampaignScopeBadge>
      </div>
      <Button asChild className="min-h-11">
        <Link href="/campanha/nucleos/novo">
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Novo núcleo
        </Link>
      </Button>
    </header>

    <section aria-labelledby="campaign-kpis">
      <h2 id="campaign-kpis" className="sr-only">
        Indicadores da campanha
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Núcleos ativos" value={numberFormatter.format(view.kpis.activeNuclei)} />
        <KpiCard
          label="% com coordenador"
          value={`${view.kpis.coordinatorCoveragePercent}%`}
          progress={view.kpis.coordinatorCoveragePercent}
        />
        <KpiCard
          label="Estimativas confirmadas"
          value={`${numberFormatter.format(view.kpis.confirmedVoteEstimateTotal)} votos`}
        />
        <KpiCard
          label="% com estimativa confirmada"
          value={`${view.kpis.confirmedEstimatePercent}%`}
          progress={view.kpis.confirmedEstimatePercent}
        />
        <KpiCard
          label="Atualizações esta semana"
          value={numberFormatter.format(view.kpis.updatesThisWeek)}
        />
      </div>
    </section>

    <Card>
      <CardHeader>
        <CardTitle>Lideranças por status de apoio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {leadershipSupportStatuses.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <SupportStatusBadge status={status} />
            <strong className="tabular-nums">
              {numberFormatter.format(view.supportCounts[status])}
            </strong>
          </div>
        ))}
      </CardContent>
    </Card>

    <section aria-labelledby="action-queues" className="flex flex-col gap-3">
      <h2 id="action-queues" className="text-lg font-semibold">
        Filas de ação
      </h2>
      <div className="grid gap-4 xl:grid-cols-3">
        <QueueList
          title="Sem coordenador"
          items={view.queues.withoutCoordinator}
          empty="Todos os núcleos ativos têm coordenação."
          openCoordinatorAssignment
        />
        <QueueList
          title="Sem atualização há mais de 7 dias"
          items={view.queues.withoutRecentUpdate}
          empty="Todos os núcleos estão com a cadência em dia."
        />
        <QueueList
          title="Estimativas pendentes"
          items={view.queues.pendingEstimate}
          empty="Nenhuma estimativa aguarda confirmação."
        />
      </div>
    </section>

    <UpcomingActionPlansCard plans={view.upcomingActionPlans} />
  </div>
)

const CoordinatorDashboard = ({
  view,
  now,
}: {
  view: Extract<ScopedDashboardViewModel, { role: 'coordenador' }>
  now: Date
}) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <header className="flex flex-col gap-2">
      <CampaignScopeBadge>{getCampaignScopeLabel(view.role, view.cards.length)}</CampaignScopeBadge>
      <h1 className="text-2xl font-bold tracking-tight">Sua região</h1>
      <p className="text-muted-foreground">O que precisa de atenção nos seus núcleos?</p>
    </header>

    <UpcomingActionPlansCard plans={view.upcomingActionPlans} />

    {view.cards.length ? (
      <div className="grid gap-4 lg:grid-cols-2">
        {view.cards.map((card) => (
          <NucleusCard
            key={card.id}
            name={card.name}
            territory={card.territory}
            organization={card.organization}
            tseZones={card.tseZones}
            confirmedVoteEstimate={card.confirmedVoteEstimate}
            hasPendingEstimate={card.hasPendingEstimate}
            lastUpdateLabel={lastUpdateLabel(card.lastUpdateAt, now)}
            isUpdateOverdue={card.isUpdateOverdue}
            leadershipCounts={card.leadershipCounts}
            actions={
              <>
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={buildLeadershipPanelHref(card.slug, {}, { mode: 'create' })}>
                    <UserRoundPlusIcon data-icon="inline-start" aria-hidden="true" />
                    Nova liderança
                  </Link>
                </Button>
                <Button asChild className="min-h-11">
                  <Link href={`/campanha/nucleos/${card.slug}?tab=updates&newUpdate=1`}>
                    <ClipboardListIcon data-icon="inline-start" aria-hidden="true" />
                    Nova atualização
                  </Link>
                </Button>
              </>
            }
          />
        ))}
      </div>
    ) : (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Nenhum núcleo sob sua coordenação</EmptyTitle>
          <EmptyDescription>
            A coordenação geral ainda não atribuiu um núcleo a você.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )}
  </div>
)

const LeadershipDashboard = ({
  view,
}: {
  view: Extract<ScopedDashboardViewModel, { role: 'lideranca' }>
}) => (
  <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <header className="flex flex-col gap-2">
      <CampaignScopeBadge>{getCampaignScopeLabel(view.role, view.cards.length)}</CampaignScopeBadge>
      <h1 className="text-2xl font-bold tracking-tight">Meus núcleos</h1>
      <p className="text-muted-foreground">
        Envie seu reporte e acompanhe a estimativa confirmada.
      </p>
    </header>

    <UpcomingActionPlansCard plans={view.upcomingActionPlans} />

    {view.cards.length ? (
      <div className="grid gap-4 md:grid-cols-2">
        {view.cards.map((card) => (
          <Card key={card.id}>
            <CardHeader>
              <CardTitle>{card.name}</CardTitle>
              <CardDescription>
                {[card.organization, card.territory].filter(Boolean).join(' · ')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1">
                {card.tseZones.map((zoneNumber) => (
                  <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
                ))}
              </div>
              <p>
                <strong>
                  {card.confirmedVoteEstimate === null
                    ? 'Sem estimativa confirmada'
                    : `${numberFormatter.format(card.confirmedVoteEstimate)} votos`}
                </strong>
              </p>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Coordenação</p>
                {card.coordinators.length ? (
                  card.coordinators.map((coordinator) => (
                    <div key={coordinator.name} className="flex flex-wrap items-center gap-2">
                      <span>{coordinator.name}</span>
                      {coordinator.phone ? (
                        <Button asChild size="sm" variant="outline" className="min-h-11">
                          <a
                            href={buildWhatsAppUrl(coordinator.phone)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
                            Falar no WhatsApp
                          </a>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Contato não disponível
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Coordenação não informada</span>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="min-h-11 w-full">
                <Link href={`/campanha/nucleos/${card.slug}?tab=updates&newUpdate=1`}>
                  <ClipboardListIcon data-icon="inline-start" aria-hidden="true" />
                  Enviar atualização
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    ) : (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Nenhum núcleo disponível</EmptyTitle>
          <EmptyDescription>
            Seu acesso depende de um vínculo engajado com o núcleo.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AlertTriangleIcon aria-hidden="true" />
        </EmptyContent>
      </Empty>
    )}
  </div>
)

export const CampaignDashboard = ({
  view,
  now,
}: {
  view: GeneralDashboardViewModel | ScopedDashboardViewModel
  now: Date
}) => {
  if (view.role === 'geral') return <GeneralDashboard view={view} />
  if (view.role === 'coordenador') return <CoordinatorDashboard view={view} now={now} />
  return <LeadershipDashboard view={view} />
}
