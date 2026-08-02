'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { SaveMunicipalityFilterControl } from '@/components/campaign/municipality/SaveMunicipalityFilterControl'
import {
  OPS_LIST_ACCESS_FILTER_IGNORED_MESSAGE,
  OPS_LIST_CLASS_FILTER_UNAVAILABLE_MESSAGE,
  OPS_LIST_DOMAIN_UNAVAILABLE_MESSAGE,
  OPS_LIST_EDIT_ONLINE_ONLY_MESSAGE,
  OPS_LIST_KPI_UNAVAILABLE_MESSAGE,
  OPS_LIST_MIRROR_EMPTY_MESSAGE,
  OPS_LIST_ONLINE_ONLY_MESSAGE,
  OPS_LIST_SORT_DEGRADED_MESSAGE,
} from '@/components/campaign/opsSync/opsListLocalCopy'
import {
  demandsCollection,
  leadershipsCollection,
  municipalitiesCollection,
  organizationsCollection,
  stateDeputiesCollection,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { OpsListView } from '@/components/campaign/shared/OpsListView'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type {
  OpsDemand,
  OpsLeadership,
  OpsMunicipality,
  OpsOrganization,
  OpsStateDeputy,
} from '@/lib/campaignOps/opsContract'
import {
  filterSortPageOpsDemands,
  filterSortPageOpsLeaderships,
  filterSortPageOpsOrganizations,
  filterSortPageOpsStateDeputies,
} from '@/utilities/campaignOps/opsEntityListLocal'
import { filterSortPageOpsMunicipalities } from '@/utilities/campaignOps/opsMunicipalityListLocal'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  formatEngagementLevelLabel,
  isEngagementLevel,
} from '@/lib/engagementLevel'
import { getOpsListDomain, type OpsListDomainId } from '@/lib/opsListRegistry/opsListRegistry'
import { campaignDemandKindLabels, campaignDemandStatusLabels } from '@/lib/schemas/campaignDemand'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, getVoteEstimateForScenario } from '@/lib/voteEstimate'
import { buildDemandListHref, parseDemandListParams } from '@/utilities/demand/demandListUrl'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'
import {
  buildLeadershipListHref,
  parseLeadershipListParams,
} from '@/utilities/leadership/leadershipListUrl'
import {
  politicalTrendLabels,
  type PoliticalTrendStatus,
} from '@/utilities/municipality/municipalityLabels'
import {
  buildMunicipalityFilterHref,
  clearMunicipalityListFilters,
  formatMunicipalityActiveFiltersSummary,
} from '@/utilities/municipality/municipalityListFilters'
import {
  buildMunicipalityListHref,
  municipalityListSortOptions,
  parseMunicipalityListParams,
  parseMunicipalitySortValue,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import {
  buildOrganizationListHref,
  parseOrganizationListParams,
} from '@/utilities/organization/organizationListUrl'
import {
  buildStateDeputyListHref,
  parseStateDeputyListParams,
} from '@/utilities/stateDeputyListUrl'

const searchParamsToRecord = (
  params: URLSearchParams,
): Record<string, string | string[] | undefined> => {
  const record: Record<string, string | string[] | undefined> = {}
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key)
    record[key] = all.length <= 1 ? (all[0] ?? undefined) : all
  }
  return record
}

const useMirrorCollection = <T extends { id: number }>(collection: {
  toArray: T[]
  subscribeChanges: (cb: () => void) => { unsubscribe: () => void }
}): T[] => {
  const [rows, setRows] = useState<T[]>(() => collection.toArray)
  const coalesceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const refresh = () => {
      if (coalesceRef.current) return
      coalesceRef.current = () => {
        coalesceRef.current = null
        setRows(collection.toArray)
      }
      queueMicrotask(coalesceRef.current)
    }
    refresh()
    const subscription = collection.subscribeChanges(refresh)
    return () => {
      subscription.unsubscribe()
      coalesceRef.current = null
    }
  }, [collection])

  return rows
}

const OpsListLocalNotice = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)

const OpsListLocalShell = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <OpsListLocalNotice>{OPS_LIST_EDIT_ONLINE_ONLY_MESSAGE}</OpsListLocalNotice>
    </header>
    {children}
  </div>
)

const OpsListDomainUnavailable = ({ title }: { title: string }) => (
  <OpsListLocalShell title={title} description={OPS_LIST_DOMAIN_UNAVAILABLE_MESSAGE}>
    <section aria-label="Lista indisponível offline" className="rounded-xl border px-4 py-6">
      <OpsListLocalNotice>{OPS_LIST_ONLINE_ONLY_MESSAGE}</OpsListLocalNotice>
    </section>
  </OpsListLocalShell>
)

/* ——— Municipios ——— */

const MunicipalityLocalFilters = ({ state }: { state: MunicipalityListState }) => {
  const { search, onSearchChange, draftQ, isPending, navigateWithSearch, clearSearchAndNavigate } =
    useCampaignListFilterNavigation({ state, toHref: buildMunicipalityFilterHref })
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const activeFiltersSummary = formatMunicipalityActiveFiltersSummary({ ...state, q: draftQ })
  const hasActiveFilters = Boolean(activeFiltersSummary)

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        navigateWithSearch(state)
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="municipality-search-local"
          label="Buscar município"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {activeFiltersSummary ? (
          <p className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block md:self-center md:pb-2 md:whitespace-normal">
            {activeFiltersSummary}
          </p>
        ) : null}
        <SaveMunicipalityFilterControl state={state} />
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 md:self-end"
            onClick={() => clearSearchAndNavigate(clearMunicipalityListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>
      <Field className="md:max-w-sm">
        <FieldLabel htmlFor="municipality-sort-local">Ordenar</FieldLabel>
        <NativeSelect
          id="municipality-sort-local"
          value={serializeMunicipalitySortValue(activeSort, activeDir)}
          onChange={(event) => {
            const parsed = parseMunicipalitySortValue(event.target.value)
            if (parsed) navigateWithSearch({ ...state, sort: parsed.key, dir: parsed.dir })
          }}
          className="min-h-11 w-full"
        >
          {municipalityListSortOptions.map(({ key, dir, label }) => (
            <NativeSelectOption
              key={serializeMunicipalitySortValue(key, dir)}
              value={serializeMunicipalitySortValue(key, dir)}
            >
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </form>
  )
}

const municipalityLocalColumns = (): Array<CampaignTableColumn<OpsMunicipality>> => [
  {
    id: 'name',
    label: 'Município',
    mandatory: true,
    head: <CampaignTableHead>Município</CampaignTableHead>,
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/campanha/municipios/${row.slug}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
        {row.priority === 'alta' ? <MunicipalityPriorityIndicator /> : null}
      </div>
    ),
  },
  {
    id: 'region',
    label: 'Território',
    head: <CampaignTableHead>Território</CampaignTableHead>,
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.region,
  },
  {
    id: 'trend',
    label: 'Tendência',
    head: <CampaignTableHead>Tendência</CampaignTableHead>,
    cell: (row) => {
      const status = row.politicalTrend?.status as PoliticalTrendStatus | null | undefined
      return status ? politicalTrendLabels[status] : '—'
    },
  },
  {
    id: 'level',
    label: 'Nível',
    head: <CampaignTableHead>Nível</CampaignTableHead>,
    cell: (row) =>
      isEngagementLevel(row.engagementLevel)
        ? formatEngagementLevelLabel(row.engagementLevel)
        : EMPTY_ENGAGEMENT_LEVEL_LABEL,
  },
  {
    id: 'expectedVotes',
    label: 'Votos estimados',
    head: <CampaignTableHead>Votos estimados</CampaignTableHead>,
    cellClassName: 'text-right',
    cell: (row) => {
      const votes = getVoteEstimateForScenario(row.expectedVotes, DEFAULT_VOTE_ESTIMATE_SCENARIO)
      return votes == null ? '—' : formatElectionNumber(votes)
    },
  },
  {
    id: 'advisors',
    label: 'Assessores',
    head: <CampaignTableHead>Assessores</CampaignTableHead>,
    cellClassName: 'text-right',
    cell: (row) => String(row.advisors?.length ?? 0),
  },
]

const OpsMunicipalityListLocal = () => {
  const searchParams = useSearchParams()
  const municipalities = useMirrorCollection(municipalitiesCollection)
  const state = parseMunicipalityListParams(searchParamsToRecord(searchParams))
  const pageResult = filterSortPageOpsMunicipalities(municipalities, state)

  if (municipalities.length === 0) {
    return (
      <OpsListLocalShell
        title="Municípios"
        description="Espelho offline dos municípios da campanha."
      >
        <OpsListLocalNotice>{OPS_LIST_MIRROR_EMPTY_MESSAGE}</OpsListLocalNotice>
      </OpsListLocalShell>
    )
  }

  const columns = municipalityLocalColumns()
  const overview = (
    <div className="rounded-xl border px-4 py-3">
      <OpsListLocalNotice>{OPS_LIST_KPI_UNAVAILABLE_MESSAGE}</OpsListLocalNotice>
      {pageResult.classFilterUnavailable ? (
        <OpsListLocalNotice>{OPS_LIST_CLASS_FILTER_UNAVAILABLE_MESSAGE}</OpsListLocalNotice>
      ) : null}
      {pageResult.sortDegraded ? (
        <OpsListLocalNotice>{OPS_LIST_SORT_DEGRADED_MESSAGE}</OpsListLocalNotice>
      ) : null}
    </div>
  )

  return (
    <OpsListLocalShell
      title="Municípios"
      description="Lista offline a partir do espelho — busca, ordenação e paginação locais."
    >
      <OpsListView
        overview={overview}
        toolbar={<MunicipalityLocalFilters state={{ ...state, page: pageResult.page }} />}
        table={
          <CampaignTable
            columns={columns}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            caption="Municípios (offline)"
            empty={
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum município encontrado neste recorte offline.
              </p>
            }
          />
        }
        empty={null}
        footer={
          <CampaignListFooter
            totalDocs={pageResult.totalDocs}
            singular="município encontrado"
            plural="municípios encontrados"
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={(page) => buildMunicipalityListHref(state, page)}
          />
        }
      />
    </OpsListLocalShell>
  )
}

/* ——— Leaderships ——— */

const leadershipLocalColumns = (): Array<CampaignTableColumn<OpsLeadership>> => [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
    head: <CampaignTableHead>Nome</CampaignTableHead>,
    cell: (row) => (
      <Link
        href={`/campanha/liderancas/${row.id}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.contact.name}
      </Link>
    ),
  },
  {
    id: 'supportStatus',
    label: 'Status',
    head: <CampaignTableHead>Status</CampaignTableHead>,
    cell: (row) => supportStatusLabels[row.supportStatus],
  },
  {
    id: 'municipalities',
    label: 'Municípios',
    head: <CampaignTableHead>Municípios</CampaignTableHead>,
    cellClassName: 'text-right',
    cell: (row) => String(row.municipalities.length),
  },
]

const OpsLeadershipListLocal = () => {
  const searchParams = useSearchParams()
  const rows = useMirrorCollection(leadershipsCollection)
  const state = parseLeadershipListParams(searchParamsToRecord(searchParams))
  const pageResult = filterSortPageOpsLeaderships(rows, state)

  if (rows.length === 0) {
    return (
      <OpsListLocalShell title="Lideranças" description="Espelho offline de lideranças.">
        <OpsListLocalNotice>{OPS_LIST_MIRROR_EMPTY_MESSAGE}</OpsListLocalNotice>
      </OpsListLocalShell>
    )
  }

  return (
    <OpsListLocalShell title="Lideranças" description="Lista offline a partir do espelho.">
      <OpsListView
        overview={
          state.access ? (
            <div className="rounded-xl border px-4 py-3">
              <OpsListLocalNotice>{OPS_LIST_ACCESS_FILTER_IGNORED_MESSAGE}</OpsListLocalNotice>
            </div>
          ) : null
        }
        toolbar={
          <OpsListLocalNotice>
            Filtros completos e edição: {OPS_LIST_ONLINE_ONLY_MESSAGE}
          </OpsListLocalNotice>
        }
        table={
          <CampaignTable
            columns={leadershipLocalColumns()}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            caption="Lideranças (offline)"
            empty={
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma liderança neste recorte offline.
              </p>
            }
          />
        }
        empty={null}
        footer={
          <CampaignListFooter
            totalDocs={pageResult.totalDocs}
            singular="liderança encontrada"
            plural="lideranças encontradas"
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={(page) => buildLeadershipListHref(state, page)}
          />
        }
      />
    </OpsListLocalShell>
  )
}

/* ——— State deputies / orgs / demands ——— */

const OpsStateDeputyListLocal = () => {
  const searchParams = useSearchParams()
  const rows = useMirrorCollection(stateDeputiesCollection)
  const state = parseStateDeputyListParams(searchParamsToRecord(searchParams))
  const pageResult = filterSortPageOpsStateDeputies(rows, state)

  if (rows.length === 0) {
    return (
      <OpsListLocalShell title="Dobradinhas" description="Espelho offline de deputados estaduais.">
        <OpsListLocalNotice>{OPS_LIST_MIRROR_EMPTY_MESSAGE}</OpsListLocalNotice>
      </OpsListLocalShell>
    )
  }

  const columns: Array<CampaignTableColumn<OpsStateDeputy>> = [
    {
      id: 'name',
      label: 'Nome',
      mandatory: true,
      head: <CampaignTableHead>Nome</CampaignTableHead>,
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
      label: 'Partido',
      head: <CampaignTableHead>Partido</CampaignTableHead>,
      cell: (row) => row.party?.trim() || '—',
    },
  ]

  return (
    <OpsListLocalShell title="Dobradinhas" description="Lista offline a partir do espelho.">
      <OpsListView
        overview={null}
        toolbar={
          <OpsListLocalNotice>Filtros completos: {OPS_LIST_ONLINE_ONLY_MESSAGE}</OpsListLocalNotice>
        }
        table={
          <CampaignTable
            columns={columns}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            caption="Dobradinhas (offline)"
          />
        }
        empty={null}
        footer={
          <CampaignListFooter
            totalDocs={pageResult.totalDocs}
            singular="dobradinha encontrada"
            plural="dobradinhas encontradas"
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={(page) => buildStateDeputyListHref(state, page)}
          />
        }
      />
    </OpsListLocalShell>
  )
}

const OpsOrganizationListLocal = () => {
  const searchParams = useSearchParams()
  const rows = useMirrorCollection(organizationsCollection)
  const state = parseOrganizationListParams(searchParamsToRecord(searchParams))
  const pageResult = filterSortPageOpsOrganizations(rows, state)

  if (rows.length === 0) {
    return (
      <OpsListLocalShell title="Organizações" description="Espelho offline de organizações.">
        <OpsListLocalNotice>{OPS_LIST_MIRROR_EMPTY_MESSAGE}</OpsListLocalNotice>
      </OpsListLocalShell>
    )
  }

  const columns: Array<CampaignTableColumn<OpsOrganization>> = [
    {
      id: 'name',
      label: 'Nome',
      mandatory: true,
      head: <CampaignTableHead>Nome</CampaignTableHead>,
      cell: (row) => (
        <Link
          href={`/campanha/organizacoes/${row.slug}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: 'kind',
      label: 'Tipo',
      head: <CampaignTableHead>Tipo</CampaignTableHead>,
      cell: (row) => organizationKindLabels[row.kind],
    },
  ]

  return (
    <OpsListLocalShell title="Organizações" description="Lista offline a partir do espelho.">
      <OpsListView
        overview={null}
        toolbar={
          <OpsListLocalNotice>Filtros completos: {OPS_LIST_ONLINE_ONLY_MESSAGE}</OpsListLocalNotice>
        }
        table={
          <CampaignTable
            columns={columns}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            caption="Organizações (offline)"
          />
        }
        empty={null}
        footer={
          <CampaignListFooter
            totalDocs={pageResult.totalDocs}
            singular="organização encontrada"
            plural="organizações encontradas"
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={(page) => buildOrganizationListHref(state, page)}
          />
        }
      />
    </OpsListLocalShell>
  )
}

const OpsDemandListLocal = () => {
  const searchParams = useSearchParams()
  const rows = useMirrorCollection(demandsCollection)
  const state = parseDemandListParams(searchParamsToRecord(searchParams))
  const pageResult = filterSortPageOpsDemands(rows, state)

  if (rows.length === 0) {
    return (
      <OpsListLocalShell title="Demandas" description="Espelho offline de demandas.">
        <OpsListLocalNotice>{OPS_LIST_MIRROR_EMPTY_MESSAGE}</OpsListLocalNotice>
      </OpsListLocalShell>
    )
  }

  const columns: Array<CampaignTableColumn<OpsDemand>> = [
    {
      id: 'title',
      label: 'Título',
      mandatory: true,
      head: <CampaignTableHead>Título</CampaignTableHead>,
      cell: (row) => (
        <Link
          href={`/campanha/demandas/${row.slug}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: 'kind',
      label: 'Tipo',
      head: <CampaignTableHead>Tipo</CampaignTableHead>,
      cell: (row) => campaignDemandKindLabels[row.kind],
    },
    {
      id: 'status',
      label: 'Status',
      head: <CampaignTableHead>Status</CampaignTableHead>,
      cell: (row) => campaignDemandStatusLabels[row.status],
    },
  ]

  return (
    <OpsListLocalShell title="Demandas" description="Lista offline a partir do espelho.">
      <OpsListView
        overview={
          <div className="rounded-xl border px-4 py-3">
            <OpsListLocalNotice>{OPS_LIST_KPI_UNAVAILABLE_MESSAGE}</OpsListLocalNotice>
          </div>
        }
        toolbar={
          <OpsListLocalNotice>Filtros completos: {OPS_LIST_ONLINE_ONLY_MESSAGE}</OpsListLocalNotice>
        }
        table={
          <CampaignTable
            columns={columns}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            caption="Demandas (offline)"
          />
        }
        empty={null}
        footer={
          <CampaignListFooter
            totalDocs={pageResult.totalDocs}
            singular="demanda encontrada"
            plural="demandas encontradas"
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={(page) => buildDemandListHref(state, page)}
          />
        }
      />
    </OpsListLocalShell>
  )
}

const DOMAIN_TITLES: Record<OpsListDomainId, string> = {
  municipios: 'Municípios',
  liderancas: 'Lideranças',
  dobradinhas: 'Dobradinhas',
  demandas: 'Demandas',
  assessores: 'Assessores',
  territorios: 'Territórios',
  apoiadores: 'Apoiadores',
  organizacoes: 'Organizações',
}

/**
 * OH12 — read-only Local path for unified ops lists. Reads mirror collections
 * via `subscribeChanges` (same coalesce as MunicipalityDetailLocal).
 */
export const OpsListLocal = ({ slug }: { slug: OpsListDomainId }) => {
  const meta = getOpsListDomain(slug)
  if (!meta) {
    return <OpsListDomainUnavailable title={slug} />
  }

  switch (slug) {
    case 'municipios':
      return <OpsMunicipalityListLocal />
    case 'liderancas':
      return <OpsLeadershipListLocal />
    case 'dobradinhas':
      return <OpsStateDeputyListLocal />
    case 'organizacoes':
      return <OpsOrganizationListLocal />
    case 'demandas':
      return <OpsDemandListLocal />
    case 'assessores':
    case 'territorios':
    case 'apoiadores':
      return <OpsListDomainUnavailable title={DOMAIN_TITLES[slug]} />
    default: {
      const _exhaustive: never = slug
      return _exhaustive
    }
  }
}
