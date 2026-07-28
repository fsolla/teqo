import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

import type { ReactNode } from 'react'

import { NearestMunicipalityCard } from '@/components/campaign/dashboard/NearestMunicipalityCard'
import { RecentlyVisitedCard } from '@/components/campaign/dashboard/RecentlyVisitedCard'
import { CampaignMetricStrip } from '@/components/campaign/shared/CampaignMetricStrip'
import {
  CampaignPageShell,
  campaignPrioritySurfaceClassName,
} from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { municipalityForCode } from '@/lib/bahiaMunicipalityCodes'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { AccessibleMunicipality } from '@/lib/municipalityProximity'
import { formatVoteEstimateEndpointsLabel, voteEstimateScenarioLabels } from '@/lib/voteEstimate'
import type { StaffDashboardView } from '@/utilities/campaignDashboardData'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/goalCoverage'
import { buildMunicipalityListHref } from '@/utilities/municipalityListUrl'
import { buildMunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/**
 * B14 — one filtered-list href per city the catalog splits into zone municipalities
 * (today only Salvador), for the cities where the actor can open more than one zone.
 * Serialized here rather than in the island: the canonical list-URL builder validates
 * against the catalog and the identity-territory table, and importing it into a client
 * component added 21 KB to this route's First Load JS for a single link.
 *
 * The search term is the whole-city name, which matches every `Salvador — ZE n` row
 * and is then scoped by the list to what the actor may read.
 */
const buildZoneCityHrefs = (
  accessible: readonly AccessibleMunicipality[],
): Record<string, string> => {
  const hrefs: Record<string, string> = {}

  for (const [ibgeCode, entries] of Object.entries(buildMunicipalitiesByIbgeCode(accessible))) {
    if (entries.length < 2) continue
    const city = municipalityForCode(ibgeCode)
    if (city) hrefs[ibgeCode] = buildMunicipalityListHref({ page: 1, q: city }, 1)
  }

  return hrefs
}

export const CampaignDashboard = ({
  view,
  userName,
  mapSlot = null,
  suggestionsSlot = null,
}: {
  view: StaffDashboardView
  userName: string
  /** Server-streamed map section (composition keeps this component map-agnostic). */
  mapSlot?: ReactNode
  /** Server-streamed suggestion queue (E11) — right after the KPIs: it is the "onde ajo". */
  suggestionsSlot?: ReactNode
}) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {userName}</h1>
      <p className="text-muted-foreground">
        {view.role === 'advisor'
          ? 'Quadro dos municípios sob sua assessoria.'
          : 'Quadro geral da campanha por município.'}
      </p>
    </header>

    {mapSlot}

    <section
      aria-label="Indicadores dos municípios"
      className={`rounded-xl ${campaignPrioritySurfaceClassName}`}
    >
      <CampaignMetricStrip
        metrics={[
          {
            label: `${voteEstimateScenarioLabels.central} nos municípios`,
            value: formatElectionNumber(view.staffVoteTotalByScenario.central),
            detail: formatVoteEstimateEndpointsLabel(view.staffVoteTotalByScenario) ?? undefined,
            emphasize: true,
          },
          {
            label: 'Cobertura de assessoria',
            value: `${view.withAdvisorCount} de ${view.municipalityCount} municípios`,
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

    {suggestionsSlot}

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="dashboard-priority-title" className="text-base font-medium">
              Municípios prioritários
            </h2>
            <Badge variant="secondary">{view.highPriorityCount}</Badge>
          </div>
          {view.highPriorityCount > view.priorityMunicipalities.length ? (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href={buildMunicipalityListHref({ page: 1, priority: 'alta' }, 1)}>
                Ver todas
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0 [&>li]:mt-0">
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

    {/*
     * Navigation shortcuts. Both cards decide for themselves whether they have
     * anything to say — recent visits are empty on a fresh device, and the geo
     * card hides when the browser cannot help — so the row disappears in CSS
     * (`has-[>*]`) instead of asking the islands to report visibility upward,
     * which cost two state slots and a layout shift on every load. Two columns
     * even with a single card, keeping the width rhythm of the panels above.
     */}
    <div className="hidden gap-6 has-[>*]:grid lg:grid-cols-2">
      <NearestMunicipalityCard
        accessible={view.accessibleMunicipalities}
        zoneCityHrefs={buildZoneCityHrefs(view.accessibleMunicipalities)}
      />
      <RecentlyVisitedCard now={new Date()} />
    </div>

    <div>
      <Button asChild className="min-h-11">
        <Link href="/campanha/municipios">
          Ver todos os municípios
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  </CampaignPageShell>
)
