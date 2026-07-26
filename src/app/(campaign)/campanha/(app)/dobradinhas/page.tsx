import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
  CampaignTransitionAnchor,
} from '@/components/campaign/shared/CampaignListPending'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyFilters } from '@/components/campaign/stateDeputy/StateDeputyFilters'
import { StateDeputySortableHead } from '@/components/campaign/stateDeputy/StateDeputySortableHead'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { cn } from '@/lib/utils'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  loadStateDeputyListPageData,
  type StateDeputyRowViewModel,
} from '@/utilities/stateDeputyData'
import {
  clearStateDeputyListFilters,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {
  buildStateDeputyListHref,
  formatStateDeputyListSortSummary,
  resolveStateDeputyListSort,
  resolveStateDeputyListUrl,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

type StateDeputiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const StateDeputyListEmptyState = ({ state }: { state: StateDeputyListState }) => (
  <Empty className="min-h-56">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhuma dobradinha encontrada</EmptyTitle>
      <EmptyDescription>
        Ajuste a busca ou os filtros para encontrar as dobradinhas.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      {/* Same contract as the filter bar's Limpar: drop filters, keep the sort. */}
      <CampaignTransitionAnchor
        href={buildStateDeputyListHref(clearStateDeputyListFilters(state), 1)}
        replace
        scroll={false}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
      >
        Limpar busca e filtros
      </CampaignTransitionAnchor>
    </EmptyContent>
  </Empty>
)

const stateDeputyColumns = (
  state: StateDeputyListState,
  partyFilterOptions: StateDeputyFilterOption[],
  hasNoPartyOption: boolean,
): Array<CampaignTableColumn<StateDeputyRowViewModel>> => [
  {
    id: 'name',
    mandatory: true,
    head: (
      <StateDeputySortableHead state={state} sortKey="name">
        Nome
      </StateDeputySortableHead>
    ),
    cell: (row) => (
      <Link
        href={`/campanha/dobradinhas/${row.slug}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'party',
    head: (
      <StateDeputySortableHead
        state={state}
        sortKey="party"
        filterOptions={partyFilterOptions}
        hasNoPartyOption={hasNoPartyOption}
      >
        Partido
      </StateDeputySortableHead>
    ),
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.party ?? '—',
  },
  {
    id: 'municipalities',
    head: <CampaignTableHead>Municípios</CampaignTableHead>,
    cellClassName: 'tabular-nums',
    cell: (row) => row.municipalityCount,
  },
  {
    id: 'leaderships',
    head: <CampaignTableHead>Lideranças</CampaignTableHead>,
    cellClassName: 'tabular-nums',
    cell: (row) => row.leadershipCount,
  },
]

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveStateDeputyListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const { rows, totalDocs, totalPages, filterFacets } = await loadStateDeputyListPageData(
    payload,
    user,
    canonicalUrl.state,
  )
  const resolvedUrl = resolveStateDeputyListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const { sort, dir } = resolveStateDeputyListSort(state)
  const sortSummary = formatStateDeputyListSortSummary(sort, dir)
  const partyFilterOptions = filterFacets.parties.map((party) => ({ value: party, label: party }))

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dobradinhas</h1>
          <p className="text-muted-foreground">
            Deputados estaduais com quem a campanha dobra — vincule a municípios e lideranças nas
            fichas correspondentes.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/dobradinhas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova dobradinha
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <StateDeputyFilters
          state={state}
          partyOptions={partyFilterOptions}
          hasNoParty={filterFacets.hasNoParty}
        />

        <CampaignListResults>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {sortSummary}
          </p>
          <CampaignTable
            caption={`${sortSummary}. Deputados estaduais com quem a campanha dobra.`}
            columns={stateDeputyColumns(state, partyFilterOptions, filterFacets.hasNoParty)}
            rows={rows}
            rowKey={(row) => row.id}
            empty={<StateDeputyListEmptyState state={state} />}
          />
          {rows.length ? (
            <CampaignListFooter
              totalDocs={totalDocs}
              singular="dobradinha"
              plural="dobradinhas"
              page={state.page}
              totalPages={totalPages}
              hrefForPage={(page) => buildStateDeputyListHref(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
