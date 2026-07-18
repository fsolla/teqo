import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseTseCsvString } from '@/lib/electionResultsCsv'
import { buildElectionResultsFromCsvRows } from '@/lib/electionResultsBuild'
import type { BuiltElectionResults } from '@/lib/electionResultsBuild'

const fixtureDir = join(process.cwd(), 'tests/fixtures/tse')

const readFixture = (name: string): string => readFileSync(join(fixtureDir, name), 'utf8')

export const loadTseFixtureResults = (): BuiltElectionResults => {
  const voteRows = parseTseCsvString(readFixture('votacao_candidato_munzona_fixture.csv'))
  const detalheRows = parseTseCsvString(readFixture('detalhe_votacao_munzona_fixture.csv'))
  const candBaRows = parseTseCsvString(readFixture('consulta_cand_ba_fixture.csv'))
  const candBrRows = parseTseCsvString(readFixture('consulta_cand_br_fixture.csv'))

  return buildElectionResultsFromCsvRows({
    voteRows,
    detalheRows,
    candBaRows,
    candBrRows,
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
