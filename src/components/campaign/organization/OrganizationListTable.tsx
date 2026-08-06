'use client'

import { PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback } from 'react'

import { fetchNextOrganizationListPage } from '@/app/(campaign)/campanha/actions/organization'
import { OrganizationFilters } from '@/components/campaign/organization/OrganizationFilters'
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
import { organizationKindLabels } from '@/lib/schemas/organization'
import type { OrganizationListState } from '@/utilities/organization/organizationListUrl'
import type { OrganizationRowViewModel } from '@/utilities/organizationData'

// B161 — columns are client-defined now (appended rows render here, not in RSC).
const organizationColumns: Array<CampaignTableColumn<OrganizationRowViewModel>> = [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
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
    cell: (row) => <Badge variant="secondary">{organizationKindLabels[row.kind]}</Badge>,
  },
  {
    id: 'municipalities',
    label: 'Municípios de atuação',
    responsiveClassName: 'hidden @min-[56rem]/organization-list:table-cell',
    cellClassName: 'max-w-64 whitespace-normal text-muted-foreground',
    cell: (row) => row.municipalityNames.join(', ') || '—',
  },
  {
    id: 'leaderships',
    label: 'Lideranças',
    cellClassName: 'tabular-nums',
    cell: (row) => row.leadershipCount,
  },
]

export const OrganizationListTable = ({
  rows,
  totalDocs,
  pageSize,
  state,
  query,
  columnVisibility,
}: {
  rows: readonly OrganizationRowViewModel[]
  totalDocs: number
  pageSize: number
  state: OrganizationListState
  /** Canonical filter query (no page): the incremental-load signature. */
  query: string
  columnVisibility: CampaignColumnVisibility
}) => {
  const fetchNextPage = useCallback(
    (page: number) => fetchNextOrganizationListPage(query, page),
    [query],
  )

  return (
    <CampaignInfiniteTable
      dataContainer="organization-list"
      className="@container/organization-list"
      columns={organizationColumns}
      columnVisibility={columnVisibility}
      rows={rows}
      rowKey={(row) => row.id}
      totalDocs={totalDocs}
      pageSize={pageSize}
      query={query}
      fetchNextPage={fetchNextPage}
      controls={
        <OrganizationFilters
          state={state}
          totalDocs={totalDocs}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(organizationColumns)}
            />
          }
        />
      }
      empty={
        <CampaignListEmptyState
          icon={SearchXIcon}
          title="Nenhuma organização cadastrada"
          description="Cadastre sindicatos, associações e movimentos para vincular lideranças e atividades."
        >
          <Button asChild className="min-h-11">
            <Link href="/campanha/organizacoes/nova">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova organização
            </Link>
          </Button>
        </CampaignListEmptyState>
      }
    />
  )
}
