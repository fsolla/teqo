import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import type { CandidateComparisonRow } from '@/utilities/plazaCandidateComparison'

const voteFormatter = new Intl.NumberFormat('pt-BR')

/** Candidates × years vote table for one plaza — the coordination's analysis tool. */
export const PlazaCandidateComparisonTable = ({ rows }: { rows: CandidateComparisonRow[] }) => (
  <div className="overflow-hidden rounded-xl border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidato</TableHead>
          {HISTORICAL_SERIES_YEARS.map((year) => (
            <TableHead key={year} className="text-right">
              {year}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.candidateNumber} data-reference={row.isReference || undefined}>
            <TableCell className="whitespace-normal">
              <div className="flex flex-wrap items-center gap-2">
                <span className={row.isReference ? 'font-semibold' : 'font-medium'}>
                  {row.name}
                </span>
                {row.party ? <span className="text-muted-foreground">({row.party})</span> : null}
                {row.isReference ? <Badge variant="scope">Nossa campanha</Badge> : null}
              </div>
            </TableCell>
            {HISTORICAL_SERIES_YEARS.map((year) => (
              <TableCell key={year} className="text-right tabular-nums">
                {voteFormatter.format(row.votesByYear[String(year)] ?? 0)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)
