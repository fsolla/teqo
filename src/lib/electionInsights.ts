import { BASELINE_TICKET_2022 } from '@/lib/electionResults'

export const NO_ELECTION_BASELINE_MESSAGE =
  'Sem baseline TSE (informe território/município)' as const

/** ±10% band between consecutive elections → stable (product default, E2). */
export const VOTE_TREND_STABLE_BAND = 0.1

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
