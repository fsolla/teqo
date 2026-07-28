import Link from 'next/link'

import { TerritorySortableHead } from '@/components/campaign/municipality/TerritorySortableHead'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import type { CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  formatGoalCoverageDeficitShortLabel,
  formatGoalCoverageRatioLabel,
  formatRatioAsPercentLabel,
} from '@/utilities/goalCoverage'
import {
  formatTerritorialClassWhy,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipalityLabels'
import type { TerritoryFilterOption } from '@/utilities/territoryListFilters'
import { territoryColumnDescriptions } from '@/utilities/territoryListLabels'
import { territoryListSortLabels, type TerritoryListState } from '@/utilities/territoryListUrl'
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

const TerritorialClassCell = ({ row }: { row: TerritoryTableRow }) => {
  const territorialClass = row.territorialClass
  if (!territorialClass) {
    return <span className="text-muted-foreground">—</span>
  }
  const why = formatTerritorialClassWhy(territorialClass.factors)
  if (territorialClass.class === 'sem_base') {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{why}</span>
      </span>
    )
  }
  return (
    <>
      <Badge variant={territorialClassBadgeVariant[territorialClass.class]}>
        {territorialClassLabels[territorialClass.class]}
      </Badge>
      <span className="sr-only">{why}</span>
    </>
  )
}

const captureTooltipContent = (row: TerritoryTableRow) => {
  const parts: string[] = []
  if (row.medianCapture != null) {
    parts.push(`Mediana no território: ${formatRatioAsPercentLabel(row.medianCapture)}`)
  }
  if (row.captureMin != null && row.captureMax != null) {
    parts.push(
      `Amplitude: ${formatRatioAsPercentLabel(row.captureMin)} – ${formatRatioAsPercentLabel(row.captureMax)}`,
    )
  }
  if (row.criticalMunicipality && row.criticalMunicipality.deficit > 0) {
    parts.push(
      `Município crítico (maior déficit de meta): ${row.criticalMunicipality.name} (faltam ${formatElectionNumber(row.criticalMunicipality.deficit)} votos)`,
    )
  }
  if (row.captureBeacon) {
    parts.push(
      `Referência de captura no território: ${row.captureBeacon.name} (${formatRatioAsPercentLabel(row.captureBeacon.captureRate)})`,
    )
  }
  if (parts.length === 0) {
    return 'Sem dados de captura 2022 neste recorte.'
  }
  return (
    <div className="flex flex-col gap-1">
      {parts.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {row.criticalMunicipality && row.criticalMunicipality.deficit > 0 ? (
        <Link
          href={`/campanha/municipios/${row.criticalMunicipality.slug}`}
          className="font-medium underline underline-offset-2"
        >
          Abrir município crítico
        </Link>
      ) : null}
      <p className="text-background/70">
        A captura do território é a soma dos votos próprios ÷ soma dos tetos — não a média das
        capturas por município.
      </p>
    </div>
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
    label: territoryListSortLabels.region,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="region"
        filterParam="region"
        filterOptions={regionOptions}
        description={territoryColumnDescriptions.region}
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
    label: territoryListSortLabels.municipalities,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="municipalities"
        align="right"
        description={territoryColumnDescriptions.municipalities}
      />
    ),
    cell: (row) => row.municipalityCount,
    cellClassName: 'text-right tabular-nums',
  },
  {
    id: 'votes2022',
    label: territoryListSortLabels.votes2022,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="votes2022"
        align="right"
        description={territoryColumnDescriptions.votes2022}
      />
    ),
    cell: (row) => <YearSeriesCell votesByYear={row.votesByYear} />,
    cellClassName: 'text-right tabular-nums',
  },
  {
    id: 'pct',
    label: territoryListSortLabels.pct,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="pct"
        align="right"
        description={territoryColumnDescriptions.pct}
      />
    ),
    cell: (row) => formatPercent(row.pctPropriaVotacao),
    cellClassName: (row) =>
      `text-right tabular-nums ${row.variant === 'parent' ? 'font-medium' : 'text-muted-foreground'}`,
  },
  {
    id: 'validVotes2022',
    label: territoryListSortLabels.validVotes2022,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="validVotes2022"
        align="right"
        description={territoryColumnDescriptions.validVotes2022}
      />
    ),
    cell: (row) => formatElectionNumber(row.validVotes2022),
    cellClassName: 'text-right tabular-nums text-muted-foreground',
  },
  {
    id: 'estimate2026',
    label: territoryListSortLabels.estimate2026,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="estimate2026"
        align="right"
        description={territoryColumnDescriptions.estimate2026}
      />
    ),
    cell: (row) => formatElectionNumber(row.estimate2026),
    cellClassName: (row) =>
      `text-right tabular-nums ${row.variant === 'sub' ? 'text-muted-foreground' : ''}`,
  },
  {
    id: 'cobertura',
    label: territoryListSortLabels.cobertura,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="cobertura"
        align="right"
        description={territoryColumnDescriptions.cobertura}
      />
    ),
    cell: (row) => (
      <div className="flex flex-col items-end">
        <span className="font-medium tabular-nums">
          {formatGoalCoverageRatioLabel(row.goalCoverage)}
        </span>
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title="Déficit agregado (cenário média)"
        >
          {formatGoalCoverageDeficitShortLabel(row.goalCoverage)}
        </span>
      </div>
    ),
    cellClassName: 'text-right',
  },
  {
    id: 'captura',
    label: territoryListSortLabels.captura,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="captura"
        align="right"
        description={territoryColumnDescriptions.captura}
      />
    ),
    cell: (row) => formatRatioAsPercentLabel(row.captureRate),
    cellClassName: 'text-right tabular-nums',
    cellTooltip: (row) => captureTooltipContent(row),
  },
  {
    id: 'classe',
    label: territoryListSortLabels.classe,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="classe"
        align="right"
        description={territoryColumnDescriptions.classe}
      />
    ),
    cell: (row) => <TerritorialClassCell row={row} />,
    cellClassName: 'text-right',
    cellTooltip: (row) =>
      row.territorialClass ? formatTerritorialClassWhy(row.territorialClass.factors) : undefined,
  },
  {
    id: 'coverage',
    label: territoryListSortLabels.coverage,
    head: (
      <TerritorySortableHead
        state={state}
        sortKey="coverage"
        align="right"
        filterParam="coverage"
        description={territoryColumnDescriptions.coverage}
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
