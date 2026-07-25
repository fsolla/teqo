import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseTseCsvString } from '@/lib/electionResultsCsv'
import { buildElectionResultsFromCsvRows } from '@/lib/electionResultsBuild'
import type { BuiltElectionResults } from '@/lib/electionResultsBuild'
import type { TseCsvRow } from '@/lib/electionResultsParse'
import type { ElectionOffice } from '@/lib/electionResults'

const fixtureDir = join(process.cwd(), 'tests/fixtures/tse')

const readFixture = (name: string): string => readFileSync(join(fixtureDir, name), 'utf8')

const remapFixtureYear = (rows: readonly TseCsvRow[], year: number): TseCsvRow[] =>
  rows.map((row) => ({ ...row, ANO_ELEICAO: String(year) }))

export const loadTseFixtureResults = (): BuiltElectionResults =>
  loadTseFixtureResultsForYear(2022)

export const loadTseFixtureResultsForYear = (
  year: number,
  offices?: ReadonlySet<ElectionOffice>,
): BuiltElectionResults => {
  const voteRows = remapFixtureYear(
    parseTseCsvString(readFixture('votacao_candidato_munzona_fixture.csv')),
    year,
  )
  const tallyRows = remapFixtureYear(
    parseTseCsvString(readFixture('detalhe_votacao_munzona_fixture.csv')),
    year,
  )
  const candBaRows = remapFixtureYear(
    parseTseCsvString(readFixture('consulta_cand_ba_fixture.csv')),
    year,
  )
  const candBrRows = remapFixtureYear(
    parseTseCsvString(readFixture('consulta_cand_br_fixture.csv')),
    year,
  )

  return buildElectionResultsFromCsvRows({
    voteRows,
    tallyRows,
    candBaRows,
    candBrRows,
    year,
    ...(offices ? { offices } : {}),
  })
}

/** Known totals from the fixture (after skipping the zero-vote row). */
export const TSE_FIXTURE_EXPECTED = {
  sollaVotesTotal: 1200 + 900 + 500,
  lulaTurn2SalvadorZ1: 8000,
  jeronimoTurn2SalvadorZ1: 6000,
  federalWinnerSalvadorZ2: { candidateNumber: 2222, votes: 1100 },
  federalWinnerSalvadorZ1: { candidateNumber: 1313, votes: 1200 },
  voteRowCount: 15, // 16 CSV rows minus the zero-vote row
  tallyRowCount: 8,
} as const

