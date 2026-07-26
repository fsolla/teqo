import { TerritorySortableHead } from '@/components/campaign/municipality/TerritorySortableHead'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import type { CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { TerritoryFilterOption } from '@/utilities/territoryListFilters'
import type { TerritoryListState } from '@/utilities/territoryListUrl'
import type { TerritoryTableRow } from '@/utilities/territoryOverview'

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatPercent = (ratio: number): string => `${percentFormatter.format(ratio * 100)}%`

const YearSeriesCell = ({ votesByYear }: { votesByYear: Record<string, number> }) => {
  const prior = [
    { year: '2014', value: votesByYear['2014'] ?? 0 },
    { year: '2018', value: votesByYear['2018'] ?? 0 },
  ]

  return (
    <details className="group inline-flex flex-row-reverse items-center gap-1">
      <summary
        className="cursor-pointer list-none tabular-nums"
        aria-label={`Votos em 2022: ${formatElectionNumber(votesByYear['2022'] ?? 0)}. Abrir série de 2014 e 2018`}
      >
        {formatElectionNumber(votesByYear['2022'] ?? 0)}
      </summary>
      <span className="hidden whitespace-nowrap text-xs text-muted-foreground group-open:inline">
        {prior.map(({ year, value }) => `${year}: ${formatElectionNumber(value)}`).join(' · ')}
      </span>
    </details>
  )
}

const CoverageCell = ({
  withAdvisorCount,
  total,
  muted,
}: {
  withAdvisorCount: number
  total: number
  muted: boolean
}) => {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  if (withAdvisorCount === 0) {
    return <Badge variant="estimate-pending">0 de {total}</Badge>
  }
  return (
    <span className={muted ? 'tabular-nums text-muted-foreground' : 'tabular-nums'}>
      {withAdvisorCount} de {total}
    </span>
  )
}

export const territoryListColumns = ({
  state,
  regionOptions,
}: {
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
}): Array<CampaignTableColumn<TerritoryTableRow>> => [
  {
    id: 'region',
    mandatory: true,
    defaultVisible: true,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="region"
        filterParam="region"
        filterOptions={regionOptions}
        className="sticky left-0 z-20 min-w-56 bg-background"
      />
    ),
    cell: (row) =>
      row.variant === 'parent' ? (
        <CampaignTransitionAnchor
          href={`/campanha/municipios?region=${encodeURIComponent(row.region)}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.region}
        </CampaignTransitionAnchor>
      ) : (
        <span className="pl-4 text-muted-foreground">{row.label}</span>
      ),
    cellClassName: (row) =>
      `sticky left-0 z-[5] min-w-56 ${row.variant === 'sub' ? 'bg-muted' : 'bg-background'}`,
  },
  {
    id: 'municipalities',
    defaultVisible: true,
    head: <TerritorySortableHead state={state} sortKey="municipalities" align="right" />,
    cell: (row) => row.municipalityCount,
    cellClassName: 'text-right tabular-nums',
  },
  {
    id: 'votes2022',
    defaultVisible: true,
    head: <TerritorySortableHead state={state} sortKey="votes2022" align="right" />,
    cell: (row) => <YearSeriesCell votesByYear={row.votesByYear} />,
    cellClassName: 'text-right tabular-nums',
  },
  {
    id: 'pct',
    defaultVisible: true,
    head: <TerritorySortableHead state={state} sortKey="pct" align="right" />,
    cell: (row) => formatPercent(row.pctPropriaVotacao),
    cellClassName: (row) =>
      `text-right tabular-nums ${row.variant === 'parent' ? 'font-medium' : 'text-muted-foreground'}`,
  },
  {
    id: 'validVotes2022',
    defaultVisible: true,
    head: <TerritorySortableHead state={state} sortKey="validVotes2022" align="right" />,
    cell: (row) => formatElectionNumber(row.validVotes2022),
    cellClassName: 'text-right tabular-nums text-muted-foreground',
  },
  {
    id: 'estimate2026',
    defaultVisible: true,
    head: <TerritorySortableHead state={state} sortKey="estimate2026" align="right" />,
    cell: (row) => formatElectionNumber(row.estimate2026),
    cellClassName: (row) =>
      `text-right tabular-nums ${row.variant === 'sub' ? 'text-muted-foreground' : ''}`,
  },
  {
    id: 'coverage',
    defaultVisible: true,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="coverage"
        align="right"
        filterParam="coverage"
      />
    ),
    cell: (row) => (
      <CoverageCell
        withAdvisorCount={row.withAdvisorCount}
        total={row.municipalityCount}
        muted={row.variant === 'sub'}
      />
    ),
    cellClassName: 'text-right',
  },
]
