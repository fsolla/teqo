import type {
  CandidateVoteRow,
  ElectionCandidateRow,
  ElectionOffice,
  TseDetalheApuracaoRow,
} from '@/lib/electionResults'
import {
  ELECTION_OFFICES,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
  UnknownMunicipalityError,
} from '@/lib/electionResults'
import {
  applyStateVoteTotals,
  dedupeCandidates,
  mergeDuplicateTallyRows,
  mergeDuplicateVoteRows,
  parseCandidateVoteRow,
  parseConsultaCandRow,
  parseDetalheApuracaoRow,
  type TseCsvRow,
} from '@/lib/electionResultsParse'

const ALL_OFFICES = new Set<ElectionOffice>(ELECTION_OFFICES)
export const FEDERAL_ONLY_OFFICES = new Set<ElectionOffice>([FEDERAL_DEPUTY_OFFICE])
/**
 * Historical seed scope (2014/2018): federal deputy (E2 trend series) plus
 * presidente/governador (E8 majoritarian baseline — same rationale as the
 * 2022 full-ticket import, just for the two prior cycles). Excludes
 * deputado_estadual: no consumer needs the state-assembly race historically.
 */
export const HISTORICAL_BASELINE_OFFICES = new Set<ElectionOffice>([
  FEDERAL_DEPUTY_OFFICE,
  'presidente',
  'governador',
])
const STATE_OFFICES = new Set<ElectionOffice>([
  'governador',
  'deputado_federal',
  'deputado_estadual',
])
const PRESIDENT_OFFICE = new Set<ElectionOffice>(['presidente'])

export type BuiltElectionResults = {
  votes: CandidateVoteRow[]
  tallies: TseDetalheApuracaoRow[]
  candidates: ElectionCandidateRow[]
  unknownMunicipalities: string[]
}

const collectParsed = <T extends { year: number }>(
  rows: readonly TseCsvRow[],
  year: number,
  unknownMunicipalities: Set<string>,
  parseRow: (row: TseCsvRow) => T | null,
): T[] => {
  const out: T[] = []
  for (const row of rows) {
    try {
      const parsed = parseRow(row)
      if (parsed && parsed.year === year) out.push(parsed)
    } catch (error) {
      if (error instanceof UnknownMunicipalityError) {
        unknownMunicipalities.add(error.tseName)
        continue
      }
      throw error
    }
  }
  return out
}

/**
 * Build typed election rows from already-parsed TSE CSV tables.
 * Safe for fixtures and for the full seed (no I/O).
 */
export const buildElectionResultsFromCsvRows = (args: {
  voteRows: readonly TseCsvRow[]
  tallyRows: readonly TseCsvRow[]
  candBaRows: readonly TseCsvRow[]
  candBrRows: readonly TseCsvRow[]
  year?: number
  offices?: ReadonlySet<ElectionOffice>
}): BuiltElectionResults => {
  const year = args.year ?? ELECTION_YEAR_2022
  const offices = args.offices ?? ALL_OFFICES
  const includePresident = offices.has('presidente')
  const includeStateTicket =
    offices.has('governador') ||
    offices.has('deputado_federal') ||
    offices.has('deputado_estadual')
  const unknownMunicipalities = new Set<string>()

  // Dedupe TSE's "voto em trânsito" split rows — see mergeDuplicateVoteRows's doc.
  const votes = mergeDuplicateVoteRows(
    collectParsed(args.voteRows, year, unknownMunicipalities, (row) =>
      parseCandidateVoteRow(row, { stateFilter: 'BA', offices }),
    ),
  )
  const tallies = mergeDuplicateTallyRows(
    collectParsed(args.tallyRows, year, unknownMunicipalities, (row) =>
      parseDetalheApuracaoRow(row, { stateFilter: 'BA', offices }),
    ),
  )

  const candidatesRaw: ElectionCandidateRow[] = []
  if (includeStateTicket) {
    for (const row of args.candBaRows) {
      const parsed = parseConsultaCandRow(row, {
        stateFilter: 'BA',
        offices: STATE_OFFICES,
      })
      if (parsed && parsed.year === year && offices.has(parsed.office)) {
        candidatesRaw.push(parsed)
      }
    }
  }
  if (includePresident) {
    for (const row of args.candBrRows) {
      const parsed = parseConsultaCandRow(row, {
        stateFilter: 'BR',
        offices: PRESIDENT_OFFICE,
        forceState: 'BA',
      })
      if (parsed && parsed.year === year) candidatesRaw.push(parsed)
    }
  }

  return {
    votes,
    tallies,
    candidates: applyStateVoteTotals(dedupeCandidates(candidatesRaw), votes),
    unknownMunicipalities: [...unknownMunicipalities].sort(),
  }
}
