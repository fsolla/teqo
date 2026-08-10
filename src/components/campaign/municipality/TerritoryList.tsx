import { SearchXIcon } from 'lucide-react'

import { territoryListColumns } from '@/components/campaign/municipality/TerritoryListColumns'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable } from '@/components/campaign/shared/CampaignTable'
import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import type { CampaignColumnVisibility } from '@/lib/campaignColumnVisibility'
import { territoryAnchorId } from '@/lib/territoryAnchor'
import { cn } from '@/lib/utils'
import type { TerritoryNetworkReferences } from '@/utilities/territory/loadTerritoryOverview'
import {
  clearTerritoryListFilters,
  type TerritoryFilterOption,
} from '@/utilities/territory/territoryListFilters'
import {
  buildTerritoryListHref,
  formatTerritoryListSortSummary,
  resolveTerritoryListSort,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'
import {
  flattenTerritoryRows,
  type TerritoryOverviewRow,
} from '@/utilities/territory/territoryOverview'

const TerritoryListEmptyState = ({ state }: { state: TerritoryListState }) => (
  <Empty className="min-h-56 w-64 sm:w-80 md:w-auto">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhum território encontrado</EmptyTitle>
      <EmptyDescription>
        Ajuste a busca ou os filtros para comparar os territórios.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <CampaignTransitionAnchor
        href={buildTerritoryListHref(clearTerritoryListFilters(state))}
        replace
        scroll={false}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
      >
        Limpar busca e filtros
      </CampaignTransitionAnchor>
    </EmptyContent>
  </Empty>
)

export const TerritoryList = ({
  rows,
  state,
  regionOptions,
  references,
  columnVisibility,
}: {
  rows: TerritoryOverviewRow[]
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
  references: TerritoryNetworkReferences
  columnVisibility: CampaignColumnVisibility
}) => {
  const { sort, dir } = resolveTerritoryListSort(state)
  const sortSummary = formatTerritoryListSortSummary(sort, dir)

  return (
    <div data-container="territory-list" className="@container/territory-list">
      <CampaignTable
        caption={`${sortSummary}. Comparação dos Territórios de Identidade. Leitura regional; a alocação é decidida por município.`}
        className="overflow-visible"
        containerClassName="overflow-x-auto supports-[container-type:inline-size]:overflow-x-clip"
        headerClassName="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl [&_tr]:border-b-0"
        columns={territoryListColumns({ state, regionOptions, references })}
        columnVisibility={columnVisibility}
        rows={flattenTerritoryRows(rows)}
        rowKey={(row) =>
          row.variant === 'parent' ? row.region : `${row.parentRegion}-${row.label}`
        }
        rowId={(row) => (row.variant === 'parent' ? territoryAnchorId(row.region) : undefined)}
        rowClassName={(row) =>
          row.variant === 'sub' ? 'bg-muted/30' : 'scroll-mt-6 target:bg-muted/50'
        }
        empty={<TerritoryListEmptyState state={state} />}
      />
    </div>
  )
}
