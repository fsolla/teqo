import config from '@payload-config'
import { MessageCircleIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { LeadershipFilters } from '@/components/campaign/leadership/LeadershipFilters'
import { LeadershipListSupportStatusControl } from '@/components/campaign/leadership/LeadershipListSupportStatusControl'
import {
  LeadershipFilterHead,
  LeadershipSortableHead,
} from '@/components/campaign/leadership/LeadershipSortableHead'
import { CampaignCopyableCell } from '@/components/campaign/shared/CampaignCopyableCell'
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
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import { MAX_LEADERSHIP_MUNICIPALITIES, isLeadershipSector } from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import { getAdvisorMunicipalityIds, isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import { loadLeadershipListPageData, type LeadershipRowViewModel } from '@/utilities/leadershipData'
import { leadershipAccessFilterLabels } from '@/utilities/leadershipLabels'
import {
  buildLeadershipFilterHref,
  clearLeadershipListFilters,
  type LeadershipFilterOption,
} from '@/utilities/leadershipListFilters'
import {
  buildLeadershipListHref,
  formatLeadershipListSortSummary,
  leadershipListSortLabels,
  resolveLeadershipListSort,
  resolveLeadershipListUrl,
  type LeadershipListState,
} from '@/utilities/leadershipListUrl'
import { leadershipSectorLabels } from '@/utilities/leadershipUi'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipalityPortfolioIndex'

import {
  setLeadershipMunicipalitiesFormAction,
  setLeadershipStateDeputyMembershipFormAction,
} from './formActions'

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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
    label: leadershipListSortLabels.name,
    mandatory: true,
    head: (
      <LeadershipSortableHead state={state} sortKey="name">
        Nome
      </LeadershipSortableHead>
    ),
    cell: (row) => (
      <Link
        href={`/campanha/liderancas/${row.id}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'email',
    label: 'E-mail',
    cellClassName: 'max-w-56',
    cell: (row) => <CampaignCopyableCell value={row.email} label="E-mail" />,
  },
  {
    id: 'phone',
    label: 'Celular',
    cell: (row) => (
      <CampaignCopyableCell
        value={row.phone}
        label="Celular"
        displayValue={row.phone ? formatBrazilianPhoneInput(row.phone) : undefined}
        className="tabular-nums"
      />
    ),
  },
  {
    id: 'supportStatus',
    label: leadershipListSortLabels.supportStatus,
    head: (
      <LeadershipSortableHead state={state} sortKey="supportStatus" filterParam="supportStatus">
        Status
      </LeadershipSortableHead>
    ),
    cell: (row) => (
      <LeadershipListSupportStatusControl leadershipID={row.id} status={row.supportStatus} />
    ),
  },
  {
    id: 'sector',
    label: leadershipListSortLabels.sector,
    head: (
      <LeadershipSortableHead state={state} sortKey="sector" filterParam="sector">
        Setor
      </LeadershipSortableHead>
    ),
    cell: (row) => {
      if (!row.sector || !isLeadershipSector(row.sector)) return row.sector || '—'
      return leadershipSectorLabels[row.sector]
    },
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
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (row) => row.organizationNames.join(', ') || '—',
  },
  {
    id: 'stateDeputies',
    label: 'Dobradinhas',
    cellClassName: 'max-w-56 whitespace-normal',
    cell: (row) => (
      <LeadershipStateDeputyRelationCell
        direction="fromLeadership"
        fixedId={row.id}
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
    head: (
      <LeadershipSortableHead state={state} sortKey="updatedAt">
        Última atualização
      </LeadershipSortableHead>
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

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveLeadershipListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const [
    { rows, totalDocs, totalPages, filterFacets },
    stateDeputyOptions,
    municipalityIndex,
    administeredIds,
  ] = await Promise.all([
    loadLeadershipListPageData(payload, user, canonicalUrl.state),
    loadStateDeputyOptions(payload, user),
    loadMunicipalityPortfolioIndex(payload),
    user.role === 'advisor' ? getAdvisorMunicipalityIds(payload, user.id) : null,
  ])
  const resolvedUrl = resolveLeadershipListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const municipalityById = new Map(municipalityIndex.map((entry) => [entry.id, entry]))
  const municipalityFilterOptions: LeadershipFilterOption[] = filterFacets.municipalityIDs
    .map((id) => {
      const entry = municipalityById.get(id)
      return entry ? { value: String(id), label: entry.name } : null
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const municipalityLabelsById: Record<number, string> = {}
  for (const option of municipalityFilterOptions) {
    municipalityLabelsById[Number(option.value)] = option.label
  }
  for (const id of state.municipalities ?? []) {
    if (!municipalityLabelsById[id]) {
      municipalityLabelsById[id] = municipalityById.get(id)?.name ?? `Município #${id}`
    }
  }

  const { sort, dir } = resolveLeadershipListSort(state)
  const sortSummary = formatLeadershipListSortSummary(sort, dir)
  const columnVisibility = await readCampaignColumnVisibility('liderancas')
  const columns = leadershipColumns({
    state,
    stateDeputyOptions: stateDeputyOptions.map((option) => ({
      id: option.id,
      searchLabel: option.name,
      item: {
        id: option.id,
        label: option.plainName,
        href: `/campanha/dobradinhas/${option.slug}`,
        ...(option.party ? { party: option.party } : {}),
      },
    })),
    municipalityIndex,
    municipalityFilterOptions,
    ...(administeredIds ? { addableMunicipalityIds: new Set(administeredIds) } : {}),
    nowMs: Date.now(),
  })

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Lideranças</h1>
          <p className="text-muted-foreground">
            Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <LeadershipFilters state={state} municipalityLabelsById={municipalityLabelsById} />

        <CampaignListResults>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {sortSummary}
          </p>
          <CampaignTable
            caption={`${sortSummary}. Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.`}
            columns={columns}
            columnVisibility={columnVisibility}
            rows={rows}
            rowKey={(row) => row.id}
            empty={<LeadershipListEmptyState state={state} />}
          />
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
