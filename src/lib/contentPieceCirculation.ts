/**
 * C213 — the four circulation counters of a piece and the honest states they
 * render in. Pure and client-safe: the internal list/detail loaders resolve the
 * raw aggregate rows into these shapes and the RSC surfaces render them; the
 * rules (precedence, literals, labels) live here, once.
 *
 * The counters are absolute, anonymous and never summed: Aberturas, Downloads,
 * WhatsApp and Link measure different choices, and a piece that has been
 * unpublished keeps its history (the numbers happened while it was public).
 */
import type { ContentEventAggregateRow, ContentEventType } from '@/lib/contentEvents'
import type { ContentPieceViewModel } from '@/lib/contentPiece'

export type ContentPieceCirculationCounts = {
  opens: number
  downloads: number
  whatsapp: number
  link: number
}

export type ContentPieceCirculationMetric = {
  key: keyof ContentPieceCirculationCounts
  eventType: ContentEventType
  /** Table/card label — "Link" is the short form. */
  label: string
  /** Detail label — "Link copiado" names the action the counter measures. */
  detailLabel: string
}

export const CONTENT_PIECE_CIRCULATION_METRICS: readonly ContentPieceCirculationMetric[] = [
  { key: 'opens', eventType: 'abertura', label: 'Aberturas', detailLabel: 'Aberturas' },
  { key: 'downloads', eventType: 'download', label: 'Downloads', detailLabel: 'Downloads' },
  {
    key: 'whatsapp',
    eventType: 'compartilhar_whatsapp',
    label: 'WhatsApp',
    detailLabel: 'WhatsApp',
  },
  { key: 'link', eventType: 'compartilhar_link', label: 'Link', detailLabel: 'Link copiado' },
]

export const EMPTY_CONTENT_PIECE_CIRCULATION: ContentPieceCirculationCounts = Object.freeze({
  opens: 0,
  downloads: 0,
  whatsapp: 0,
  link: 0,
})

export const isContentPieceCirculationEmpty = (counts: ContentPieceCirculationCounts): boolean =>
  CONTENT_PIECE_CIRCULATION_METRICS.every((metric) => counts[metric.key] <= 0)

/**
 * What one surface renders for one piece:
 * - `data` — the four counters (zeros included: the piece was published);
 * - `neverPublished` — no counters to show, the piece never entered the public
 *   Central;
 * - `unavailable` — the count could not be read right now (the design's "—").
 */
export type ContentPieceCirculationView =
  | { state: 'data'; counts: ContentPieceCirculationCounts }
  | { state: 'neverPublished' }
  | { state: 'unavailable' }

export type ContentPieceRowViewModel = ContentPieceViewModel & {
  circulation: ContentPieceCirculationView
}

/**
 * Precedence is the honesty rule: a failed read says "unavailable"; real
 * counters win over everything (an unpublished piece keeps its history); a
 * published piece with no events shows the zero literal; and only a piece that
 * never had a `publishedAt` says "ainda não publicada".
 */
export const resolveContentPieceCirculation = ({
  counts,
  hasBeenPublished,
  unavailable,
}: {
  counts?: ContentPieceCirculationCounts
  hasBeenPublished: boolean
  unavailable: boolean
}): ContentPieceCirculationView => {
  if (unavailable) return { state: 'unavailable' }
  if (counts && !isContentPieceCirculationEmpty(counts)) return { state: 'data', counts }
  if (hasBeenPublished) return { state: 'data', counts: counts ?? EMPTY_CONTENT_PIECE_CIRCULATION }
  return { state: 'neverPublished' }
}

/** Groups the aggregate rows into per-piece counters, ignoring unknown types. */
export const contentPieceCirculationFromRows = (
  rows: readonly ContentEventAggregateRow[],
): Map<number, ContentPieceCirculationCounts> => {
  const byPieceId = new Map<number, ContentPieceCirculationCounts>()

  for (const row of rows) {
    const pieceId = Number(row.subjectId)
    if (!Number.isSafeInteger(pieceId) || pieceId <= 0) continue

    const metric = CONTENT_PIECE_CIRCULATION_METRICS.find(
      (candidate) => candidate.eventType === row.type,
    )
    if (!metric) continue

    const counts = byPieceId.get(pieceId) ?? { ...EMPTY_CONTENT_PIECE_CIRCULATION }
    const value = Number(row.count)
    counts[metric.key] = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
    byPieceId.set(pieceId, counts)
  }

  return byPieceId
}

/** True when the piece is off the air but the counters are its public history. */
export const showsContentPieceCirculationHistory = (
  view: ContentPieceCirculationView,
  isPublished: boolean,
): boolean => view.state === 'data' && !isPublished && !isContentPieceCirculationEmpty(view.counts)

export const CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE = '—'
export const CONTENT_PIECE_CIRCULATION_UNAVAILABLE_LABEL = 'Contagem indisponível'
export const CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE_LABEL = 'contagem indisponível'

/** The all-zero sentence of the list/card (zero takes the singular in pt-BR). */
export const CONTENT_PIECE_CIRCULATION_ZERO_LABEL = '0 abertura · 0 download · 0 WhatsApp · 0 link'

export const CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_LABEL = 'Sem dados — ainda não publicada'
export const CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_TITLE =
  'Sem dados — esta peça ainda não foi publicada.'
export const CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_BODY =
  'A contagem começa quando ela entrar na Central pública.'

export const CONTENT_PIECE_CIRCULATION_HISTORY_LABEL =
  'Histórico de quando esteve publicada · peça fora do ar'
export const CONTENT_PIECE_CIRCULATION_HISTORY_TITLE = 'Histórico de quando esteve publicada.'
export const CONTENT_PIECE_CIRCULATION_HISTORY_BODY = 'A peça está fora do ar.'

export const CONTENT_PIECE_CIRCULATION_DETAIL_INTRO =
  'Contagem anônima e acumulada desde a publicação.'
export const CONTENT_PIECE_CIRCULATION_READING =
  'compare os sinais sem somá-los. WhatsApp e link ficam separados porque mostram escolhas diferentes.'
export const CONTENT_PIECE_CIRCULATION_UNAVAILABLE_TITLE = 'Contagem indisponível agora.'
export const CONTENT_PIECE_CIRCULATION_UNAVAILABLE_BODY =
  'A página pública, o download e o compartilhamento continuam funcionando.'
export const CONTENT_PIECE_CIRCULATION_PRIVACY =
  'sem IP persistido, cookie de identidade ou rastreio entre peças.'
