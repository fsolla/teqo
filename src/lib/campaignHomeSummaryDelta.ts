import { formatElectionNumber } from '@/lib/electionFormat'

/** B57 — client-safe contract for the Início hero delta (window + copy). */
export const HOME_SUMMARY_DELTA_WINDOW_DAYS = 7

export const homeSummaryDeltaPeriodLabel = `nos últimos ${HOME_SUMMARY_DELTA_WINDOW_DAYS} dias`

export type HomeSummaryDeltaDirection = 'up' | 'down' | 'flat' | 'unavailable'

export const resolveHomeSummaryDeltaDirection = (
  delta: number | null,
): HomeSummaryDeltaDirection => {
  if (delta === null) return 'unavailable'
  if (delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

/** Absolute magnitude for display; null when unavailable; "0" when flat. */
export const formatHomeSummaryDeltaMagnitude = (delta: number | null): string | null => {
  if (delta === null) return null
  if (delta === 0) return formatElectionNumber(0)
  return formatElectionNumber(Math.abs(delta))
}

export const homeSummaryDeltaAriaLabel = (delta: number | null): string => {
  const period = homeSummaryDeltaPeriodLabel
  if (delta === null) return `Variação ${period} indisponível`
  if (delta === 0) return `Sem variação ${period}`
  const formatted = formatElectionNumber(Math.abs(delta))
  return delta > 0
    ? `Aumento de ${formatted} votos ${period}`
    : `Queda de ${formatted} votos ${period}`
}
