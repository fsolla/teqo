import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { ELECTION_YEAR_2014, ELECTION_YEAR_2018 } from '@/lib/electionResults'
import { parseTseCsvString } from '@/lib/electionResultsCsv'
import { buildElectionResultsFromCsvRows, FEDERAL_ONLY_OFFICES } from '@/lib/electionResultsBuild'
import type { BuiltElectionResults } from '@/lib/electionResultsBuild'
import type { TseCsvRow } from '@/lib/electionResultsParse'
import type { ElectionOffice } from '@/lib/electionResults'
import { buildImportBundles, importElectionBundles } from '@/utilities/electionResultsImport'

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

/** Per-zone federal deputy T1 totals used by list-election overview int tests. */
export const TSE_FIXTURE_ZONE_EXPECTED = {
  salvadorZ1: { aptos: 10_000, abstencoes: 2000, sollaVotes2022: 1200, confirmedVoteEstimate: 2000 },
  salvadorZ2: { aptos: 9000, abstencoes: 1800, sollaVotes2022: 900, confirmedVoteEstimate: 100 },
} as const

/** Import 2022 full scope plus federal-only 2018/2014 for E2 trend series int tests. */
export const seedMultiYearFederalCandidateFixture = async (payload: Payload): Promise<void> => {
  await importElectionBundles(payload, buildImportBundles(loadTseFixtureResults()))
  await importElectionBundles(
    payload,
    buildImportBundles(loadTseFixtureResultsForYear(ELECTION_YEAR_2018, FEDERAL_ONLY_OFFICES)),
  )
  await importElectionBundles(
    payload,
    buildImportBundles(loadTseFixtureResultsForYear(ELECTION_YEAR_2014, FEDERAL_ONLY_OFFICES)),
  )
}
