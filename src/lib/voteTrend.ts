/**
 * "Evolução de votos" — numeric trend derived from the candidate's federal
 * series (2014/2018/2022). Distinct concept from the manually recorded
 * "Tendência política" (`municipality.politicalTrend`). Survivor of the
 * nucleus-era `electionInsights.ts`, gutted in Pass 2 W4a — the deleted
 * absolute-threshold insight clusters are superseded by E10's relative
 * territorial classification (see `docs/plans/classificacao-territorial-relativa.md`).
 */
const VOTE_TREND_STABLE_BAND = 0.1

type VoteTrendStatus = 'decline' | 'stable' | 'increase' | 'noBaseline'

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
