import config from '@payload-config'
import { InboxIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { DemandFilters } from '@/components/campaign/demand/DemandFilters'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import {
  buildDemandListHref,
  loadDemandListPageData,
  parseDemandListParams,
  type DemandRowViewModel,
} from '@/utilities/campaignDemandData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const metadata = campaignPageMetadataFromCatalog('demandas')

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
  const { rows, totalDocs, totalPages } = await loadDemandListPageData(payload, user, state)
  const columnVisibility = await readCampaignColumnVisibility('demandas')

  return (
    <CampaignPageShell>
      <div className="flex justify-end pt-4 md:pt-0">
        <Button asChild className="min-h-11">
          <Link href="/campanha/demandas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova demanda
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <DemandFilters
          state={state}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(demandColumns)}
            />
          }
        />

        <CampaignListResults>
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
          {rows.length ? (
            <CampaignListFooter
              totalDocs={totalDocs}
              singular="demanda"
              plural="demandas"
              page={state.page}
              totalPages={totalPages}
              hrefForPage={(page) => buildDemandListHref(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
