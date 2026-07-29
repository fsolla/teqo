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
import {
  LeadershipStateDeputyRelationCell,
  type RelationCellOption,
} from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
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
import { resolveVisibleColumns } from '@/lib/campaignColumnVisibility'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { cn } from '@/lib/utils'
import { getAdvisorMunicipalityIds } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadLeadershipOptions } from '@/utilities/campaignRelationOptions'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import {
  loadStateDeputyListPageData,
  type StateDeputyRowViewModel,
} from '@/utilities/stateDeputyData'
import {
  buildStateDeputyFilterHref,
  clearStateDeputyListFilters,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {
  buildStateDeputyListHref,
  formatStateDeputyListSortSummary,
  resolveStateDeputyListSort,
  resolveStateDeputyListUrl,
  stateDeputyListSortLabels,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

import {
  setLeadershipStateDeputyMembershipFormAction,
  setStateDeputyMunicipalitiesFormAction,
} from './formActions'

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
        href={buildStateDeputyFilterHref(clearStateDeputyListFilters(state))}
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
  leadershipOptions: RelationCellOption[],
  municipalityIndex: MunicipalityPortfolioIndexEntry[],
  addableMunicipalityIds: ReadonlySet<number> | undefined,
): Array<CampaignTableColumn<StateDeputyRowViewModel>> => [
  {
    id: 'name',
    label: stateDeputyListSortLabels.name,
    mandatory: true,
    head: <StateDeputySortableHead state={state} sortKey="name" />,
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
    label: stateDeputyListSortLabels.party,
    head: (
      <StateDeputySortableHead
        state={state}
        sortKey="party"
        filterOptions={partyFilterOptions}
        hasNoPartyOption={hasNoPartyOption}
      />
    ),
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.party ?? '—',
  },
  {
    id: 'municipalities',
    label: 'Municípios',
    head: (
      <CampaignTableHead description="Edite aqui: passe o mouse em um chip para remover, ou busque para adicionar. Um território ou ZE entra e sai como um bloco.">
        Municípios
      </CampaignTableHead>
    ),
    cellClassName: 'max-w-64 whitespace-normal',
    cell: (row) => (
      <MunicipalityPortfolioCell
        ownerId={row.id}
        ownerName={row.name}
        municipalityIds={row.municipalityIDs}
        municipalityIndex={municipalityIndex}
        {...(addableMunicipalityIds ? { addableIds: addableMunicipalityIds } : {})}
        commitAction={setStateDeputyMunicipalitiesFormAction}
        drawerTitle="Municípios da dobradinha"
        updateErrorMessage="Não foi possível atualizar os municípios."
      />
    ),
  },
  {
    id: 'leaderships',
    label: 'Lideranças',
    cellClassName: 'max-w-72 whitespace-normal',
    cell: (row) => (
      <LeadershipStateDeputyRelationCell
        direction="fromStateDeputy"
        fixedId={row.id}
        ownerName={row.name}
        items={row.leaderships.map((leadership) => ({
          id: leadership.id,
          label: leadership.name,
          href: `/campanha/liderancas/${leadership.id}`,
        }))}
        options={leadershipOptions}
        membershipAction={setLeadershipStateDeputyMembershipFormAction}
      />
    ),
  },
]

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveStateDeputyListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const columnVisibility = await readCampaignColumnVisibility('dobradinhas')
  const isLeadershipVisible =
    resolveVisibleColumns([{ id: 'leaderships' }], columnVisibility.hiddenColumnIds).length > 0

  const [
    { rows, totalDocs, totalPages, filterFacets },
    leadershipOptions,
    municipalityIndex,
    administeredIds,
  ] = await Promise.all([
    loadStateDeputyListPageData(payload, user, canonicalUrl.state),
    isLeadershipVisible ? loadLeadershipOptions(payload, user) : Promise.resolve([]),
    loadMunicipalityPortfolioIndex(),
    user.role === 'advisor' ? getAdvisorMunicipalityIds(payload, user.id) : null,
  ])
  const resolvedUrl = resolveStateDeputyListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const { sort, dir } = resolveStateDeputyListSort(state)
  const sortSummary = formatStateDeputyListSortSummary(sort, dir)
  const partyFilterOptions = filterFacets.parties.map((party) => ({ value: party, label: party }))
  const columns = stateDeputyColumns(
    state,
    partyFilterOptions,
    filterFacets.hasNoParty,
    leadershipOptions.map((option) => ({
      id: option.id,
      searchLabel: option.name,
      item: {
        id: option.id,
        label: option.name,
        href: `/campanha/liderancas/${option.id}`,
      },
    })),
    municipalityIndex,
    administeredIds ? new Set(administeredIds) : undefined,
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dobradinhas</h1>
          <p className="text-muted-foreground">
            Deputados estaduais com quem a campanha dobra — vincule lideranças e municípios direto
            na lista.
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
            columns={columns}
            columnVisibility={columnVisibility}
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
