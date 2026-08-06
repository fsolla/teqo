'use client'

import { SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback } from 'react'

import {
  setLeadershipStateDeputyMembershipFormAction,
  setStateDeputyAdvisorMembershipFormAction,
  setStateDeputyMunicipalitiesFormAction,
} from '@/app/(campaign)/campanha/(app)/dobradinhas/formActions'
import { fetchNextStateDeputyListPage } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignInfiniteTable } from '@/components/campaign/shared/CampaignInfiniteTable'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignListSheetProvider } from '@/components/campaign/shared/CampaignListSheetHost'
import {
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import {
  LeadershipStateDeputyRelationCell,
  type RelationCellOption,
} from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { StateDeputyAdvisorRelationCell } from '@/components/campaign/stateDeputy/StateDeputyAdvisorRelationCell'
import { StateDeputyFilters } from '@/components/campaign/stateDeputy/StateDeputyFilters'
import { StateDeputySortableHead } from '@/components/campaign/stateDeputy/StateDeputySortableHead'
import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import {
  toCampaignColumnPickerColumns,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { cn } from '@/lib/utils'
import type { StateDeputyRowViewModel } from '@/utilities/stateDeputyData'
import {
  buildStateDeputyFilterHref,
  clearStateDeputyListFilters,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {

const rowKeyById = <T extends { id: string | number }>(row: T) => row.id
  stateDeputyListSortLabels,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

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

// B161 — columns are client-defined now (appended rows render here, not in RSC).
const stateDeputyColumns = (
  state: StateDeputyListState,
  partyFilterOptions: StateDeputyFilterOption[],
  hasNoPartyOption: boolean,
  leadershipOptions: RelationCellOption[],
  advisorOptions: RelationCellOption[],
  canEditAdvisors: boolean,
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
    responsiveClassName: 'hidden @min-[66rem]/state-deputy-list:table-cell',
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
  {
    id: 'advisors',
    label: 'Assessores',
    responsiveClassName: 'hidden @min-[78rem]/state-deputy-list:table-cell',
    // No `description` here (#386): `CampaignTableHead`'s hover tooltip plus
    // `StateDeputyAdvisorRelationCell` breaks production SSR on this list.
    head: (
      <CampaignTableHead className="hidden @min-[78rem]/state-deputy-list:table-cell">
        Assessores
      </CampaignTableHead>
    ),
    cellClassName: 'max-w-72 whitespace-normal',
    cell: (row) => (
      <StateDeputyAdvisorRelationCell
        stateDeputyId={row.id}
        stateDeputyName={row.name}
        advisors={row.advisors}
        options={canEditAdvisors ? advisorOptions : []}
        membershipAction={setStateDeputyAdvisorMembershipFormAction}
        readOnly={!canEditAdvisors}
      />
    ),
  },
]

export const StateDeputyListTable = ({
  rows,
  totalDocs,
  pageSize,
  state,
  query,
  columnVisibility,
  partyFilterOptions,
  hasNoParty,
  leadershipOptions,
  advisorOptions,
  canEditAdvisors,
  municipalityIndex,
  addableMunicipalityIds,
  sortSummary,
}: {
  rows: readonly StateDeputyRowViewModel[]
  totalDocs: number
  pageSize: number
  state: StateDeputyListState
  /** Canonical filter/sort query (no page): the incremental-load signature. */
  query: string
  columnVisibility: CampaignColumnVisibility
  partyFilterOptions: StateDeputyFilterOption[]
  hasNoParty: boolean
  leadershipOptions: RelationCellOption[]
  advisorOptions: RelationCellOption[]
  canEditAdvisors: boolean
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  addableMunicipalityIds?: readonly number[]
  sortSummary: string
}) => {
  const columns = stateDeputyColumns(
    state,
    partyFilterOptions,
    hasNoParty,
    leadershipOptions,
    advisorOptions,
    canEditAdvisors,
    municipalityIndex,
    addableMunicipalityIds ? new Set(addableMunicipalityIds) : undefined,
  )
  const fetchNextPage = useCallback(
    (page: number) => fetchNextStateDeputyListPage(query, page),
    [query],
  )

  return (
    <CampaignListSheetProvider>
      <CampaignInfiniteTable
        dataContainer="state-deputy-list"
        className="@container/state-deputy-list"
        columns={columns}
        columnVisibility={columnVisibility}
        rows={rows}
        rowKey={rowKeyById}
        totalDocs={totalDocs}
        pageSize={pageSize}
        query={query}
        fetchNextPage={fetchNextPage}
        caption={`${sortSummary}. Deputados estaduais com quem a campanha dobra.`}
        controls={
          <StateDeputyFilters
            state={state}
            totalDocs={totalDocs}
            partyOptions={partyFilterOptions}
            hasNoParty={hasNoParty}
            trailing={
              <CampaignColumnPickerTrailing
                columnVisibility={columnVisibility}
                columns={toCampaignColumnPickerColumns(columns)}
              />
            }
          />
        }
        empty={<StateDeputyListEmptyState state={state} />}
      />
    </CampaignListSheetProvider>
  )
}
