/** Pure parsers for TSE open-data CSVs (Latin-1, `;`-separated). */

import { computeIdentityKey } from '@/lib/electionCandidateIdentity'
import {
  canonicalizeMunicipalityName,
  officeFromTseCargo,
  parseElectedStatus,
  parseTseInt,
  parseTseOptionalText,
  turnFromTse,
  type CandidateVoteRow,
  type ElectionCandidateRow,
  type ElectionOffice,
  type ElectionTurn,
  type TseDetalheApuracaoRow,
} from '@/lib/electionResults'

/**
 * Merges rows sharing the same `keyFn` key via `combine`, preserving first-seen
 * order. Shared by `mergeDuplicateVoteRows`/`mergeDuplicateTallyRows` below —
 * both fold TSE's "voto em trânsito" split rows (see their docs) and differ
 * only in the key and how colliding rows combine.
 */
const mergeByKey = <T>(
  rows: readonly T[],
  keyFn: (row: T) => string,
  combine: (existing: T, row: T) => T,
): T[] => {
  const merged = new Map<string, T>()
  for (const row of rows) {
    const key = keyFn(row)
    const existing = merged.get(key)
    merged.set(key, existing ? combine(existing, row) : row)
  }
  return [...merged.values()]
}

const voteRowKey = (row: CandidateVoteRow): string =>
  `${row.year}|${row.office}|${row.turn}|${row.state}|${row.cityCode}|${row.zoneNumber}|${row.candidateNumber}|${row.voteType}`

/**
 * TSE's presidente data (the only office open to "voto em trânsito" — voting
 * away from your registered zone, national ballot only) records the trânsito
 * ballots as a SEPARATE row sharing the same (year, office, turn, state,
 * cityCode, zoneNumber, candidateNumber, voteType) key as the regular row —
 * colliding with `ElectionCandidateVote`'s unique index, which doesn't track
 * the untracked ST_VOTO_EM_TRANSITO flag. Both rows are additive (distinct
 * electorates, same candidate/zone), so sum `votes` instead of dropping
 * either. Observed in a handful of 2014 BA zones; absent in 2018/2022 — a
 * no-op when there is nothing to merge.
 */
export const mergeDuplicateVoteRows = (rows: readonly CandidateVoteRow[]): CandidateVoteRow[] =>
  mergeByKey(rows, voteRowKey, (existing, row) => ({
    ...existing,
    votes: existing.votes + row.votes,
  }))

const tallyRowKey = (row: TseDetalheApuracaoRow): string =>
  `${row.year}|${row.office}|${row.turn}|${row.state}|${row.cityCode}|${row.zoneNumber}`

const SUMMABLE_TALLY_FIELDS = [
  'aptos',
  'comparecimento',
  'abstencoes',
  'votosValidos',
  'votosNominaisValidos',
  'votosLegenda',
  'votosBranco',
  'votosNulo',
  'votosAnulados',
] as const satisfies ReadonlyArray<keyof TseDetalheApuracaoRow>

/** Same trânsito-split merge as `mergeDuplicateVoteRows`, for tally rows (sums every count field). */
export const mergeDuplicateTallyRows = (
  rows: readonly TseDetalheApuracaoRow[],
): TseDetalheApuracaoRow[] =>
  mergeByKey(rows, tallyRowKey, (existing, row) => {
    const summed = { ...existing }
    for (const field of SUMMABLE_TALLY_FIELDS) {
      summed[field] = existing[field] + row[field]
    }
    return summed
  })

export type TseCsvRow = Record<string, string>

const cell = (row: TseCsvRow, key: string): string => row[key] ?? ''

type ScopeParseOptions = {
  /** Uppercase UF (e.g. BA). Compared as-is against SG_UF — normalize at the call site. */
  stateFilter?: string
  offices?: ReadonlySet<ElectionOffice>
}

const matchScope = (
  row: TseCsvRow,
  options: ScopeParseOptions,
): { state: string; office: ElectionOffice; turn: ElectionTurn } | null => {
  const state = cell(row, 'SG_UF').trim().toUpperCase()
  if (options.stateFilter && state !== options.stateFilter) return null

  const office = officeFromTseCargo(cell(row, 'CD_CARGO'))
  if (!office) return null
  if (options.offices && !options.offices.has(office)) return null

  const turn = turnFromTse(cell(row, 'NR_TURNO'))
  if (!turn) return null

  return { state, office, turn }
}

export type ParseVoteOptions = ScopeParseOptions & {
  /** Skip zero-vote rows (default true — collection requires votes >= 1). */
  skipZeroVotes?: boolean
}

/**
 * Parse a votacao_candidato_munzona row into a CandidateVoteRow.
 * Returns null when the row is out of scope (wrong UF/cargo) or has zero votes.
 */
export const parseCandidateVoteRow = (
  row: TseCsvRow,
  options: ParseVoteOptions = {},
): CandidateVoteRow | null => {
  const scope = matchScope(row, options)
  if (!scope) return null

  const votes = parseTseInt(cell(row, 'QT_VOTOS_NOMINAIS'))
  if ((options.skipZeroVotes ?? true) && votes <= 0) return null

  return {
    year: parseTseInt(cell(row, 'ANO_ELEICAO')),
    office: scope.office,
    turn: scope.turn,
    state: scope.state,
    cityCode: cell(row, 'CD_MUNICIPIO').trim(),
    cityName: canonicalizeMunicipalityName(cell(row, 'NM_MUNICIPIO')),
    zoneNumber: parseTseInt(cell(row, 'NR_ZONA')),
    candidateNumber: parseTseInt(cell(row, 'NR_CANDIDATO')),
    candidateName: parseTseOptionalText(cell(row, 'NM_URNA_CANDIDATO')) ?? '',
    coalition: parseTseOptionalText(cell(row, 'NM_COLIGACAO')),
    party: parseTseOptionalText(cell(row, 'SG_PARTIDO')),
    voteType: 'nominal',
    votes,
  }
}

export type ParseDetalheOptions = ScopeParseOptions

/**
 * Parse detalhe_votacao_munzona into a tally row (without winner — filled later).
 */
export const parseDetalheApuracaoRow = (
  row: TseCsvRow,
  options: ParseDetalheOptions = {},
): TseDetalheApuracaoRow | null => {
  const scope = matchScope(row, options)
  if (!scope) return null

  // Prefer QT_VOTOS_VALIDOS when present; else nominais_validos + legenda.
  const votosNominaisValidos = parseTseInt(
    cell(row, 'QT_VOTOS_NOMINAIS_VALIDOS') || cell(row, 'QT_VOTOS_NOMINAIS'),
  )
  const votosLegenda = parseTseInt(cell(row, 'QT_VOTOS_LEGENDA'))
  const votosValidos =
    parseTseInt(cell(row, 'QT_VOTOS_VALIDOS')) || votosNominaisValidos + votosLegenda

  return {
    year: parseTseInt(cell(row, 'ANO_ELEICAO')),
    office: scope.office,
    turn: scope.turn,
    state: scope.state,
    cityCode: cell(row, 'CD_MUNICIPIO').trim(),
    cityName: canonicalizeMunicipalityName(cell(row, 'NM_MUNICIPIO')),
    zoneNumber: parseTseInt(cell(row, 'NR_ZONA')),
    aptos: parseTseInt(cell(row, 'QT_APTOS')),
    comparecimento: parseTseInt(cell(row, 'QT_COMPARECIMENTO')),
    abstencoes: parseTseInt(cell(row, 'QT_ABSTENCOES')),
    votosValidos,
    votosNominaisValidos,
    votosLegenda,
    votosBranco: parseTseInt(cell(row, 'QT_VOTOS_BRANCOS')),
    votosNulo: parseTseInt(cell(row, 'QT_VOTOS_NULOS')),
    votosAnulados: parseTseInt(
      cell(row, 'QT_VOTOS_ANULADOS') || cell(row, 'QT_VOTOS_ANULADOS_APU_SEP'),
    ),
  }
}

export type ParseCandidateOptions = ScopeParseOptions & {
  /** Override state stored (presidente candidacies are national; store BA for our model). */
  forceState?: string
}

/**
 * Parse consulta_cand into ElectionCandidateRow.
 * President candidates live in the BR file (SG_UF=BR); we store state=BA for the BA campaign model.
 */
export const parseConsultaCandRow = (
  row: TseCsvRow,
  options: ParseCandidateOptions = {},
): ElectionCandidateRow | null => {
  const scope = matchScope(row, options)
  if (!scope) return null

  const urnaName = parseTseOptionalText(cell(row, 'NM_URNA_CANDIDATO')) ?? ''
  const party = parseTseOptionalText(cell(row, 'SG_PARTIDO'))
  const birthCity = parseTseOptionalText(cell(row, 'NM_MUNICIPIO_NASCIMENTO'))
  const birthState = parseTseOptionalText(cell(row, 'SG_UF_NASCIMENTO'))
  const { elected, electedBy } = parseElectedStatus(cell(row, 'DS_SIT_TOT_TURNO'), scope.turn)

  return {
    year: parseTseInt(cell(row, 'ANO_ELEICAO')),
    office: scope.office,
    turn: scope.turn,
    state: (options.forceState ?? scope.state).toUpperCase(),
    candidateNumber: parseTseInt(cell(row, 'NR_CANDIDATO')),
    urnaName,
    completeName: parseTseOptionalText(cell(row, 'NM_CANDIDATO')),
    party,
    coalition: parseTseOptionalText(cell(row, 'NM_COLIGACAO')),
    candidateStatus: parseTseOptionalText(cell(row, 'DS_SITUACAO_CANDIDATURA')),
    elected,
    electedBy,
    totalVotesState: 0,
    identityKey: computeIdentityKey({ urnaName, birthCity, birthState, party }),
    runningAgain2026: 'desconhecido',
  }
}

export type ScopeKey = {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
}

const scopeKeyString = (scope: ScopeKey): string => `${scope.year}|${scope.office}|${scope.turn}`

const candidateAggregateKey = (row: {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
  state: string
  candidateNumber: number
}): string => `${row.year}|${row.office}|${row.turn}|${row.state}|${row.candidateNumber}`

/** Deduplicate candidate rows by unique key, preferring elected=true when colliding. */
export const dedupeCandidates = (rows: readonly ElectionCandidateRow[]): ElectionCandidateRow[] => {
  const map = new Map<string, ElectionCandidateRow>()
  for (const row of rows) {
    const key = candidateAggregateKey(row)
    const existing = map.get(key)
    if (!existing || (!existing.elected && row.elected)) {
      map.set(key, row)
    }
  }
  return [...map.values()]
}

/** Aggregate nominal votes per candidate across all zones → totalVotesState. */
export const applyStateVoteTotals = (
  candidates: readonly ElectionCandidateRow[],
  votes: readonly CandidateVoteRow[],
): ElectionCandidateRow[] => {
  const totals = new Map<string, number>()
  for (const vote of votes) {
    const key = candidateAggregateKey(vote)
    totals.set(key, (totals.get(key) ?? 0) + vote.votes)
  }
  return candidates.map((candidate) => ({
    ...candidate,
    totalVotesState: totals.get(candidateAggregateKey(candidate)) ?? 0,
  }))
}

export const groupByScope = <T extends ScopeKey>(rows: readonly T[]): Map<string, T[]> => {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = scopeKeyString(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}
