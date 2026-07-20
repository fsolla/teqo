import {
  AlertTriangleIcon,
  ClipboardListIcon,
  MessageCircleIcon,
  PlusIcon,
  UserRoundPlusIcon,
} from 'lucide-react'
import Link from 'next/link'

import { CampaignDataFreshness } from '@/components/campaign/CampaignDataFreshness'
import { CampaignMetricStrip } from '@/components/campaign/CampaignMetricStrip'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { DashboardMapDynamic } from '@/components/campaign/DashboardMapDynamic'
import { GeneralDashboardTopRow } from '@/components/campaign/GeneralDashboardTopRow'
import { LeadershipStatusCard } from '@/components/campaign/LeadershipStatusCard'
import { NucleusCard } from '@/components/campaign/NucleusCard'
import { RecentlyVisited } from '@/components/campaign/RecentlyVisited'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
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
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { formatElectionNumber } from '@/lib/electionInsights'
import type {
  GeneralDashboardViewModel,
  ScopedDashboardViewModel,
} from '@/utilities/campaignDashboardViewModels'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import { buildLeadershipPanelHref } from '@/utilities/leadershipUi'
import { getCampaignScopeLabel } from '@/utilities/nucleusUi'
import { buildWhatsAppUrl } from '@/utilities/phone'

const lastUpdateLabel = (value: string | null, now: Date): string => {
  if (!value) return 'Nenhuma atualização'
  return `Última atualização ${formatRelativeAge(new Date(value).getTime(), now.getTime())}`
}

const GeneralDashboard = ({ view, now }: { view: GeneralDashboardViewModel; now: Date }) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral da campanha</h1>
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

    <GeneralDashboardTopRow
      queues={view.queues}
      upcomingPlans={view.upcomingActionPlans}
      now={now}
    />

    <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-6">
      <section aria-labelledby="campaign-kpis" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="campaign-kpis" className="text-sm font-medium text-muted-foreground">
            Indicadores
          </h2>
          <CampaignDataFreshness asOf={now} />
        </div>
        <CampaignMetricStrip
          metrics={[
            {
              label: 'Estimativas confirmadas',
              value: `${formatElectionNumber(view.kpis.confirmedVoteEstimateTotal)} votos`,
              emphasize: true,
            },
            {
              label: '% com estimativa',
              value: `${view.kpis.confirmedEstimatePercent}%`,
              progress: view.kpis.confirmedEstimatePercent,
            },
            {
              label: '% com coordenador',
              value: `${view.kpis.coordinatorCoveragePercent}%`,
              progress: view.kpis.coordinatorCoveragePercent,
            },
          ]}
        />
        <CampaignMetricStrip
          metrics={[
            {
              label: 'Núcleos ativos',
              value: formatElectionNumber(view.kpis.activeNuclei),
            },
            {
              label: 'Meta regular (soma)',
              value: `${formatElectionNumber(view.kpis.regularVoteGoalTotal)} votos`,
            },
            {
              label: 'Atualizações esta semana',
              value: formatElectionNumber(view.kpis.updatesThisWeek),
            },
          ]}
        />
        <LeadershipStatusCard supportCounts={view.supportCounts} />
      </section>

      <div className="flex flex-col gap-8 lg:sticky lg:top-6">
        <Card>
          <CardContent className="pt-6">
            <DashboardMapDynamic choropleth={view.choropleth} />
          </CardContent>
        </Card>
      </div>
    </div>
  </CampaignPageShell>
)

const CoordinatorDashboard = ({
  view,
  now,
}: {
  view: Extract<ScopedDashboardViewModel, { role: 'coordenador' }>
  now: Date
}) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-2">
      <CampaignScopeBadge>{getCampaignScopeLabel(view.role, view.cards.length)}</CampaignScopeBadge>
      <h1 className="text-2xl font-semibold tracking-tight">Sua região</h1>
      <p className="text-muted-foreground">O que precisa de atenção nos seus núcleos?</p>
    </header>

    <RecentlyVisited now={now} upcomingPlans={view.upcomingActionPlans} />

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
          <EmptyMedia variant="icon">
            <AlertTriangleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhum núcleo sob sua coordenação</EmptyTitle>
          <EmptyDescription>
            A coordenação geral ainda não atribuiu um núcleo a você. Peça que te incluam como
            coordenador no núcleo — aí a região aparece aqui.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )}
  </CampaignPageShell>
)

const LeadershipDashboard = ({
  view,
  now,
}: {
  view: Extract<ScopedDashboardViewModel, { role: 'lideranca' }>
  now: Date
}) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-2">
      <CampaignScopeBadge>{getCampaignScopeLabel(view.role, view.cards.length)}</CampaignScopeBadge>
      <h1 className="text-2xl font-semibold tracking-tight">Meus núcleos</h1>
      <p className="text-muted-foreground">
        Envie seu reporte e acompanhe a estimativa confirmada.
      </p>
    </header>

    <RecentlyVisited now={now} upcomingPlans={view.upcomingActionPlans} />

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
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1">
                {card.tseZones.map((zoneNumber) => (
                  <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
                ))}
              </div>
              <p
                className={
                  card.confirmedVoteEstimate === null
                    ? 'text-sm text-muted-foreground'
                    : 'text-base font-medium tabular-nums'
                }
              >
                {card.confirmedVoteEstimate === null
                  ? 'Sem estimativa confirmada'
                  : `${formatElectionNumber(card.confirmedVoteEstimate)} votos`}
              </p>
              {card.confirmedVoteEstimate === null ? (
                <p className="text-xs text-muted-foreground">
                  Sugira na página do núcleo; a coordenação confirma o número.
                </p>
              ) : null}
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
          <EmptyMedia variant="icon">
            <AlertTriangleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Ainda sem núcleo por aqui</EmptyTitle>
          <EmptyDescription>
            Seu acesso a um núcleo só aparece depois que a coordenação te cadastra como liderança e
            marca o apoio como engajado (participando de verdade). Peça isso ao coordenador — o
            mesmo caminho de quem entra só com o celular.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/campanha/perfil">Ver meu perfil</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            No perfil você confere seus dados de acesso enquanto a coordenação libera o núcleo.
          </p>
        </EmptyContent>
      </Empty>
    )}
  </CampaignPageShell>
)

export const CampaignDashboard = ({
  view,
  now,
}: {
  view: GeneralDashboardViewModel | ScopedDashboardViewModel
  now: Date
}) => {
  if (view.role === 'geral') return <GeneralDashboard view={view} now={now} />
  if (view.role === 'coordenador') return <CoordinatorDashboard view={view} now={now} />
  return <LeadershipDashboard view={view} now={now} />
}
