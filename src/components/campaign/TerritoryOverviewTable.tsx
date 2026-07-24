'use client'

import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatElectionNumber } from '@/lib/electionInsights'
import {
  sortTerritoryRows,
  type TerritoryOverviewRow,
  type TerritorySortDir,
  type TerritorySortKey,
} from '@/utilities/territoryOverview'

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatPercent = (ratio: number): string => `${percentFormatter.format(ratio * 100)}%`

type ColumnDef = {
  key: TerritorySortKey
  label: string
  align: 'left' | 'right'
}

const COLUMNS: ColumnDef[] = [
  { key: 'region', label: 'Território', align: 'left' },
  { key: 'municipalities', label: 'Municípios', align: 'right' },
  { key: 'votes2022', label: 'Votos 2022', align: 'right' },
  { key: 'pct', label: '% da votação', align: 'right' },
  { key: 'validVotes2022', label: 'Válidos 2022', align: 'right' },
  { key: 'estimate2026', label: 'Estimativa 2026', align: 'right' },
  { key: 'coverage', label: 'Com assessor', align: 'right' },
]

type TerritoryOverviewTableProps = {
  rows: TerritoryOverviewRow[]
}

export const TerritoryOverviewTable = ({ rows }: TerritoryOverviewTableProps) => {
  const [sortKey, setSortKey] = useState<TerritorySortKey>('pct')
  const [sortDir, setSortDir] = useState<TerritorySortDir>('desc')

  const sortedRows = useMemo(
    () => sortTerritoryRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir],
  )

  const toggleSort = (key: TerritorySortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'region' ? 'asc' : 'desc')
    }
  }

  const sortIcon = (key: TerritorySortKey) => {
    if (key !== sortKey) return <ChevronsUpDownIcon className="text-muted-foreground/50" aria-hidden="true" />
    return sortDir === 'asc' ? (
      <ChevronUpIcon aria-hidden="true" />
    ) : (
      <ChevronDownIcon aria-hidden="true" />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => {
              const isActive = column.key === sortKey
              return (
                <TableHead
                  key={column.key}
                  aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={column.align === 'right' ? 'text-right' : 'text-left'}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {sortIcon(column.key)}
                    {column.label}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TerritoryRow key={row.region} row={row} />
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Leitura regional; alocação decide-se por município. % da votação = votos do TI ÷ votos estaduais (2022).
      </p>
    </div>
  )
}

const TerritoryRow = ({ row }: { row: TerritoryOverviewRow }) => (
  <>
    <TableRow>
      <TableCell>
        <Link
          href={`/campanha/municipios?region=${encodeURIComponent(row.region)}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.region}
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.municipalityCount}</TableCell>
      <TableCell className="text-right tabular-nums">
        <YearSeriesCell votesByYear={row.votesByYear} />
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatPercent(row.pctPropriaVotacao)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatElectionNumber(row.validVotes2022)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatElectionNumber(row.estimate2026)}</TableCell>
      <TableCell className="text-right">
        <CoverageCell withAdvisorCount={row.withAdvisorCount} total={row.municipalityCount} />
      </TableCell>
    </TableRow>
    {row.subRows?.map((subRow) => (
      <TableRow key={`${row.region}-${subRow.label}`} className="bg-muted/30">
        <TableCell className="pl-6 text-muted-foreground">{subRow.label}</TableCell>
        <TableCell className="text-right tabular-nums">{subRow.municipalityCount}</TableCell>
        <TableCell className="text-right tabular-nums">
          <YearSeriesCell votesByYear={subRow.votesByYear} />
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatPercent(subRow.pctPropriaVotacao)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatElectionNumber(subRow.validVotes2022)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatElectionNumber(subRow.estimate2026)}
        </TableCell>
        <TableCell className="text-right">
          <CoverageCell withAdvisorCount={subRow.withAdvisorCount} total={subRow.municipalityCount} muted />
        </TableCell>
      </TableRow>
    ))}
  </>
)

const YearSeriesCell = ({ votesByYear }: { votesByYear: Record<string, number> }) => {
  const votes2022 = votesByYear['2022'] ?? 0
  const prior = [
    { year: '2014', value: votesByYear['2014'] ?? 0 },
    { year: '2018', value: votesByYear['2018'] ?? 0 },
  ]
  return (
    <details className="group inline-flex flex-row-reverse items-center gap-1">
      <summary className="cursor-pointer list-none tabular-nums" aria-label="Série 2014 e 2018">
        {formatElectionNumber(votes2022)}
      </summary>
      <span className="hidden text-xs text-muted-foreground group-open:inline">
        {prior.map((p) => `${p.year}: ${formatElectionNumber(p.value)}`).join(' · ')}
      </span>
    </details>
  )
}

const CoverageCell = ({
  withAdvisorCount,
  total,
  muted = false,
}: {
  withAdvisorCount: number
  total: number
  muted?: boolean
}) => {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  if (withAdvisorCount === 0) {
    return <Badge variant="estimate-pending">0 de {total}</Badge>
  }
  return (
    <span className={muted ? 'text-muted-foreground tabular-nums' : 'tabular-nums'}>
      {withAdvisorCount} de {total}
    </span>
  )
}
