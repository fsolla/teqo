'use client'

import { MessageCircleIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useRef } from 'react'

import {
  setLeadershipMunicipalitiesFormAction,
  setLeadershipStateDeputyMembershipFormAction,
} from '@/app/(campaign)/campanha/(app)/liderancas/formActions'
import { fetchNextLeadershipListPage } from '@/app/(campaign)/campanha/actions/leadership'
import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { LeadershipContactFieldControl } from '@/components/campaign/leadership/LeadershipContactFieldControl'
import { LeadershipFilters } from '@/components/campaign/leadership/LeadershipFilters'
import { LeadershipListSupportStatusControl } from '@/components/campaign/leadership/LeadershipListSupportStatusControl'
import {
  LeadershipFilterHead,
  LeadershipSortableHead,
} from '@/components/campaign/leadership/LeadershipSortableHead'
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
import { Badge } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { whatsAppHrefForPhone } from '@/lib/phone'
import { MAX_LEADERSHIP_MUNICIPALITIES } from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import type { LeadershipRowViewModel } from '@/utilities/leadership/leadershipData'
import { leadershipAccessFilterLabels } from '@/utilities/leadership/leadershipLabels'
import {
  buildLeadershipFilterHref,
  clearLeadershipListFilters,
  type LeadershipFilterOption,
} from '@/utilities/leadership/leadershipListFilters'
import type { LeadershipListState } from '@/utilities/leadership/leadershipListUrl'

const rowKeyById = <T extends { id: string | number }>(row: T) => row.id

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const LeadershipListEmptyState = ({ state }: { state: LeadershipListState }) => (
  <Empty className="min-h-56">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhuma liderança encontrada</EmptyTitle>
      <EmptyDescription>
        Cadastre a primeira liderança ou ajuste a busca e os filtros. Você só vê lideranças dos seus
        municípios.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <CampaignTransitionAnchor
        href={buildLeadershipFilterHref(clearLeadershipListFilters(state))}
        replace
        scroll={false}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
      >
        Limpar busca e filtros
      </CampaignTransitionAnchor>
      <Button asChild className="min-h-11">
        <Link href="/campanha/liderancas/nova">
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Nova liderança
        </Link>
      </Button>
    </EmptyContent>
  </Empty>
)

// B161 — columns are client-defined now (appended rows render here, not in RSC).
const leadershipColumns = ({
  state,
  stateDeputyOptions,
  municipalityIndex,
  municipalityFilterOptions,
  addableMunicipalityIds,
  nowMs,
}: {
  state: LeadershipListState
  stateDeputyOptions: RelationCellOption[]
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  municipalityFilterOptions: LeadershipFilterOption[]
  /** Advisors may only link municipalities they administer; staff: undefined. */
  addableMunicipalityIds?: ReadonlySet<number>
  nowMs: number
}): Array<CampaignTableColumn<LeadershipRowViewModel>> => [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
    head: <LeadershipSortableHead state={state} sortKey="name" />,
    cell: (row) => (
      <LeadershipContactFieldControl leadershipId={row.id} field="name" value={row.name} />
    ),
  },
  {
    id: 'email',
    label: 'E-mail',
    responsiveClassName: 'hidden @min-[56rem]/leadership-list:table-cell',
    cellClassName: 'max-w-56',
    cell: (row) => (
      <LeadershipContactFieldControl leadershipId={row.id} field="email" value={row.email} />
    ),
  },
  {
    id: 'phone',
    label: 'Celular',
    responsiveClassName: 'hidden @min-[56rem]/leadership-list:table-cell',
    cell: (row) => (
      <LeadershipContactFieldControl leadershipId={row.id} field="phone" value={row.phone} />
    ),
  },
  {
    id: 'supportStatus',
    label: 'Status',
    head: (
      <LeadershipSortableHead state={state} sortKey="supportStatus" filterParam="supportStatus" />
    ),
    cell: (row) => (
      <LeadershipListSupportStatusControl leadershipID={row.id} status={row.supportStatus} />
    ),
  },
  {
    id: 'exclusive',
    label: 'Apoio exclusivo',
    responsiveClassName: 'hidden @min-[66rem]/leadership-list:table-cell',
    cell: (row) => (row.exclusive ? null : <Badge variant="outline">Não exclusivo</Badge>),
  },
  {
    id: 'municipalities',
    label: 'Municípios',
    head: (
      <LeadershipFilterHead
        state={state}
        filterParam="municipality"
        options={municipalityFilterOptions}
        description="Recorte por um ou mais municípios da carteira. Na célula, os chips editam o vínculo (fine pointer) ou abrem o drawer (touch)."
      >
        Municípios
      </LeadershipFilterHead>
    ),
    cellClassName: 'max-w-64 whitespace-normal',
    cell: (row) => (
      <MunicipalityPortfolioCell
        ownerId={row.id}
        ownerName={row.name}
        municipalityIds={row.municipalityIDs}
        municipalityIndex={municipalityIndex}
        {...(addableMunicipalityIds ? { addableIds: addableMunicipalityIds } : {})}
        minItems={1}
        maxItems={MAX_LEADERSHIP_MUNICIPALITIES}
        commitAction={setLeadershipMunicipalitiesFormAction}
        drawerTitle="Municípios da liderança"
        updateErrorMessage="Não foi possível atualizar os municípios."
      />
    ),
  },
  {
    id: 'organizations',
    label: 'Organizações',
    responsiveClassName: 'hidden @min-[66rem]/leadership-list:table-cell',
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (row) => row.organizationNames.join(', ') || '—',
  },
  {
    id: 'stateDeputies',
    label: 'Dobradinhas',
    responsiveClassName: 'hidden @min-[72rem]/leadership-list:table-cell',
    cellClassName: 'max-w-56 whitespace-normal',
    cell: (row) => (
      <LeadershipStateDeputyRelationCell
        direction="fromLeadership"
        fixedId={row.id}
        ownerName={row.name}
        items={row.stateDeputies.map((deputy) => ({
          id: deputy.id,
          label: deputy.name,
          href: `/campanha/dobradinhas/${deputy.slug}`,
          ...(deputy.party ? { party: deputy.party } : {}),
        }))}
        options={stateDeputyOptions}
        membershipAction={setLeadershipStateDeputyMembershipFormAction}
        measureOverflow={false}
      />
    ),
  },
  {
    id: 'appAccess',
    label: 'Acesso ao app',
    responsiveClassName: 'hidden @min-[78rem]/leadership-list:table-cell',
    head: (
      <LeadershipFilterHead
        state={state}
        filterParam="access"
        className="hidden @min-[78rem]/leadership-list:table-cell"
      >
        Acesso ao app
      </LeadershipFilterHead>
    ),
    cell: (row) => (
      <Badge variant={row.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
        {row.hasAppAccess ? leadershipAccessFilterLabels.com : leadershipAccessFilterLabels.sem}
      </Badge>
    ),
  },
  {
    id: 'updatedAt',
    label: 'Última atualização',
    responsiveClassName: 'hidden @min-[78rem]/leadership-list:table-cell',
    head: (
      <LeadershipSortableHead
        state={state}
        sortKey="updatedAt"
        className="hidden @min-[78rem]/leadership-list:table-cell"
      />
    ),
    cell: (row) => {
      const absolute = formatBahiaDateTimeLabel(row.updatedAt)
      const relative = formatRelativeAge(new Date(row.updatedAt).getTime(), nowMs)
      return (
        <time dateTime={row.updatedAt} title={absolute} className="text-muted-foreground">
          <span className="capitalize">{relative}</span>
          <span className="sr-only"> ({dateFormatter.format(new Date(row.updatedAt))})</span>
        </time>
      )
    },
  },
  {
    id: 'actions',
    label: 'Ações',
    head: (
      <CampaignTableHead align="right">
        <span className="sr-only">Ações</span>
      </CampaignTableHead>
    ),
    cellClassName: 'text-right',
    cell: (row) => {
      const whatsAppHref = whatsAppHrefForPhone(row.phone)
      return (
        <div className="inline-flex items-center justify-end gap-1">
          <LeadershipInviteRowAction
            leadershipID={row.id}
            name={row.name}
            hasValidPhone={whatsAppHref !== null}
          />
          {whatsAppHref ? (
            <Button asChild variant="ghost" size="icon" className="size-10">
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enviar WhatsApp para ${row.name}`}
              >
                <MessageCircleIcon className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              disabled
              aria-label={`WhatsApp indisponível — ${row.name} sem celular`}
            >
              <MessageCircleIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )
    },
  },
]

export const LeadershipListTable = ({
  rows,
  totalDocs,
  pageSize,
  state,
  query,
  columnVisibility,
  stateDeputyOptions,
  municipalityIndex,
  municipalityFilterOptions,
  organizationFilterOptions,
  stateDeputyFilterOptions,
  addableMunicipalityIds,
  sortSummary,
}: {
  rows: readonly LeadershipRowViewModel[]
  totalDocs: number
  pageSize: number
  state: LeadershipListState
  /** Canonical filter/sort query (no page): the incremental-load signature. */
  query: string
  columnVisibility: CampaignColumnVisibility
  stateDeputyOptions: RelationCellOption[]
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  municipalityFilterOptions: LeadershipFilterOption[]
  organizationFilterOptions: LeadershipFilterOption[]
  stateDeputyFilterOptions: LeadershipFilterOption[]
  /** Advisors may only link municipalities they administer; staff: undefined. */
  addableMunicipalityIds?: readonly number[]
  sortSummary: string
}) => {
  // "há N minutos" is request-scoped: capture once so re-renders and the
  // server/client pass agree on the same minute.
  const nowMsRef = useRef(Date.now())
  const columns = leadershipColumns({
    state,
    stateDeputyOptions,
    municipalityIndex,
    municipalityFilterOptions,
    ...(addableMunicipalityIds ? { addableMunicipalityIds: new Set(addableMunicipalityIds) } : {}),
    nowMs: nowMsRef.current,
  })
  const fetchNextPage = useCallback(
    (page: number) => fetchNextLeadershipListPage(query, page),
    [query],
  )

  return (
    <CampaignListSheetProvider>
      <CampaignInfiniteTable
        dataContainer="leadership-list"
        className="@container/leadership-list"
        columns={columns}
        columnVisibility={columnVisibility}
        rows={rows}
        rowKey={rowKeyById}
        totalDocs={totalDocs}
        pageSize={pageSize}
        query={query}
        fetchNextPage={fetchNextPage}
        caption={`${sortSummary}. Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.`}
        controls={
          <LeadershipFilters
            state={state}
            totalDocs={totalDocs}
            municipalityFilterOptions={municipalityFilterOptions}
            organizationFilterOptions={organizationFilterOptions}
            stateDeputyFilterOptions={stateDeputyFilterOptions}
            trailing={
              <CampaignColumnPickerTrailing
                columnVisibility={columnVisibility}
                columns={toCampaignColumnPickerColumns(columns)}
              />
            }
          />
        }
        empty={<LeadershipListEmptyState state={state} />}
      />
    </CampaignListSheetProvider>
  )
}
