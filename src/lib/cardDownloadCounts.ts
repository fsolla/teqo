/**
 * S32 — the pure view model of the anonymous card-download counters of the
 * staff home. One absolute counter per card model, in the natural catalog
 * order; no total, no percentage, no series: the numbers count downloads,
 * never people (there is no visitor identity to count).
 *
 * Client-safe and free of Payload/Next: the loader feeds it the aggregate rows
 * (or `null` when the read failed) and the component renders the view.
 */

import { CARD_MODELS, type CardModelId } from '@/lib/cardModels'
import type { ContentEventAggregateRow } from '@/lib/contentEvents'

export const CARD_DOWNLOAD_COUNTS_TITLE = 'Cards'
export const CARD_DOWNLOAD_COUNTS_SUBTITLE = 'Downloads anônimos acumulados desde o lançamento.'
export const CARD_DOWNLOAD_COUNTS_CAPTION =
  'Os números contam downloads, não pessoas ou visitantes únicos.'
export const CARD_DOWNLOAD_COUNTS_EMPTY_TITLE = 'Nenhum download ainda'
export const CARD_DOWNLOAD_COUNTS_EMPTY_BODY =
  'Os contadores aparecem quando alguém baixar um card.'
export const CARD_DOWNLOAD_COUNTS_EMPTY_CAPTION =
  'A contagem será anônima e mostrará downloads por modelo, nunca pessoas.'

/** The one event type counted per card model (S32 v1). */
const CARD_DOWNLOAD_EVENT_TYPE = 'download'

export type CardDownloadCount = {
  modelId: CardModelId
  label: string
  count: number
}

export type CardDownloadCountsView =
  | { state: 'data'; counts: CardDownloadCount[] }
  | { state: 'empty' }
  | { state: 'unavailable' }

/**
 * Counts per model id, ignoring anything that is not the card-download event
 * and any id outside the catalog (the mapping below is the catalog itself).
 */
export const cardDownloadCountsFromRows = (
  rows: readonly ContentEventAggregateRow[],
): CardDownloadCount[] => {
  const countByModelId = new Map<string, number>()

  for (const row of rows) {
    if (row.type !== CARD_DOWNLOAD_EVENT_TYPE) continue
    const count = Number.isFinite(row.count) ? Math.max(0, Math.trunc(row.count)) : 0
    countByModelId.set(row.subjectId, (countByModelId.get(row.subjectId) ?? 0) + count)
  }

  return CARD_MODELS.map((model) => ({
    modelId: model.id,
    label: model.label,
    count: countByModelId.get(model.id) ?? 0,
  }))
}

/**
 * `null` means the aggregate read failed — the view is `unavailable`, which
 * never renders as "no downloads yet" (that state is only for real zeros).
 */
export const resolveCardDownloadCounts = (
  rows: readonly ContentEventAggregateRow[] | null,
): CardDownloadCountsView => {
  if (rows === null) return { state: 'unavailable' }

  const counts = cardDownloadCountsFromRows(rows)
  return counts.some((entry) => entry.count > 0) ? { state: 'data', counts } : { state: 'empty' }
}
