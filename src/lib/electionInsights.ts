import { BASELINE_TICKET_2022 } from '@/lib/electionResults'

export const NO_ELECTION_BASELINE_MESSAGE =
  'Sem baseline TSE (informe território/município)' as const

/** ±10% band between consecutive elections → stable (product default, E2). */
export const VOTE_TREND_STABLE_BAND = 0.1

/** Below this share of aptos → growth opportunity (literature reference, A5). */
export const CONVERSION_OPPORTUNITY_MAX = 0.15

/** At or above this share of aptos → stronghold (literature reference, A5). */
export const CONVERSION_REDUTO_MIN = 0.4

export type VoteTrendStatus = 'decline' | 'stable' | 'increase' | 'noBaseline'

export type VoteTrendSeries = {
  y2014: number
  y2018: number
  y2022: number
}

export type VoteTrendResult = {
  status: VoteTrendStatus
  message: string
  ratio: number | null
}

export type GapVs2022Status =
  | 'above'
  | 'below'
  | 'noBaseline'
  | 'noEstimate'
  | 'noCandidateVotes'

export type GapVs2022Result = {
  gap: number | null
  ratio: number | null
  status: GapVs2022Status
  message: string
}

export type ConversionRateBand =
  | 'reduto'
  | 'consolidado'
  | 'oportunidade'
  | 'semEstimativa'
  | 'semBaseline'
  | 'semAptos'

export type ConversionRateInput = {
  aptos: number | null
  abstencoes: number | null
  confirmedVoteEstimate: number | null
}

export type ConversionRateResult = {
  rate: number | null
  rateTurnout: number | null
  band: ConversionRateBand
  message: string
  supportLine: string | null
}

export type ConversionBandDistribution = {
  reduto: number
  consolidado: number
  oportunidade: number
}

/** Minimal baseline shape for Gap vs 2022 (full detail VM is assignable). */
export type GapVs2022Baseline = {
  candidate: { votes: number }
} | null

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const formatElectionNumber = (value: number): string => numberFormatter.format(value)

export const formatVoteTrendSeries = (series: VoteTrendSeries): string =>
  `${formatElectionNumber(series.y2014)} (2014) → ${formatElectionNumber(series.y2018)} (2018) → ${formatElectionNumber(series.y2022)} (2022)`

export const formatVoteTrendSeriesCompact = (series: VoteTrendSeries): string =>
  `2014: ${formatElectionNumber(series.y2014)} → 2018: ${formatElectionNumber(series.y2018)} → 2022: ${formatElectionNumber(series.y2022)}`

export type VoteTrendDistribution = Record<VoteTrendStatus, number>

export const emptyVoteTrendDistribution = (): VoteTrendDistribution => ({
  decline: 0,
  stable: 0,
  increase: 0,
  noBaseline: 0,
})

export const comparableTrendCount = (trend: VoteTrendDistribution): number =>
  trend.increase + trend.stable + trend.decline

export const emptyConversionBandDistribution = (): ConversionBandDistribution => ({
  reduto: 0,
  consolidado: 0,
  oportunidade: 0,
})

export const aggregateConversionBand = (
  bands: readonly ConversionRateBand[],
): ConversionBandDistribution => {
  const distribution = emptyConversionBandDistribution()
  for (const band of bands) {
    if (isComparableConversionBand(band)) {
      distribution[band] += 1
    }
  }
  return distribution
}

export const isComparableConversionBand = (
  band: ConversionRateBand,
): band is 'reduto' | 'consolidado' | 'oportunidade' =>
  band === 'reduto' || band === 'consolidado' || band === 'oportunidade'

export const conversionRateAlertVariant = (band: ConversionRateBand): 'default' | 'pending' =>
  band === 'oportunidade' ? 'pending' : 'default'

type TrendPair = { fromVotes: number; toVotes: number; fromYear: number; toYear: number }

const trendPairsByPriority = (series: VoteTrendSeries): TrendPair[] => [
  { fromVotes: series.y2018, toVotes: series.y2022, fromYear: 2018, toYear: 2022 },
  { fromVotes: series.y2014, toVotes: series.y2018, fromYear: 2014, toYear: 2018 },
  { fromVotes: series.y2014, toVotes: series.y2022, fromYear: 2014, toYear: 2022 },
]

/**
 * Classify vote trend from the federal candidate series (2014/2018/2022).
 * Uses the most recent consecutive pair with votes in both years; ±10% → stable.
 */
export const computeVoteTrend = (series: VoteTrendSeries): VoteTrendResult => {
  for (const pair of trendPairsByPriority(series)) {
    if (pair.fromVotes <= 0 || pair.toVotes <= 0) continue

    const ratio = pair.toVotes / pair.fromVotes
    const change = ratio - 1
    const percent = Math.round(Math.abs(change) * 100)

    if (Math.abs(change) <= VOTE_TREND_STABLE_BAND) {
      return {
        status: 'stable',
        ratio,
        message: `Mantém (${pair.fromYear}→${pair.toYear}, variação de ${percent}%)`,
      }
    }

    if (change > VOTE_TREND_STABLE_BAND) {
      return {
        status: 'increase',
        ratio,
        message: `Aumento (${pair.fromYear}→${pair.toYear}, +${percent}%)`,
      }
    }

    return {
      status: 'decline',
      ratio,
      message: `Queda (${pair.fromYear}→${pair.toYear}, −${percent}%)`,
    }
  }

  return {
    status: 'noBaseline',
    ratio: null,
    message: 'Sem série histórica suficiente para tendência',
  }
}

export const aggregateVoteTrend = (seriesList: readonly VoteTrendSeries[]): VoteTrendDistribution => {
  const distribution = emptyVoteTrendDistribution()
  for (const series of seriesList) {
    distribution[computeVoteTrend(series).status] += 1
  }
  return distribution
}

export const voteTrendStatusLabel = (status: VoteTrendStatus): string => {
  switch (status) {
    case 'decline':
      return 'Queda'
    case 'stable':
      return 'Mantém'
    case 'increase':
      return 'Aumento'
    case 'noBaseline':
      return 'Sem baseline'
  }
}

export const voteTrendAlertVariant = (
  status: Exclude<VoteTrendStatus, 'noBaseline'>,
): 'default' | 'pending' => (status === 'decline' ? 'pending' : 'default')

export const voteTrendBadgeVariant = (
  status: VoteTrendStatus,
): 'estimate-confirmed' | 'estimate-pending' | 'secondary' => {
  switch (status) {
    case 'increase':
      return 'estimate-confirmed'
    case 'decline':
      return 'estimate-pending'
    case 'stable':
    case 'noBaseline':
      return 'secondary'
  }
}

/**
 * Compare a confirmed vote estimate against the campaign candidate's 2022
 * votes in the same geography.
 */
export const computeGapVs2022 = (
  baseline: GapVs2022Baseline,
  confirmedVoteEstimate: number | null,
): GapVs2022Result => {
  if (!baseline) {
    return {
      gap: null,
      ratio: null,
      status: 'noBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
    }
  }

  if (confirmedVoteEstimate === null) {
    return {
      gap: null,
      ratio: null,
      status: 'noEstimate',
      message: 'Sem estimativa confirmada para comparar',
    }
  }

  const candidateVotes2022 = baseline.candidate.votes
  if (candidateVotes2022 <= 0) {
    return {
      gap: null,
      ratio: null,
      status: 'noCandidateVotes',
      message: `${BASELINE_TICKET_2022.candidate.name} não recebeu votos aqui em 2022 — território novo a abrir`,
    }
  }

  const gap = confirmedVoteEstimate - candidateVotes2022
  const ratio = confirmedVoteEstimate / candidateVotes2022

  if (gap < 0) {
    return {
      gap,
      ratio,
      status: 'below',
      message: `Faltam ${formatElectionNumber(Math.abs(gap))} votos para o patamar de 2022`,
    }
  }

  const percentAbove = Math.round((ratio - 1) * 100)
  return {
    gap,
    ratio,
    status: 'above',
    message: `Já superamos 2022 em ${percentAbove}%`,
  }
}

/**
 * Compare a confirmed vote estimate against the electorate size (aptos) in the
 * same geography. Optional turnout line uses aptos − abstencoes.
 */
export const computeConversionRate = ({
  aptos,
  abstencoes,
  confirmedVoteEstimate,
}: ConversionRateInput): ConversionRateResult => {
  if (aptos === null) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
      supportLine: null,
    }
  }

  if (confirmedVoteEstimate === null) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semEstimativa',
      message: 'Sem estimativa confirmada para calcular a conversão',
      supportLine: null,
    }
  }

  if (aptos <= 0) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semAptos',
      message: 'Sem eleitores aptos no baseline para esta geografia',
      supportLine: null,
    }
  }

  const rate = confirmedVoteEstimate / aptos
  const percent = Math.round(rate * 100)

  let band: ConversionRateBand
  if (rate < CONVERSION_OPPORTUNITY_MAX) {
    band = 'oportunidade'
  } else if (rate >= CONVERSION_REDUTO_MIN) {
    band = 'reduto'
  } else {
    band = 'consolidado'
  }

  const abst = abstencoes ?? 0
  const comparecimento = aptos - abst
  const rateTurnout = comparecimento > 0 ? confirmedVoteEstimate / comparecimento : null

  let supportLine = `${formatElectionNumber(confirmedVoteEstimate)} votos / ${formatElectionNumber(aptos)} eleitores aptos`
  if (rateTurnout !== null) {
    supportLine += ` · ${Math.round(rateTurnout * 100)}% do comparecimento`
  }

  return {
    rate,
    rateTurnout,
    band,
    message: `Taxa de conversão: ${percent}% do eleitorado apto`,
    supportLine,
  }
}
