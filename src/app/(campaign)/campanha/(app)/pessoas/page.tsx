import config from '@payload-config'
import { MessageCircleIcon, SearchXIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { DeletePersonButton } from '@/components/campaign/people/DeletePersonButton'
import { PeopleFilters } from '@/components/campaign/people/PeopleFilters'
import { PeopleListPageChrome } from '@/components/campaign/people/PeopleListPageChrome'
import { PeopleSortableHead } from '@/components/campaign/people/PeopleSortableHead'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
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
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import {
  resolvedPortfolioEntriesById,
  type ResolvedPortfolioEntry,
} from '@/lib/municipalityPortfolio'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { loadPeopleListPageData, type PeopleRowViewModel } from '@/utilities/people/peopleData'
import {
  buildPeopleFilterHref,
  clearPeopleListFilters,
  type PeopleFilterOption,
} from '@/utilities/people/peopleListFilters'
import {
  buildPeopleListHref,
  resolvePeopleListUrl,
  type PeopleListState,
} from '@/utilities/people/peopleListUrl'

export const metadata = campaignPageMetadataFromCatalog('pessoas')

type PeoplePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PeopleListEmptyState = ({
  hasFilters,
  scoped,
  state,
}: {
  hasFilters: boolean
  scoped: boolean
  state: PeopleListState
}) => (
  <Empty className="min-h-56">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhuma pessoa neste recorte</EmptyTitle>
      <EmptyDescription>
        Ajuste a busca e os filtros para ver as pessoas da campanha.
        {scoped ? ' Você só vê as pessoas dos seus municípios.' : null}
      </EmptyDescription>
    </EmptyHeader>
    {hasFilters ? (
      <EmptyContent>
        <CampaignTransitionAnchor
          href={buildPeopleFilterHref(clearPeopleListFilters(state))}
          replace
          scroll={false}
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
        >
          Limpar busca e filtros
        </CampaignTransitionAnchor>
      </EmptyContent>
    ) : null}
  </Empty>
)

const PeopleMunicipalityCell = ({
  ids,
  index,
}: {
  ids: readonly number[]
  index: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => {
  if (!ids.length) return <span className="text-muted-foreground">—</span>
  const names = ids
    .map((id) => index.get(id)?.name)
    .filter((name): name is string => name !== undefined)
  if (!names.length) return <span className="text-muted-foreground">—</span>
  const visible = names.slice(0, 2)
  const rest = names.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((name) => (
        <Badge key={name} variant="outline" className="max-w-full truncate font-normal">
          {name}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{rest}
        </Badge>
      ) : null}
    </div>
  )
}

const peopleColumns = ({
  state,
  municipalityIndex,
  canDelete,
}: {
  state: PeopleListState
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
  canDelete: boolean
}): Array<CampaignTableColumn<PeopleRowViewModel>> => [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
    head: <PeopleSortableHead state={state} sortKey="name" />,
    cell: (row) => (
      <span className="font-medium">
        {row.name}
        {row.party ? <span className="text-muted-foreground"> ({row.party})</span> : null}
      </span>
    ),
  },
  {
    id: 'contact',
    label: 'Contato',
    cellClassName: 'whitespace-normal',
    head: <PeopleSortableHead state={state} sortKey="contact" />,
    cell: (row) =>
      row.phone ? (
        <span className="font-medium tabular-nums">{formatBrazilianPhoneInput(row.phone)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    // B197 — the email left the "Contato" cell (which now carries only the
    // phone) and became its own column, hidden by default. The mobile cards
    // still show it as the no-phone fallback, untouched. C117 keeps it out of
    // the sort keys on purpose: no ordering by hidden columns.
    id: 'email',
    label: 'E-mail',
    cellClassName: 'max-w-56 whitespace-normal',
    cell: (row) => (row.email ? row.email : <span className="text-muted-foreground">—</span>),
  },
  {
    id: 'assessora',
    label: 'Assessora',
    cellClassName: 'max-w-56 whitespace-normal',
    head: <PeopleSortableHead state={state} sortKey="assessora" />,
    cell: (row) => (
      <PeopleMunicipalityCell ids={row.assessoraMunicipalityIDs} index={municipalityIndex} />
    ),
  },
  {
    id: 'lidera',
    label: 'Lidera',
    cellClassName: 'max-w-56 whitespace-normal',
    head: <PeopleSortableHead state={state} sortKey="lidera" />,
    cell: (row) => (
      <PeopleMunicipalityCell ids={row.leadershipMunicipalityIDs} index={municipalityIndex} />
    ),
  },
  {
    id: 'aliada',
    label: 'Aliada em',
    cellClassName: 'max-w-56 whitespace-normal',
    head: <PeopleSortableHead state={state} sortKey="aliada" />,
    cell: (row) => (
      <PeopleMunicipalityCell ids={row.deputyMunicipalityIDs} index={municipalityIndex} />
    ),
  },
  {
    id: 'assessorado',
    label: 'Assessorado',
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    head: <PeopleSortableHead state={state} sortKey="assessorado" />,
    cell: (row) => row.assessoradoNames.join(', ') || '—',
  },
  {
    id: 'base',
    label: 'Base',
    head: <PeopleSortableHead state={state} sortKey="base" />,
    cell: (row) => row.city ?? '—',
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
          {row.leadershipID !== null ? (
            <LeadershipInviteRowAction
              leadershipID={row.leadershipID}
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
          {canDelete ? (
            <DeletePersonButton personName={row.name} contactId={row.contactID} />
          ) : null}
        </div>
      )
    },
  },
]

const PeopleMobileCards = ({
  rows,
  municipalityIndex,
  canDelete,
  empty,
}: {
  rows: readonly PeopleRowViewModel[]
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
  canDelete: boolean
  empty: ReactNode
}) => (
  <ul data-view="mobile-cards" className="flex flex-col divide-y md:hidden">
    {rows.length === 0 ? (
      <li className="py-4">{empty}</li>
    ) : (
      rows.map((row) => {
        const whatsAppHref = whatsAppHrefForPhone(row.phone)
        const capacities: Array<{ label: string; ids: readonly number[] }> = [
          { label: 'Assessora', ids: row.assessoraMunicipalityIDs },
          { label: 'Lidera', ids: row.leadershipMunicipalityIDs },
          { label: 'Aliada em', ids: row.deputyMunicipalityIDs },
        ]
        return (
          <li key={row.contactID} className="flex flex-col gap-2 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {row.name}
                  {row.party ? <span className="text-muted-foreground"> ({row.party})</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.phone
                    ? formatBrazilianPhoneInput(row.phone)
                    : row.email
                      ? row.email
                      : 'Sem contato registrado'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {row.leadershipID !== null ? (
                  <LeadershipInviteRowAction
                    leadershipID={row.leadershipID}
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
                ) : null}
                {canDelete ? (
                  <DeletePersonButton personName={row.name} contactId={row.contactID} />
                ) : null}
              </div>
            </div>
            {capacities.some((capacity) => capacity.ids.length > 0) ? (
              <div className="flex flex-col gap-1.5">
                {capacities.map((capacity) =>
                  capacity.ids.length > 0 ? (
                    <div key={capacity.label} className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">{capacity.label}:</span>
                      <PeopleMunicipalityCell ids={capacity.ids} index={municipalityIndex} />
                    </div>
                  ) : null,
                )}
              </div>
            ) : null}
            {row.assessoradoNames.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Assessorado por {row.assessoradoNames.join(', ')}
              </p>
            ) : null}
            {row.city ? <p className="text-xs text-muted-foreground">Base: {row.city}</p> : null}
          </li>
        )
      })
    )}
  </ul>
)

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolvePeopleListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const [columnVisibility, listData, municipalityIndex] = await Promise.all([
    readCampaignColumnVisibility('pessoas'),
    loadPeopleListPageData(payload, user, canonicalUrl.state),
    loadMunicipalityPortfolioIndex(),
  ])
  const resolvedUrl = resolvePeopleListUrl(rawSearchParams, listData.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const resolvedIndex = resolvedPortfolioEntriesById(municipalityIndex)
  const municipalityFilterOptions: PeopleFilterOption[] = listData.filterFacets.municipalityIDs
    .map((id) => {
      const entry = resolvedIndex.get(id)
      return entry ? { value: String(id), label: entry.name } : null
    })
    .filter((option): option is PeopleFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const canDelete = isUnrestrictedCampaignRole(user.role)
  const columns = peopleColumns({ state, municipalityIndex: resolvedIndex, canDelete })
  const hasFilters = Boolean(
    state.q ||
    state.capacities?.length ||
    state.municipalities?.length ||
    state.statuses?.length ||
    state.ausencias?.length,
  )

  return (
    <CampaignPageShell>
      <PeopleListPageChrome />
      <CampaignListPendingBoundary>
        <PeopleFilters
          state={state}
          municipalityFilterOptions={municipalityFilterOptions}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(columns)}
            />
          }
        />

        <CampaignListResults>
          <PeopleMobileCards
            rows={listData.rows}
            municipalityIndex={resolvedIndex}
            canDelete={canDelete}
            empty={
              <PeopleListEmptyState
                hasFilters={hasFilters}
                scoped={user.role === 'advisor'}
                state={state}
              />
            }
          />
          <CampaignTable
            className="hidden md:block"
            caption="Uma linha por pessoa — cada pessoa pode assessorar, liderar e ser dobradinha ao mesmo tempo."
            columns={columns}
            columnVisibility={columnVisibility}
            rows={listData.rows}
            rowKey={(row) => row.contactID}
            empty={
              <PeopleListEmptyState
                hasFilters={hasFilters}
                scoped={user.role === 'advisor'}
                state={state}
              />
            }
          />
          {listData.rows.length ? (
            <CampaignListFooter
              totalDocs={listData.totalDocs}
              singular="pessoa"
              plural="pessoas"
              page={state.page}
              totalPages={listData.totalPages}
              hrefForPage={(page) => buildPeopleListHref(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
