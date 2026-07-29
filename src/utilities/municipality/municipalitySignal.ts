/**
 * E9 "frescor" — signal freshness for the allocation queue. One rule shared by
 * the server ordering (`municipalityPageData.ts`) and the list cell, so
 * "há N dias" never disagrees with the position in the queue. Split out of the
 * former `municipalityUi.ts` in Pass 2 W1.
 */
import { latestIsoTimestamp } from '@/lib/campaignTime'
import { DAY_MS } from '@/lib/text'

/**
 * The last time ANYBODY recorded something here: a staff update or a
 * leadership pledge declaration/estimate.
 */
export const resolveMunicipalityLastSignalAt = (
  lastUpdateAt: string | null,
  lastPledgeAt: string | null,
): string | null => latestIsoTimestamp(lastUpdateAt, lastPledgeAt)

/**
 * Days since the last signal, floored. The research report only says a
 * commitment left untouched "for weeks" is worth less, so the threshold below
 * is a convention (3 weeks), not a measured decay curve.
 */
export const MUNICIPALITY_COLD_SIGNAL_DAYS = 21

export const municipalitySignalAgeInDays = (
  lastSignalAt: string | null,
  now: Date = new Date(),
): number | null => {
  if (!lastSignalAt) return null
  const elapsed = now.getTime() - new Date(lastSignalAt).getTime()
  if (Number.isNaN(elapsed)) return null
  return Math.max(0, Math.floor(elapsed / DAY_MS))
}

export const isMunicipalitySignalCold = (ageInDays: number | null): boolean =>
  ageInDays === null || ageInDays >= MUNICIPALITY_COLD_SIGNAL_DAYS

/**
 * "há 3 dias" / "hoje" / "Sem sinal" — dense cell copy for the queue.
 * Deliberately not `formatRelativeAge`: its `numeric: 'auto'` yields "ontem"/
 * "anteontem" and minute/hour granularity, which breaks both the day-based
 * cold threshold and the tabular-nums scan down the column.
 */
export const formatMunicipalitySignalAgeLabel = (ageInDays: number | null): string => {
  if (ageInDays === null) return 'Sem sinal'
  if (ageInDays === 0) return 'hoje'
  if (ageInDays === 1) return 'há 1 dia'
  return `há ${ageInDays} dias`
}

/**
 * The same age as a lowercase clause for prose ("o município nunca recebeu
 * sinal", "…sem sinal há 40 dias") — E11's silence review embeds it
 * mid-sentence, where the cell label above would break the flow.
 */
export const formatSilenceAgeLabel = (ageInDays: number | null): string =>
  ageInDays === null ? 'nunca recebeu sinal' : `sem sinal há ${ageInDays} dias`
