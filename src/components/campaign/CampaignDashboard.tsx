import { ArrowRightIcon, MapPinIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignMetricStrip } from '@/components/campaign/CampaignMetricStrip'
import {
  CampaignPageShell,
  campaignPrioritySurfaceClassName,
} from '@/components/campaign/CampaignPageShell'
import { RecentlyVisitedCard } from '@/components/campaign/RecentlyVisitedCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { CampaignDashboardView } from '@/utilities/campaignDashboardData'

const voteFormatter = new Intl.NumberFormat('pt-BR')
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const CampaignDashboard = ({
  view,
  userName,
}: {
  view: CampaignDashboardView
  userName: string
}) => {
  if (view.kind === 'leader') {
    return (
      <CampaignPageShell>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {userName}</h1>
          <p className="text-muted-foreground">
            Suas Praças e os votos que você declarou para a campanha.
          </p>
        </header>

        {view.plazas.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {view.plazas.map((plaza) => (
              <li key={plaza.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="font-medium">{plaza.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plaza.declaredVotes == null
                    ? 'Você ainda não declarou votos nesta Praça.'
                    : `Você declarou ${voteFormatter.format(plaza.declaredVotes)} votos.`}
                </p>
                <Button asChild variant="outline" className="min-h-11 self-start">
                  <Link href={`/campanha/pracas/${plaza.slug}`}>
                    {plaza.declaredVotes == null ? 'Declarar votos' : 'Abrir Praça'}
                    <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
            Você ainda não está vinculada a nenhuma Praça. Fale com a assessoria da campanha.
          </p>
        )}
      </CampaignPageShell>
    )
  }

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {userName}</h1>
        <p className="text-muted-foreground">
          {view.role === 'coordinator'
            ? 'Quadro geral da campanha por Praça.'
            : 'Quadro das Praças sob sua assessoria.'}
        </p>
      </header>

      <section
        aria-label="Indicadores das Praças"
        className={`rounded-xl ${campaignPrioritySurfaceClassName}`}
      >
        <CampaignMetricStrip
          metrics={[
            {
              label: 'Votos estimados',
              value: view.staffVoteTotal > 0 ? voteFormatter.format(view.staffVoteTotal) : '—',
              emphasize: true,
            },
            {
              label: 'Cobertura de assessoria',
              value: `${view.withAdvisorCount} de ${view.plazaCount} Praças`,
              progress:
                view.plazaCount > 0
                  ? Math.round((view.withAdvisorCount / view.plazaCount) * 100)
                  : undefined,
            },
            {
              label: 'Declarações sem estimativa',
              value: voteFormatter.format(view.missingEstimateCount),
            },
          ]}
        />
      </section>

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
                      {item.plazaName} · declarou {voteFormatter.format(item.declaredVotes)} votos
                    </span>
                  </div>
                  <Button asChild variant="ghost" className="min-h-11 shrink-0">
                    <Link href={`/campanha/pracas/${item.plazaSlug}`}>Revisar</Link>
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
                    <span className="truncate font-medium">{update.plazaName}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {update.authorName} · {dateTimeFormatter.format(new Date(update.createdAt))}
                    </span>
                  </div>
                  <Button asChild variant="ghost" className="min-h-11 shrink-0">
                    <Link href={`/campanha/pracas/${update.plazaSlug}?tab=updates`}>Abrir</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
          )}
        </section>
      </div>

      {view.priorityPlazas.length ? (
        <section aria-labelledby="dashboard-priority-title" className="flex flex-col gap-3">
          <h2 id="dashboard-priority-title" className="text-base font-medium">
            Praças prioritárias
          </h2>
          <ul className="flex flex-wrap gap-2">
            {view.priorityPlazas.map((plaza) => (
              <li key={plaza.slug}>
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={`/campanha/pracas/${plaza.slug}`}>{plaza.name}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RecentlyVisitedCard now={new Date()} />

      <div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/pracas">
            Ver todas as Praças
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </CampaignPageShell>
  )
}
