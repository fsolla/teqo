'use client'

import { InboxIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback } from 'react'

import { fetchNextDemandListPage } from '@/app/(campaign)/campanha/actions/demand'
import { DemandFilters } from '@/components/campaign/demand/DemandFilters'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignInfiniteTable } from '@/components/campaign/shared/CampaignInfiniteTable'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import type { CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  toCampaignColumnPickerColumns,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import type { DemandRowViewModel } from '@/utilities/campaignDemandData'
import type { DemandListState } from '@/utilities/demand/demandListUrl'

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

// B161 — columns are client-defined now: appended rows render here, not in
// RSC. Same cells the paginated table had, same column ids (B17 picker).
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
    responsiveClassName: 'hidden @min-[56rem]/demand-list:table-cell',
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
    responsiveClassName: 'hidden @min-[66rem]/demand-list:table-cell',
    cell: (row) => dateFormatter.format(new Date(row.createdAt)),
  },
]

export const DemandListTable = ({
  rows,
  totalDocs,
  pageSize,
  state,
  query,
  columnVisibility,
}: {
  rows: readonly DemandRowViewModel[]
  totalDocs: number
  pageSize: number
  state: DemandListState
  /** Canonical filter query (no page): the incremental-load signature. */
  query: string
  columnVisibility: CampaignColumnVisibility
}) => {
  const fetchNextPage = useCallback((page: number) => fetchNextDemandListPage(query, page), [query])

  return (
    <CampaignInfiniteTable
      dataContainer="demand-list"
      className="@container/demand-list"
      columns={demandColumns}
      columnVisibility={columnVisibility}
      rows={rows}
      rowKey={(row) => row.id}
      totalDocs={totalDocs}
      pageSize={pageSize}
      query={query}
      fetchNextPage={fetchNextPage}
      controls={
        <DemandFilters
          state={state}
          totalDocs={totalDocs}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(demandColumns)}
            />
          }
        />
      }
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
}
