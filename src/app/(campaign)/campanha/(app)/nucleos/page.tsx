import type { ElectoralNucleus } from '@/payload-types'
import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { NucleusFilters } from '@/components/campaign/NucleusFilters'
import { NucleusList } from '@/components/campaign/NucleusList'
import { NucleusListOverview } from '@/components/campaign/NucleusListOverview'
import { RecentVisitTracker } from '@/components/campaign/RecentVisitTracker'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadNucleusListOverviewData } from '@/utilities/nucleusListOverviewPageData'
import { loadNucleusListPageData } from '@/utilities/nucleusPageData'
import {
  buildNucleusFiltersKey,
  buildNucleusListHref,
  buildNucleusListVisitHref,
  buildNucleusListVisitLabel,
  getCampaignScopeLabel,
  resolveNucleusListUrl,
} from '@/utilities/nucleusUi'
import { toNucleusListViewModel } from '@/utilities/nucleusViewModels'

type NucleiPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NucleiPage({ searchParams }: NucleiPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveNucleusListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) return null

  const now = new Date()
  const [{ result, scope }, overview] = await Promise.all([
    loadNucleusListPageData(payload, user, rawSearchParams),
    loadNucleusListOverviewData(payload, user, canonicalUrl.state, now),
  ])
  const resolvedUrl = resolveNucleusListUrl(rawSearchParams, result.totalPages)

  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const listVisitLabel = buildNucleusListVisitLabel(state)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Núcleos Eleitorais</h1>
          <p className="text-muted-foreground">
            Núcleo é a operação da campanha; Zona TSE é a circunscrição oficial.
          </p>
          <CampaignScopeBadge>
            {getCampaignScopeLabel(user.role, scope.totalDocs)}
          </CampaignScopeBadge>
        </div>
        {user.role === 'geral' ? (
          <Button asChild className="min-h-11">
            <Link href="/campanha/nucleos/novo">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Novo núcleo
            </Link>
          </Button>
        ) : null}
      </header>

      <NucleusFilters key={buildNucleusFiltersKey(state)} state={state} />

      {result.docs.length ? (
        <>
          {overview ? <NucleusListOverview view={overview} now={now} /> : null}
          <NucleusList
            nuclei={result.docs.map((nucleus) =>
              toNucleusListViewModel(nucleus as ElectoralNucleus),
            )}
          />
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {result.totalDocs}{' '}
              {result.totalDocs === 1 ? 'núcleo encontrado' : 'núcleos encontrados'}
            </p>
            <CampaignListPagination
              page={state.page}
              totalPages={result.totalPages}
              hrefForPage={(page) => buildNucleusListHref(state, page)}
            />
          </div>
        </>
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Nenhum núcleo encontrado</EmptyTitle>
            <EmptyDescription>
              Ajuste a busca ou os filtros. Você só vê núcleos dentro do seu escopo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/campanha/nucleos">Limpar busca e filtros</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {listVisitLabel ? (
        <RecentVisitTracker
          entry={{
            href: buildNucleusListVisitHref(state),
            label: listVisitLabel,
            kind: 'nucleusList',
          }}
        />
      ) : null}
    </CampaignPageShell>
  )
}
