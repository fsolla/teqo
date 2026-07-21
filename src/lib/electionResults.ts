import { bahiaMunicipalities } from '@/lib/bahiaTerritories'

export const ELECTION_YEAR_2014 = 2014 as const
export const ELECTION_YEAR_2018 = 2018 as const
export const ELECTION_YEAR_2022 = 2022 as const

/** Years loaded for prior-cycle comparison before 2022 (detail baseline query). */
export const HISTORICAL_PRIOR_SERIES_YEARS = [
  ELECTION_YEAR_2014,
  ELECTION_YEAR_2018,
] as const

/** Years shown in the federal candidate vote series (E2). */
export const HISTORICAL_SERIES_YEARS = [
  ...HISTORICAL_PRIOR_SERIES_YEARS,
  ELECTION_YEAR_2022,
] as const

export const ELECTION_OFFICE_OPTIONS = [
  { label: 'Presidente', value: 'presidente' },
  { label: 'Governador', value: 'governador' },
  { label: 'Deputado federal', value: 'deputado_federal' },
  { label: 'Deputado estadual', value: 'deputado_estadual' },
] as const

export const ELECTION_OFFICES = ELECTION_OFFICE_OPTIONS.map((o) => o.value)
export type ElectionOffice = (typeof ELECTION_OFFICES)[number]

export const FEDERAL_DEPUTY_OFFICE = 'deputado_federal' as const satisfies ElectionOffice

export const ELECTION_TURN_OPTIONS = [
  { label: '1º turno', value: '1' },
  { label: '2º turno', value: '2' },
] as const

export const ELECTION_TURNS = ELECTION_TURN_OPTIONS.map((o) => o.value)
export type ElectionTurn = (typeof ELECTION_TURNS)[number]

export const ELECTION_VOTE_TYPE_OPTIONS = [
  { label: 'Nominal', value: 'nominal' },
  { label: 'Legenda', value: 'legenda' },
] as const

export const ELECTION_VOTE_TYPES = ELECTION_VOTE_TYPE_OPTIONS.map((o) => o.value)
export type ElectionVoteType = (typeof ELECTION_VOTE_TYPES)[number]

export const ELECTION_ELECTED_BY_OPTIONS = [
  { label: 'Quociente partidário', value: 'QP' },
  { label: 'Média', value: 'média' },
  { label: '2º turno', value: '2º turno' },
] as const

export const ELECTION_ELECTED_BY = ELECTION_ELECTED_BY_OPTIONS.map((o) => o.value)
export type ElectionElectedBy = (typeof ELECTION_ELECTED_BY)[number]

export const ELECTION_RUNNING_AGAIN_OPTIONS = [
  { label: 'Sim', value: 'sim' },
  { label: 'Não', value: 'nao' },
  { label: 'Desconhecido', value: 'desconhecido' },
] as const

export const ELECTION_RUNNING_AGAIN = ELECTION_RUNNING_AGAIN_OPTIONS.map((o) => o.value)
export type ElectionRunningAgain = (typeof ELECTION_RUNNING_AGAIN)[number]

/**
 * Campaign ticket for the electoral baseline, keyed by role.
 * Swap this block (and the election year) for a future cycle — aggregation/UI stay put.
 * 2022: Jorge Solla (dep. federal BA nº 1313) / Lula (pres. nº 13) / Jerônimo (gov. nº 13).
 */
export const BASELINE_TICKET_2022 = {
  candidate: {
    candidateNumber: 1313,
    office: 'deputado_federal',
    name: 'Jorge Solla',
    party: 'PT',
    officeLabel: 'Dep. Federal',
  },
  president: { candidateNumber: 13, name: 'Lula', party: 'PT' },
  governor: { candidateNumber: 13, name: 'Jerônimo Rodrigues', party: 'PT' },
} as const

/** TSE CD_CARGO → office enum used in collections. */
export const TSE_CARGO_TO_OFFICE: Readonly<Record<string, ElectionOffice>> = {
  '1': 'presidente',
  '3': 'governador',
  '6': 'deputado_federal',
  '7': 'deputado_estadual',
}

export type ParsedElectedStatus = {
  elected: boolean
  electedBy: ElectionElectedBy | null
}

/**
 * Map TSE DS_SIT_TOT_TURNO to elected flag + electedBy.
 * Values observed in 2022 consulta_cand / votacao datasets.
 * When `turn` is `2` and the candidate is elected, electedBy defaults to `2º turno`
 * (TSE often writes plain "ELEITO" on the second-turn file).
 */
export const parseElectedStatus = (
  dsSitTotTurno: string | null | undefined,
  turn?: ElectionTurn | null,
): ParsedElectedStatus => {
  const value = (dsSitTotTurno ?? '').trim().toUpperCase()
  if (!value || value === '#NULO#' || value === 'NÃO ELEITO' || value === 'NAO ELEITO') {
    return { elected: false, electedBy: null }
  }
  if (value.includes('2º TURNO') || value.includes('2O TURNO') || value.includes('2° TURNO')) {
    // "ELEITO … 2º TURNO" counts as elected; bare "2º TURNO" means advanced only.
    if (value.startsWith('ELEITO')) {
      return { elected: true, electedBy: '2º turno' }
    }
    return { elected: false, electedBy: null }
  }
  if (value.includes('MÉDIA') || value.includes('MEDIA')) {
    return { elected: true, electedBy: 'média' }
  }
  if (value.startsWith('ELEITO')) {
    return { elected: true, electedBy: turn === '2' ? '2º turno' : 'QP' }
  }
  return { elected: false, electedBy: null }
}

/** Fold accents and case for municipality matching. */
export const normalizeMunicipalityKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

const bahiaMunicipalityByKey = new Map(
  bahiaMunicipalities.map((name) => [normalizeMunicipalityKey(name), name]),
)

/**
 * Known TSE NM_MUNICIPIO spellings that diverge from the SEPLAN/SECULT canonical
 * names in bahiaTerritories (2022 open-data files). Keys are normalizeMunicipalityKey outputs.
 */
const TSE_MUNICIPALITY_ALIASES: Readonly<Record<string, string>> = {
  // TSE: CAMACÃ → canonical Camacan
  CAMACA: 'Camacan',
  // TSE: "DIAS D ÁVILA" (space, no apostrophe) → Dias d'Ávila
  'DIAS D AVILA': "Dias d'Ávila",
  // TSE: MUQUÉM DO SÃO FRANCISCO → Muquém de São Francisco
  'MUQUEM DO SAO FRANCISCO': 'Muquém de São Francisco',
  // TSE: SANTA TEREZINHA → Santa Teresinha
  'SANTA TEREZINHA': 'Santa Teresinha',
}

for (const [aliasKey, canonical] of Object.entries(TSE_MUNICIPALITY_ALIASES)) {
  if (!bahiaMunicipalityByKey.has(normalizeMunicipalityKey(canonical))) {
    throw new Error(`TSE alias points to unknown canonical municipality: ${canonical}`)
  }
  bahiaMunicipalityByKey.set(aliasKey, canonical)
}

export class UnknownMunicipalityError extends Error {
  constructor(public readonly tseName: string) {
    super(`Município TSE sem mapeamento canônico: "${tseName}"`)
    this.name = 'UnknownMunicipalityError'
  }
}

/** Cache raw TSE NM_MUNICIPIO → canonical (millions of repeated lookups on seed). */
const municipalityResolveCache = new Map<string, string>()

/**
 * Map TSE NM_MUNICIPIO (usually ALL CAPS) to the canonical Bahia municipality name
 * used by bahiaTerritories / plaza.city. Fails closed on unknown names.
 */
export const canonicalizeMunicipalityName = (tseMunicipalityName: string): string => {
  const cached = municipalityResolveCache.get(tseMunicipalityName)
  if (cached) return cached

  const key = normalizeMunicipalityKey(tseMunicipalityName)
  const canonical = bahiaMunicipalityByKey.get(key)
  if (!canonical) {
    throw new UnknownMunicipalityError(tseMunicipalityName)
  }
  municipalityResolveCache.set(tseMunicipalityName, canonical)
  return canonical
}

export const isElectionTurn = (value: string): value is ElectionTurn =>
  (ELECTION_TURNS as readonly string[]).includes(value)

export type CandidateVoteRow = {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
  state: string
  cityCode: string
  cityName: string
  zoneNumber: number
  candidateNumber: number
  candidateName: string
  coalition: string | null
  party: string | null
  voteType: ElectionVoteType
  votes: number
}

/** Winner fields as stored on electionTally (null when no nominal votes in that cell). */
export type TallyWinner = {
  winnerCandidateNumber: number | null
  winnerCandidateName: string | null
  winnerVotes: number | null
  winnerCoalition: string | null
  winnerParty: string | null
}

type ResolvedWinner = {
  winnerCandidateNumber: number
  winnerCandidateName: string
  winnerVotes: number
  winnerCoalition: string | null
  winnerParty: string | null
}

const EMPTY_WINNER: TallyWinner = {
  winnerCandidateNumber: null,
  winnerCandidateName: null,
  winnerVotes: null,
  winnerCoalition: null,
  winnerParty: null,
}

export const winnerKey = (cityCode: string, zoneNumber: number, office: ElectionOffice, turn: ElectionTurn) =>
  `${cityCode}|${zoneNumber}|${office}|${turn}`

/**
 * Compute the local winner (highest nominal votes) for each city+zone+office+turn.
 * Ties: first seen candidate with the max vote count wins (stable for import order).
 */
export const computeWinnersByScope = (
  votes: readonly CandidateVoteRow[],
): Map<string, ResolvedWinner> => {
  const winners = new Map<string, ResolvedWinner>()

  for (const row of votes) {
    if (row.voteType !== 'nominal' || row.votes <= 0) continue
    const key = winnerKey(row.cityCode, row.zoneNumber, row.office, row.turn)
    const current = winners.get(key)
    if (!current || current.winnerVotes < row.votes) {
      winners.set(key, {
        winnerCandidateNumber: row.candidateNumber,
        winnerCandidateName: row.candidateName,
        winnerVotes: row.votes,
        winnerCoalition: row.coalition,
        winnerParty: row.party,
      })
    }
  }

  return winners
}

export type TseDetalheApuracaoRow = {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
  state: string
  cityCode: string
  cityName: string
  zoneNumber: number
  aptos: number
  comparecimento: number
  abstencoes: number
  votosValidos: number
  votosNominaisValidos: number
  votosLegenda: number
  votosBranco: number
  votosNulo: number
  votosAnulados: number
}

export type ElectionTallyRow = TseDetalheApuracaoRow & TallyWinner

export type ElectionCandidateRow = {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
  state: string
  candidateNumber: number
  urnaName: string
  completeName: string | null
  party: string | null
  coalition: string | null
  candidateStatus: string | null
  elected: boolean
  electedBy: ElectionElectedBy | null
  totalVotesState: number
  identityKey: string
  runningAgain2026: ElectionRunningAgain
}

export const mergeTallyWithWinners = (
  tallies: readonly TseDetalheApuracaoRow[],
  winners: ReadonlyMap<string, ResolvedWinner>,
): ElectionTallyRow[] =>
  tallies.map((tally) => {
    const winner =
      winners.get(winnerKey(tally.cityCode, tally.zoneNumber, tally.office, tally.turn)) ??
      EMPTY_WINNER
    return { ...tally, ...winner }
  })

/** Parse a TSE integer cell that may be "#NULO#" / empty. */
export const parseTseInt = (value: string | undefined | null, fallback = 0): number => {
  if (value == null) return fallback
  const trimmed = value.trim()
  if (!trimmed || trimmed === '#NULO#' || trimmed === '#NE#') return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

export const parseTseOptionalText = (value: string | undefined | null): string | null => {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === '#NULO#' || trimmed === '#NE#') return null
  return trimmed
}

export const officeFromTseCargo = (cdCargo: string): ElectionOffice | null => {
  const office = TSE_CARGO_TO_OFFICE[cdCargo.trim()]
  return office ?? null
}

export const turnFromTse = (nrTurno: string): ElectionTurn | null => {
  const turn = nrTurno.trim()
  return isElectionTurn(turn) ? turn : null
}

export const assertAllCanonicalMunicipalitiesResolvable = (): void => {
  for (const name of bahiaMunicipalities) {
    const resolved = canonicalizeMunicipalityName(name)
    if (resolved !== name) {
      throw new Error(`canonicalizeMunicipalityName drifted for "${name}" → "${resolved}"`)
    }
  }
}
