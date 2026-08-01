import config from '@payload-config'
import { InboxIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { CampaignFilterChips } from '@/components/campaign/shared/CampaignFilterChips'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
  campaignDemandStatuses,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { resolveListUnifiedEnabled } from '@/lib/opsListRegistry/opsListFlag'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import {
  buildDemandListHref,
  loadDemandListPageData,
  parseDemandListParams,
  type DemandRowViewModel,
} from '@/utilities/campaignDemandData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

type DemandsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusVariant: Record<
  CampaignDemandStatus,
  'secondary' | 'estimate-pending' | 'destructive' | 'estimate-confirmed'
> = {
  aberta: 'estimate-pending',
  em_analise: 'secondary',
  escalada: 'estimate-pending',
  aprovada: 'estimate-confirmed',
  rejeitada: 'destructive',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const demandColumns: Array<CampaignTableColumn<DemandRowViewModel>> = [
  {
    id: 'title',
    label: 'Demanda',
    mandatory: true,
    cellClassName: 'max-w-64 whitespace-normal',
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
    cell: (row) => campaignDemandKindLabels[row.kind],
  },
  {
    id: 'municipality',
    label: 'Município',
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.municipalityName,
  },
  {
    id: 'requester',
    label: 'Solicitante',
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.requesterName ?? '—',
  },
  {
    id: 'status',
    label: 'Status',
    cell: (row) => (
      <Badge variant={statusVariant[row.status]}>{campaignDemandStatusLabels[row.status]}</Badge>
    ),
  },
  {
    id: 'createdAt',
    label: 'Aberta em',
    cell: (row) => dateFormatter.format(new Date(row.createdAt)),
  },
]

export default async function DemandsPage({ searchParams }: DemandsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const state = parseDemandListParams(rawSearchParams)
  const { rows, totalDocs, totalPages, openCount } = await loadDemandListPageData(
    payload,
    user,
    state,
  )
  const columnVisibility = await readCampaignColumnVisibility('demandas')

  const hrefForStatus = (status?: CampaignDemandStatus) =>
    buildDemandListHref({ ...state, status }, 1)

  const statusChips = (
    <CampaignFilterChips
      ariaLabel="Filtrar por status"
      chips={[
        { href: hrefForStatus(undefined), label: 'Todas', active: state.status === undefined },
        ...campaignDemandStatuses.map((status) => ({
          href: hrefForStatus(status),
          label: campaignDemandStatusLabels[status],
          active: state.status === status,
        })),
      ]}
    />
  )

  const tableNode = (
    <CampaignTable
      columns={demandColumns}
      columnVisibility={columnVisibility}
      rows={rows}
      rowKey={(row) => row.id}
      empty={
        <CampaignListEmptyState
          icon={InboxIcon}
          title="Nenhuma demanda por aqui"
          description="Abra uma demanda quando precisar de material, transporte, espaço ou apoio para uma ação."
        >
          <Button asChild className="min-h-11">
            <Link href="/campanha/demandas/nova">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova demanda
            </Link>
          </Button>
        </CampaignListEmptyState>
      }
    />
  )

  const footerNode = rows.length ? (
    <CampaignListFooter
      totalDocs={totalDocs}
      singular="demanda"
      plural="demandas"
      page={state.page}
      totalPages={totalPages}
      hrefForPage={(page) => buildDemandListHref(state, page)}
    />
  ) : null

  const main = resolveListUnifiedEnabled() ? (
    <OpsListPage
      overview={null}
      toolbar={statusChips}
      table={tableNode}
      empty={null}
      footer={footerNode}
    />
  ) : (
    <CampaignListPendingBoundary>
      {statusChips}
      <CampaignListResults>
        {tableNode}
        {footerNode}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Demandas</h1>
          <p className="text-muted-foreground">
            Necessidades da campanha abertas pelas lideranças, revisadas pela assessoria e — quando
            preciso — decididas pelo Coordenador Geral.
          </p>
          <Badge variant="estimate-pending" className="w-fit">
            {openCount} {openCount === 1 ? 'demanda em aberto' : 'demandas em aberto'}
          </Badge>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/demandas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova demanda
          </Link>
        </Button>
      </header>

      {main}
    </CampaignPageShell>
  )
}
