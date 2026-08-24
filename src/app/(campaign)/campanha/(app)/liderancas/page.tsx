import config from '@payload-config'
import { MessageCircleIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { LeadershipFilters } from '@/components/campaign/leadership/LeadershipFilters'
import { LeadershipListSupportStatusControl } from '@/components/campaign/leadership/LeadershipListSupportStatusControl'
import { LeadershipMunicipalitiesColumnCell } from '@/components/campaign/leadership/LeadershipMunicipalitiesColumnCell'
import {
  LeadershipFilterHead,
  LeadershipSortableHead,
} from '@/components/campaign/leadership/LeadershipSortableHead'
import { LeadershipStateDeputiesColumnCell } from '@/components/campaign/leadership/LeadershipStateDeputiesColumnCell'
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
import type { RelationCellOption } from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
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
import { advisorEditingScope, type AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import {
  resolvedPortfolioEntriesById,
  type MunicipalityPortfolioIndexEntry,
} from '@/lib/municipalityPortfolio'
import { whatsAppHrefForPhone } from '@/lib/phone'
import { MAX_LEADERSHIP_MUNICIPALITIES } from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import { getWritableMunicipalityIds } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import {
  loadLeadershipListPageData,
  type LeadershipRowViewModel,
} from '@/utilities/leadership/leadershipData'
import { leadershipAccessFilterLabels } from '@/utilities/leadership/leadershipLabels'
import {
  buildLeadershipFilterHref,
  clearLeadershipListFilters,
  type LeadershipFilterOption,
} from '@/utilities/leadership/leadershipListFilters'
import {
  buildLeadershipListHref,
  formatLeadershipListSortSummary,
  leadershipListSortLabels,
  resolveLeadershipListSort,
  resolveLeadershipListUrl,
  type LeadershipListState,
} from '@/utilities/leadership/leadershipListUrl'
import { loadOrganizationNamesByIds } from '@/utilities/loadNamesByIds'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { loadStateDeputySummaries } from '@/utilities/stateDeputyData'

import { updateLeadershipContactFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('liderancas')

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const LeadershipListEmptyState = ({
  state,
  canEditAny = true,
}: {
  state: LeadershipListState
  canEditAny?: boolean
}) => (
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
      {canEditAny ? (
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      ) : null}
    </EmptyContent>
  </Empty>
)

const leadershipColumns = ({
  state,
  stateDeputyOptions,
  municipalityIndex,
  municipalityFilterOptions,
  addableMunicipalityIds,
  canEditAny = true,
  nowMs,
}: {
  state: LeadershipListState
  stateDeputyOptions: RelationCellOption[]
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  municipalityFilterOptions: LeadershipFilterOption[]
  /**
   * C144 — advisors may only add municipalities in their WRITE scope
   * (`undefined` = whole catalog: unrestricted staff and Edição "Tudo").
   */
  addableMunicipalityIds?: ReadonlySet<number>
  /** C142 — false when the advisor has `somente_leitura`: no invite, no per-row edits. */
  canEditAny?: boolean
  nowMs: number
}): Array<CampaignTableColumn<LeadershipRowViewModel>> => [
  {
    id: 'name',
    label: leadershipListSortLabels.name,
    mandatory: true,
    head: <LeadershipSortableHead state={state} sortKey="name" />,
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="leadershipId"
        field="name"
        value={row.name}
        label="Nome"
        formAction={updateLeadershipContactFormAction}
        href={`/campanha/liderancas/${row.id}`}
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
        recordIdField="leadershipId"
        field="email"
        value={row.email}
        label="E-mail"
        formAction={updateLeadershipContactFormAction}
        readBehavior="copy"
      />
    ),
  },
  {
    id: 'phone',
    label: 'Celular',
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.id}
        recordIdField="leadershipId"
        field="phone"
        value={row.phone}
        label="Celular"
        formAction={updateLeadershipContactFormAction}
        readBehavior="copy"
      />
    ),
  },
  {
    id: 'supportStatus',
    label: leadershipListSortLabels.supportStatus,
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
      <LeadershipMunicipalitiesColumnCell
        ownerId={row.id}
        ownerName={row.name}
        municipalityIds={row.municipalityIDs}
        municipalityIndex={municipalityIndex}
        {...(addableMunicipalityIds ? { addableIds: addableMunicipalityIds } : {})}
        minItems={1}
        maxItems={MAX_LEADERSHIP_MUNICIPALITIES}
        drawerTitle="Municípios da liderança"
        updateErrorMessage="Não foi possível atualizar os municípios."
      />
    ),
  },
  {
    id: 'organizations',
    label: 'Organizações',
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (row) => row.organizationNames.join(', ') || '—',
  },
  {
    id: 'stateDeputies',
    label: 'Dobradinhas',
    cellClassName: 'max-w-56 whitespace-normal',
    cell: (row) => (
      <LeadershipStateDeputiesColumnCell
        direction="fromLeadership"
        fixedId={row.id}
        ownerName={row.name}
        items={row.stateDeputies.map((deputy) => ({
          id: deputy.id,
          label: deputy.name,
          href: `/campanha/dobradinhas/${deputy.id}`,
          ...(deputy.party ? { party: deputy.party } : {}),
        }))}
        options={stateDeputyOptions}
        measureOverflow={false}
      />
    ),
  },
  {
    id: 'appAccess',
    label: 'Acesso ao app',
    head: (
      <LeadershipFilterHead state={state} filterParam="access">
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
    label: leadershipListSortLabels.updatedAt,
    head: <LeadershipSortableHead state={state} sortKey="updatedAt" />,
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
          {canEditAny ? (
            <LeadershipInviteRowAction
              leadershipID={row.id}
              name={row.name}
              hasValidPhone={whatsAppHref !== null}
            />
          ) : null}
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

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveLeadershipListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const columnVisibility = await readCampaignColumnVisibility('liderancas')
  const isStateDeputyVisible = !columnVisibility.hiddenColumnIds.includes('stateDeputies')

  const [
    { rows, totalDocs, totalPages, filterFacets },
    stateDeputyOptions,
    municipalityIndex,
    writableIds,
  ] = await Promise.all([
    loadLeadershipListPageData(payload, user, canonicalUrl.state),
    isStateDeputyVisible ? loadStateDeputyOptions(payload, user) : Promise.resolve([]),
    loadMunicipalityPortfolioIndex(),
    user.role === 'advisor' ? getWritableMunicipalityIds(payload, user) : null,
  ])

  // C142 — the write scope gates the create button, the invite action, and
  // per-row editability (municipality/dobradinha chips).
  const editingScope: AdvisorEditingScope =
    user.role === 'advisor' ? advisorEditingScope(user.visibility, user.editing) : 'tudo'
  const canEditAny = editingScope !== 'none'
  const resolvedUrl = resolveLeadershipListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const municipalityById = resolvedPortfolioEntriesById(municipalityIndex)
  const municipalityFilterOptions: LeadershipFilterOption[] = filterFacets.municipalityIDs
    .map((id) => {
      const entry = municipalityById.get(id)
      return entry ? { value: String(id), label: entry.name } : null
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const [organizationNames, stateDeputySummaries] = await Promise.all([
    loadOrganizationNamesByIds(payload, filterFacets.organizationIDs),
    loadStateDeputySummaries(payload, filterFacets.stateDeputyIDs),
  ])

  const organizationFilterOptions: LeadershipFilterOption[] = filterFacets.organizationIDs
    .map((id) => {
      const label = organizationNames.get(id)
      return label ? { value: String(id), label } : null
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const stateDeputyById = new Map(stateDeputySummaries.map((summary) => [summary.id, summary]))
  const stateDeputyFilterOptions: LeadershipFilterOption[] = filterFacets.stateDeputyIDs
    .map((id) => {
      const summary = stateDeputyById.get(id)
      if (!summary) return null
      const label = summary.party ? `${summary.name} (${summary.party})` : summary.name
      return { value: String(id), label }
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const { sort, dir } = resolveLeadershipListSort(state)
  const sortSummary = formatLeadershipListSortSummary(sort, dir)
  const columns = leadershipColumns({
    state,
    stateDeputyOptions: stateDeputyOptions.map((option) => ({
      id: option.id,
      searchLabel: option.name,
      item: {
        id: option.id,
        label: option.plainName,
        href: `/campanha/dobradinhas/${option.id}`,
        ...(option.party ? { party: option.party } : {}),
      },
    })),
    municipalityIndex,
    municipalityFilterOptions,
    ...(canEditAny && writableIds ? { addableMunicipalityIds: new Set(writableIds) } : {}),
    canEditAny,
    nowMs: Date.now(),
  })

  return (
    <CampaignPageShell>
      <div className="flex justify-end pt-4 md:pt-0">
        {canEditAny ? (
          <Button asChild className="min-h-11">
            <Link href="/campanha/liderancas/nova">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova liderança
            </Link>
          </Button>
        ) : null}
      </div>

      <CampaignListPendingBoundary>
        <LeadershipFilters
          state={state}
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

        <CampaignListResults>
          {/* One shared Drawer for every chip-cell sheet on coarse pointers
              (miss #52 — never a Drawer root per opened cell). */}
          <CampaignListSheetProvider>
            <CampaignTable
              caption={`${sortSummary}. Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.`}
              columns={columns}
              columnVisibility={columnVisibility}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<LeadershipListEmptyState state={state} canEditAny={canEditAny} />}
            />
          </CampaignListSheetProvider>
          {rows.length ? (
            <CampaignListFooter
              totalDocs={totalDocs}
              singular="liderança"
              plural="lideranças"
              page={state.page}
              totalPages={totalPages}
              hrefForPage={(page) => buildLeadershipListHref(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
