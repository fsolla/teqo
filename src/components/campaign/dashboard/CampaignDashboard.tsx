import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import type { ReactNode } from 'react'

import { CampaignMetricStrip } from '@/components/campaign/shared/CampaignMetricStrip'
import {
  CampaignPageShell,
  campaignPrioritySurfaceClassName,
} from '@/components/campaign/shell/CampaignPageShell'
import { RecentlyVisitedCard } from '@/components/campaign/dashboard/RecentlyVisitedCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { StaffDashboardView } from '@/utilities/campaignDashboardData'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/goalCoverage'
import {
  formatVoteEstimateEndpointsLabel,
  voteEstimateScenarioLabels,
} from '@/lib/voteEstimate'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const CampaignDashboard = ({
  view,
  userName,
  mapSlot = null,
  territorySlot = null,
}: {
  view: StaffDashboardView
  userName: string
  /** Server-streamed map section (composition keeps this component map-agnostic). */
  mapSlot?: ReactNode
  /** Server-streamed Territórios de Identidade comparative table (E17). */
  territorySlot?: ReactNode
}) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {userName}</h1>
      <p className="text-muted-foreground">
        {view.role === 'advisor'
          ? 'Quadro das Praças sob sua assessoria.'
          : 'Quadro geral da campanha por Praça.'}
      </p>
    </header>

    {mapSlot}

    <section
      aria-label="Indicadores das Praças"
      className={`rounded-xl ${campaignPrioritySurfaceClassName}`}
    >
      <CampaignMetricStrip
        metrics={[
          {
            label: `${voteEstimateScenarioLabels.central} nas Praças`,
            value: formatElectionNumber(view.staffVoteTotalByScenario.central),
            detail: formatVoteEstimateEndpointsLabel(view.staffVoteTotalByScenario) ?? undefined,
            emphasize: true,
          },
          {
            label: 'Cobertura de assessoria',
            value: `${view.withAdvisorCount} de ${view.municipalityCount} Praças`,
            progress:
              view.municipalityCount > 0
                ? Math.round((view.withAdvisorCount / view.municipalityCount) * 100)
                : undefined,
          },
          {
            label: 'Cobertura da meta',
            value: formatGoalCoverageRatioLabel(view.goalCoverage),
            detail: formatGoalCoverageDeficitLabel(view.goalCoverage),
            progress: goalCoverageProgressPercent(view.goalCoverage),
          },
          {
            label: 'Declarações sem estimativa',
            value: formatElectionNumber(view.missingEstimateCount),
          },
        ]}
      />
    </section>

    {territorySlot}

    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="dashboard-missing-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="dashboard-missing-title" className="text-base font-medium">
            Declarações aguardando estimativa
          </h2>
          <Badge variant="estimate-pending">{view.missingEstimateCount}</Badge>
        </div>
        {view.missingEstimates.length ? (
          <ul className="flex flex-col gap-2">
            {view.missingEstimates.map((item) => (
              <li key={item.pledgeID} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{item.contactName}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {item.municipalityName} · declarou {formatElectionNumber(item.declaredVotes)}{' '}
                    votos
                  </span>
                </div>
                <Button asChild variant="ghost" className="min-h-11 shrink-0">
                  <Link href={`/campanha/municipios/${item.municipalitySlug}`}>Revisar</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todas as declarações do seu escopo têm estimativa registrada.
          </p>
        )}
      </section>

      <section
        aria-labelledby="dashboard-updates-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <h2 id="dashboard-updates-title" className="text-base font-medium">
          Últimas atualizações de campo
        </h2>
        {view.recentUpdates.length ? (
          <ul className="flex flex-col gap-2">
            {view.recentUpdates.map((update) => (
              <li key={update.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{update.municipalityName}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {update.authorName} · {dateTimeFormatter.format(new Date(update.createdAt))}
                  </span>
                </div>
                <Button asChild variant="ghost" className="min-h-11 shrink-0">
                  <Link href={`/campanha/municipios/${update.municipalitySlug}?tab=updates`}>
                    Abrir
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
        )}
      </section>
    </div>

    {view.priorityMunicipalities.length ? (
      <section aria-labelledby="dashboard-priority-title" className="flex flex-col gap-3">
        <h2 id="dashboard-priority-title" className="text-base font-medium">
          Praças prioritárias
        </h2>
        <ul className="flex flex-wrap gap-2">
          {view.priorityMunicipalities.map((municipality) => (
            <li key={municipality.slug}>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/campanha/municipios/${municipality.slug}`}>{municipality.name}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    ) : null}

    <RecentlyVisitedCard now={new Date()} />

    <div>
      <Button asChild className="min-h-11">
        <Link href="/campanha/municipios">
          Ver todas as Praças
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  </CampaignPageShell>
)
