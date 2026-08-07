import config from '@payload-config'
import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
  CampaignTransitionAnchor,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignListSheetProvider } from '@/components/campaign/shared/CampaignListSheetHost'
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
import { StateDeputyAdvisorRelationCell } from '@/components/campaign/stateDeputy/StateDeputyAdvisorRelationCell'
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
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { cn } from '@/lib/utils'
import { getAdvisorMunicipalityIds, isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadEligibleAdvisorOptions,
  loadLeadershipOptions,
} from '@/utilities/campaignRelationOptions'
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
  setStateDeputyAdvisorMembershipFormAction,
  setStateDeputyMunicipalitiesFormAction,
  updateStateDeputyContactFormAction,
  updateStateDeputyPartyFormAction,
} from './formActions'

export const metadata = campaignPageMetadataFromCatalog('dobradinhas')

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
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="stateDeputyId"
        field="name"
        value={row.name}
        label="Nome"
        formAction={updateStateDeputyContactFormAction}
        href={`/campanha/dobradinhas/${row.id}`}
        editTrigger="cell"
        saveOnChange={false}
      />
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
    cellClassName: 'min-w-32',
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="stateDeputyId"
        field="party"
        value={row.party}
        label="Partido"
        formAction={updateStateDeputyPartyFormAction}
        editTrigger="cell"
        saveOnChange={false}
      />
    ),
  },
  {
    id: 'email',
    label: 'E-mail',
    cellClassName: 'max-w-56',
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="stateDeputyId"
        field="email"
        value={row.email}
        label="E-mail"
        formAction={updateStateDeputyContactFormAction}
        editTrigger="cell"
        saveOnChange={false}
      />
    ),
  },
  {
    id: 'phone',
    label: 'Telefone',
    cellClassName: 'min-w-40',
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="stateDeputyId"
        field="phone"
        value={row.phone}
        label="Telefone"
        formAction={updateStateDeputyContactFormAction}
        editTrigger="cell"
        saveOnChange={false}
      />
    ),
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
  {
    id: 'advisors',
    label: 'Assessores',
    // No `description` here: `CampaignTableHead`'s hover tooltip
    // (`CampaignHoverTooltip`) plus `StateDeputyAdvisorRelationCell` on this
    // list breaks production SSR with "Element type is invalid … undefined".
    // Municípios keeps its tooltip; Assessores relies on the cell chrome.
    head: <CampaignTableHead>Assessores</CampaignTableHead>,
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

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveStateDeputyListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const columnVisibility = await readCampaignColumnVisibility('dobradinhas')
  const isLeadershipVisible = !columnVisibility.hiddenColumnIds.includes('leaderships')
  const isAdvisorsVisible = !columnVisibility.hiddenColumnIds.includes('advisors')
  // Advisor assignment is unrestricted-only (B156); the rest of staff reads.
  const canEditAdvisors = isCampaignUnrestricted(user)

  const [
    { rows, totalDocs, totalPages, filterFacets },
    leadershipOptions,
    advisorOptions,
    municipalityIndex,
    administeredIds,
  ] = await Promise.all([
    loadStateDeputyListPageData(payload, user, canonicalUrl.state),
    isLeadershipVisible ? loadLeadershipOptions(payload, user) : Promise.resolve([]),
    isAdvisorsVisible && canEditAdvisors
      ? loadEligibleAdvisorOptions(payload, user)
      : Promise.resolve([]),
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
    advisorOptions.map((option) => ({
      id: option.id,
      searchLabel: option.name,
      item: {
        id: option.id,
        label: option.name,
        href: `/campanha/assessores/${option.id}`,
      },
    })),
    canEditAdvisors,
    municipalityIndex,
    administeredIds ? new Set(administeredIds) : undefined,
  )

  return (
    <CampaignPageShell>
      <div className="flex justify-end">
        <Button asChild className="min-h-11">
          <Link href="/campanha/dobradinhas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova dobradinha
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <StateDeputyFilters
          state={state}
          partyOptions={partyFilterOptions}
          hasNoParty={filterFacets.hasNoParty}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(columns)}
            />
          }
        />

        <CampaignListResults>
          {/* One shared Drawer for every chip-cell sheet on coarse pointers
              (miss #52 — never a Drawer root per opened cell). */}
          <CampaignListSheetProvider>
            <CampaignTable
              caption={`${sortSummary}. Deputados estaduais com quem a campanha dobra.`}
              columns={columns}
              columnVisibility={columnVisibility}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<StateDeputyListEmptyState state={state} />}
            />
          </CampaignListSheetProvider>
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
