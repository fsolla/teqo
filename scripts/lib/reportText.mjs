/**
 * Shared print-text contract for the Report builders (C163 city report + C186
 * dossiê/boletim): escaping, bare-URL anchors, the inline-source tokens
 * (`{{fonte}}` / `{{fonte:N}}`) and the text-budget primitives (C188). Extracted
 * from `cityReportRender.mjs` so the dossiê renderer does not twin the subtle
 * token resolution — one owner, two consumers.
 *
 * Text-budget rule (C188): summary surfaces never cut mid-sentence. They use
 * the researcher's `summary` when present, else the full `answer`; only the
 * deep-dive pages may cut explicitly (`excerptDeepDive`). Lists are always
 * capped with a visible counter — an item never disappears in silence.
 */

export const htmlEscape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/** Escapes the text and turns every bare URL into a clickable anchor (PDF links). */
export const htmlWithLinks = (value) =>
  htmlEscape(value).replace(URL_PATTERN, (url) => `<a href="${url}">${url}</a>`)

const INLINE_SOURCE_PATTERN = /\{\{fonte(?::(\d+))?\}\}/g

/** Drops the inline-source tokens (no source surface, e.g. the boletim). */
export const stripInlineSources = (value) =>
  String(value ?? '')
    .replace(INLINE_SOURCE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()

/**
 * Resolves the `{{fonte}}` / `{{fonte:N}}` tokens the content model leaves in
 * the citation text into `(fonte)` anchors — inline, right where the excerpt
 * cites the verified fact, so one text can point to more than one source.
 */
export const renderInlineSourcesHtml = (value, sources) =>
  htmlWithLinks(value).replace(INLINE_SOURCE_PATTERN, (_match, index) => {
    const position = Number(index ?? 1) - 1
    const url = sources?.[position]
    if (!url) return ''
    const label = sources.length > 1 ? `(fonte ${position + 1})` : '(fonte)'
    return ` <a class="inline-source" href="${htmlEscape(url)}">${label}</a>`
  })

export const renderInlineSourcesMd = (value, sources) =>
  String(value ?? '').replace(INLINE_SOURCE_PATTERN, (_match, index) => {
    const position = Number(index ?? 1) - 1
    const url = sources?.[position]
    if (!url) return ''
    const label = sources.length > 1 ? `fonte ${position + 1}` : 'fonte'
    return ` [(${label})](${url})`
  })

/**
 * Explicit cut, allowed only on **deep-dive** surfaces (signals, speech
 * mentions, Câmara actions). Summary surfaces never print "…" (C188): there the
 * text is the researcher's `summary`, the full `answer`, or a pointer line.
 */
export const excerptDeepDive = (text, max) => {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value
}

/**
 * Counting cap for a list. Every list the report renders must go through this
 * so a dropped tail is always visible ("e mais N" / "Mostrando X de Y") — an
 * item never disappears in silence (C188).
 *
 * @template T
 * @param {T[]} list
 * @param {number} max
 * @returns {{ items: T[], total: number, remaining: number }}
 */
export const capList = (list, max) => {
  const source = Array.isArray(list) ? list : []
  const items = source.slice(0, Math.max(0, max))
  return { items, total: source.length, remaining: source.length - items.length }
}

/**
 * First `limit` values joined by ", "; the remainder is always explicit
 * (`e mais N`). Unlike a character cut, this never truncates a value — it caps
 * by count and states how many were left out (C188).
 */
export const joinWithRemainder = (values, limit) => {
  const source = (Array.isArray(values) ? values : []).filter(Boolean)
  const { items, remaining } = capList(source, limit)
  return `${items.join(', ')}${remaining > 0 ? ` e mais ${remaining}` : ''}`
}

/** Copy a summary line prints when neither the researcher's `summary` nor the full text fits. */
export const SUMMARY_POINTER_COPY = 'Texto integral no aprofundamento'

/**
 * Summary-surface text of a research item: the researcher's `summary` when
 * present, else the full `answer` — so the caller can keep the deep-dive text
 * intact.
 *
 * @param {{ summary?: string|null, answer?: string|null }} item
 */
export const summaryText = (item) => {
  const summary =
    typeof item?.summary === 'string' && item.summary.trim() !== '' ? item.summary.trim() : null
  if (summary) return { text: summary, fromSummary: true }
  return { text: typeof item?.answer === 'string' ? item.answer : '', fromSummary: false }
}

/**
 * Summary-surface text of a research item: the researcher's `summary` (authored
 * to fit) when present, else the full `answer`. Returns `fromSummary` so the
 * caller knows whether a fit fallback may replace it (a summary is preserved;
 * only the un-summarized answer degrades to a pointer) — the single owner of
 * the "summary → answer → pointer" rule (C188).
 *
 * @param {{ summary?: string|null, answer?: string|null }} item
 * @param {'full'|'pointer'} textFallback
 */
export const summarySurfaceText = (item, textFallback = 'full') => {
  const { text, fromSummary } = summaryText(item)
  if (fromSummary || textFallback !== 'pointer') return { text, fromSummary }
  return { text: SUMMARY_POINTER_COPY, fromSummary: false }
}

/**
 * A joined list on a summary surface: caps by count with the remainder stated;
 * if the joined text exceeds `max`, it degrades to the summary pointer when a
 * deep-dive copy exists (`fallback='pointer'`) — never "…". The full text is
 * returned otherwise, and the page-fit guard decides.
 *
 * @param {Array<string|null|undefined>} values
 * @param {{ limit: number, max?: number, fallback?: 'full'|'pointer' }} options
 */
export const summaryListText = (values, { limit, max = 90, fallback = 'full' }) => {
  const joined = joinWithRemainder(values, limit)
  if (joined.length <= max) return joined
  return fallback === 'pointer' ? SUMMARY_POINTER_COPY : joined
}

/** "e mais N item(ns)" — the list counter copy (one owner, both reports). */
export const moreItemsLabel = (remaining, singular = 'item', plural = 'itens') =>
  `e mais ${remaining} ${remaining === 1 ? singular : plural}`

/** "Mostrando X de Y item(ns)" — the capped-list counter copy (one owner, both reports). */
export const showingLabel = (shown, total, singular = 'item', plural = 'itens') =>
  `Mostrando ${shown} de ${total} ${total === 1 ? singular : plural}`
