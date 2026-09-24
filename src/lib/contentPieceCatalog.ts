/**
 * S27 — pure contract of the public Central de Conteúdos (`/conteudos`): the
 * URL vocabulary (path, filters, search), the in-memory filtering over the
 * published list and the serializable view model the cards and the piece page
 * render. No I/O and no `server-only`: the cached public read, the server
 * components and the unit tests share this module.
 *
 * The staff list contract (`src/utilities/content/contentPieceListUrl.ts`) is
 * deliberately NOT reused: its vocabulary (status, processing, page) is
 * internal and the public surface has its own facets with a single value each.
 *
 * S38 — the six personalized-card models are synthetic items of the same board
 * (`CardCatalogItem`): no row, no file, no publication — each item is an invite
 * that routes the visitor to `/cards?model=<id>`. They share the facet/search
 * pipeline (Tipo gains `card`; the geographic facets never do) and the honest
 * empty state.
 */
import { CARD_MODELS, type CardModel, type CardModelId } from '@/lib/cardModels'
import {
  CONTENT_PIECE_TYPES,
  contentPieceIsPublic,
  contentPieceOriginLabels,
  contentPieceTopicLabel,
  contentPieceTypeLabels,
  isContentPieceOrigin,
  isContentPieceStatus,
  isContentPieceTopic,
  isContentPieceType,
  type ContentPieceOrigin,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { slugify } from '@/lib/slug'
import { formatSpeechClock, formatSpeechDate } from '@/lib/speechClock'
import { SPEECH_TOPICS, type SpeechTopic } from '@/lib/speechFacets'
import { buildHighlightedExcerpt, type SpeechHighlightPart } from '@/lib/speechHighlight'
import { normalizeForSearch, uniqueByNormalizedForm } from '@/lib/speechSearch'

export const CONTENT_PIECE_CATALOG_PATH = '/conteudos'

export const contentPiecePublicPath = (slug: string): string =>
  `${CONTENT_PIECE_CATALOG_PATH}/${slug}`

export const contentPieceMediaPath = (slug: string): string =>
  `${contentPiecePublicPath(slug)}/midia`

export const CONTENT_PIECE_CATALOG_FACETS = [
  'tipo',
  'cidade',
  'regiao',
  'tema',
  'instituicao',
] as const

export type ContentPieceCatalogFacet = (typeof CONTENT_PIECE_CATALOG_FACETS)[number]

export const contentPieceCatalogFacetLabels: Record<ContentPieceCatalogFacet, string> = {
  tipo: 'Tipo',
  cidade: 'Cidade',
  regiao: 'Região',
  tema: 'Tema',
  instituicao: 'Instituição',
}

/**
 * S28 — search mode of the public catalogue. `tema` asks the theme expansion
 * for related terms; the literal search is the default and is never serialized
 * (existing deep links stay byte-identical). Only meaningful alongside `q`.
 */
export type ContentPieceCatalogMode = 'tema'

export type ContentPieceCatalogParams = {
  tipo: ContentPieceType | null
  cidade: string | null
  regiao: string | null
  tema: SpeechTopic | null
  instituicao: string | null
  q: string
  mode: ContentPieceCatalogMode | null
}

export type ContentPieceCatalogSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? ''

const FACET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * One value per facet; unknown enum values and non-slug labels are dropped
 * (a hand-typed `?tipo=../etc` never reaches a query or a comparison).
 */
export const parseContentPieceCatalogParams = (
  raw: ContentPieceCatalogSearchParams,
): ContentPieceCatalogParams => {
  const tipo = firstValue(raw.tipo)
  const tema = firstValue(raw.tema)
  const q = firstValue(raw.q)
  const slugFacet = (facet: ContentPieceCatalogFacet): string | null => {
    const value = firstValue(raw[facet])
    return value && FACET_SLUG_PATTERN.test(value) ? value : null
  }

  return {
    tipo: isContentPieceType(tipo) ? tipo : null,
    cidade: slugFacet('cidade'),
    regiao: slugFacet('regiao'),
    tema: isContentPieceTopic(tema) ? tema : null,
    instituicao: slugFacet('instituicao'),
    q,
    // Only `tema` is meaningful; anything else (and the default) means exact,
    // and a mode without a term has nothing to expand.
    mode: firstValue(raw.mode) === 'tema' && q ? 'tema' : null,
  }
}

/** Canonical listing URL: fixed facet order, no empty params, no params at all when clean. */
export const buildContentPieceCatalogHref = (
  params: Partial<ContentPieceCatalogParams>,
): string => {
  const search = new URLSearchParams()
  if (params.tipo) search.set('tipo', params.tipo)
  if (params.cidade) search.set('cidade', params.cidade)
  if (params.regiao) search.set('regiao', params.regiao)
  if (params.tema) search.set('tema', params.tema)
  if (params.instituicao) search.set('instituicao', params.instituicao)
  const term = params.q?.trim()
  if (term) {
    search.set('q', term)
    // `tema` is the only non-default mode and it only makes sense with a query,
    // so a mode without `q` canonicalizes away.
    if (params.mode === 'tema') search.set('mode', 'tema')
  }

  const query = search.toString()
  return query ? `${CONTENT_PIECE_CATALOG_PATH}?${query}` : CONTENT_PIECE_CATALOG_PATH
}

type ContentPieceCatalogFacetOption = { value: string; label: string }

export type ContentPieceCatalogFacets = Record<
  ContentPieceCatalogFacet,
  ContentPieceCatalogFacetOption[]
>

export type ContentPieceCatalogActiveFilter = {
  facet: ContentPieceCatalogFacet | 'q'
  label: string
  value: string
  removeHref: string
}

const sortedOptions = (options: Map<string, string>): ContentPieceCatalogFacetOption[] =>
  [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

/**
 * Facet options are derived from the board items alone: a filter that cannot
 * match anything never renders. Tipo/Tema keep the persisted enum order; the
 * label facets are alphabetical by their pt-BR label.
 *
 * S38 — a card item feeds ONLY the `tipo` facet (`card`): the models are not
 * territorial and declare no theme, so Cidade/Região/Instituição/Tema never
 * grow from them.
 */
export const contentPieceCatalogFacets = (
  items: readonly ContentCatalogItem[],
): ContentPieceCatalogFacets => {
  const types = new Set<string>()
  const topics = new Set<string>()
  const cities = new Map<string, string>()
  const regions = new Map<string, string>()
  const institutions = new Map<string, string>()

  for (const item of items) {
    if (isCardCatalogItem(item)) {
      types.add('card')
      continue
    }
    types.add(item.type)
    for (const topic of item.topics) topics.add(topic)
    if (item.cityLabel) cities.set(slugify(item.cityLabel), item.cityLabel)
    if (item.regionLabel) regions.set(slugify(item.regionLabel), item.regionLabel)
    if (item.institution) institutions.set(slugify(item.institution), item.institution)
  }

  return {
    tipo: CONTENT_PIECE_TYPES.filter((type) => types.has(type)).map((type) => ({
      value: type,
      label: contentPieceTypeLabels[type],
    })),
    tema: SPEECH_TOPICS.filter((topic) => topics.has(topic.value)).map((topic) => ({
      value: topic.value,
      label: topic.label,
    })),
    cidade: sortedOptions(cities),
    regiao: sortedOptions(regions),
    instituicao: sortedOptions(institutions),
  }
}

/** The active filters in canonical order, with the URL that removes each one. */
export const contentPieceCatalogActiveFilters = (
  params: ContentPieceCatalogParams,
  facets: ContentPieceCatalogFacets,
): ContentPieceCatalogActiveFilter[] => {
  const filters: ContentPieceCatalogActiveFilter[] = []

  for (const facet of CONTENT_PIECE_CATALOG_FACETS) {
    const value = params[facet]
    if (!value) continue
    const option = facets[facet].find((candidate) => candidate.value === value)
    filters.push({
      facet,
      label: contentPieceCatalogFacetLabels[facet],
      value: option?.label ?? value,
      removeHref: buildContentPieceCatalogHref({ ...params, [facet]: null }),
    })
  }

  if (params.q.trim()) {
    filters.push({
      facet: 'q',
      label: 'Busca',
      value: params.q.trim(),
      // Clearing the search clears the mode with it: `tema` has nothing to
      // expand without a query.
      removeHref: buildContentPieceCatalogHref({ ...params, q: '', mode: null }),
    })
  }

  return filters
}

/**
 * S28 — the expanded terms that may claim "Tema" on a result: empty/duplicate
 * terms are dropped and a term equal to the literal query is not a theme match
 * (the piece surfaced by the query itself, not by the expansion).
 */
export const contentPieceThemeTerms = (query: string, themeTerms: readonly string[]): string[] => {
  const normalizedQuery = normalizeForSearch(query)
  return uniqueByNormalizedForm(themeTerms).filter(
    (term) => normalizeForSearch(term) !== normalizedQuery,
  )
}

const normalizedSearchTerms = (query: string, themeTerms: readonly string[]): string[] => {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const value of [query, ...themeTerms]) {
    const normalized = normalizeForSearch(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    terms.push(normalized)
  }
  return terms
}

/**
 * All active facets combine (AND); the term matches the denormalized haystack.
 *
 * S38 — a card item matches the Tipo facet only as `card` and never matches a
 * geographic/theme facet (the models are not territorial and declare no theme);
 * the term search runs over its `searchText` (name + aliases + description)
 * exactly like a piece's.
 */
export const filterContentPieceCatalogItems = (
  items: readonly ContentCatalogItem[],
  params: ContentPieceCatalogParams,
  themeTerms: readonly string[] = [],
): ContentCatalogItem[] => {
  const searchTerms = normalizedSearchTerms(params.q, themeTerms)

  return items.filter((item) => {
    if (isCardCatalogItem(item)) {
      if (params.tipo && params.tipo !== 'card') return false
      if (params.cidade || params.regiao || params.tema || params.instituicao) return false
    } else if (
      (params.tipo && item.type !== params.tipo) ||
      (params.cidade && (item.cityLabel === null || slugify(item.cityLabel) !== params.cidade)) ||
      (params.regiao &&
        (item.regionLabel === null || slugify(item.regionLabel) !== params.regiao)) ||
      (params.tema && !item.topics.includes(params.tema)) ||
      (params.instituicao &&
        (item.institution === null || slugify(item.institution) !== params.instituicao))
    ) {
      return false
    }
    if (searchTerms.length === 0) return true

    const haystack = normalizeForSearch(item.searchText)
    return searchTerms.some((term) => haystack.includes(term))
  })
}

export type ContentPiecePublicSource = {
  id: number
  slug?: string | null
  title?: string | null
  type?: string | null
  status?: string | null
  origin?: string | null
  topics?: string[] | null
  cityLabel?: string | null
  region?: string | null
  institution?: string | null
  description?: string | null
  transcript?: string | null
  sourceUrl?: string | null
  durationSeconds?: number | null
  pieceDate?: string | null
  searchText?: string | null
  media?: number | { id: number; filename?: string | null; mimeType?: string | null } | null
}

export type ContentPiecePublicItem = {
  id: number
  slug: string
  title: string
  type: ContentPieceType
  typeLabel: string
  origin: ContentPieceOrigin
  originLabel: string
  /** A link piece (Instagram/YouTube) has no archived file: it shares the platform link. */
  isLink: boolean
  sourceUrl: string | null
  topics: SpeechTopic[]
  topicLabels: string[]
  cityLabel: string | null
  regionLabel: string | null
  institution: string | null
  description: string | null
  /** Opening of the text/transcript, for the `texto` card asset. */
  excerpt: string | null
  durationLabel: string | null
  pieceDateLabel: string | null
  /** `Tema · Local` (or institution/city fallbacks) — the card's metadata line. */
  metaLabel: string
  searchText: string
  /** S28 — why the piece appeared in the theme mode; null in the literal search. */
  themeMatch: ContentPieceThemeMatch | null
  publicPath: string
  /** The archived file, or null on a link piece — never partially populated. */
  file: ContentPiecePublicFile | null
}

type ContentPiecePublicFile = {
  id: number
  path: string
  mimeType: string | null
  downloadFilename: string
}
/**
 * S38 — the studio deep link of one model. `/cards` already validates the id
 * and pre-selects the model (`isCardModelId`), so the item never carries a
 * second selection contract.
 */
const cardModelCatalogHref = (modelId: CardModelId): string => `/cards?model=${modelId}`

/**
 * S38 — the art of a card item: the model's real file, or the neutral
 * placeholder of the photo models (their master is the official frame with a
 * transparent photo window, never a filled example).
 */
export type CardCatalogArt =
  | { kind: 'image'; src: string }
  | { kind: 'placeholder'; shape: 'square' | 'portrait' }

/**
 * S38 — one personalized-card model as a catalogue item. Synthetic by
 * contract: no row, no file, no publication — `itemKind` marks the card side
 * of the board union and the guard below is the only narrowing point.
 */
export type CardCatalogItem = {
  itemKind: 'card'
  modelId: CardModelId
  title: string
  description: string
  aliases: readonly string[]
  badge: string | null
  art: CardCatalogArt
  href: string
  /** Raw haystack (name + aliases + description); normalized at match time. */
  searchText: string
}

/** One item of the public board: a published piece or a synthetic card model. */
export type ContentCatalogItem = ContentPiecePublicItem | CardCatalogItem

export const isCardCatalogItem = (item: ContentCatalogItem): item is CardCatalogItem =>
  'itemKind' in item && item.itemKind === 'card'

/**
 * S38 — the art of a model item. The placeholder shape mirrors the master's
 * orientation (`perfil-quadrado` is 1000×1000, `perfil-retangular` 1000×1440).
 */
const cardModelArt = (model: CardModel): CardCatalogArt =>
  model.kind === 'photo'
    ? { kind: 'placeholder', shape: model.width === model.height ? 'square' : 'portrait' }
    : { kind: 'image', src: model.previewSrc ?? model.assetSrc }

/**
 * S38 — the six models as catalogue items, in the committed catalogue order.
 * Nothing is written and nothing is published: the item is an invite to the
 * studio, never a piece to download or share.
 */
export const cardCatalogItems = (): CardCatalogItem[] =>
  CARD_MODELS.map((model) => ({
    itemKind: 'card',
    modelId: model.id,
    title: model.label,
    description: model.description,
    aliases: model.aliases,
    badge: model.badge ?? null,
    art: cardModelArt(model),
    href: cardModelCatalogHref(model.id),
    searchText: [model.label, ...model.aliases, model.description].join(' '),
  }))

/**
 * S38 — the items of the public board: the pieces (already annotated by the
 * theme search) plus the synthetic card models. The guardrail lives here:
 * `publishedCount` counts published PIECES (before any filter), so the cards
 * only ride along a non-empty Central — with nothing published, the board is
 * the honest empty state (which carries the studio path), never a grid of
 * cards.
 */
export const contentCatalogItems = (
  pieces: readonly ContentPiecePublicItem[],
  publishedCount: number,
  cards: readonly CardCatalogItem[],
): ContentCatalogItem[] => (publishedCount > 0 ? [...pieces, ...cards] : [...pieces])

export type ContentPieceMediaKind = 'video' | 'audio' | 'image' | 'text' | 'other'

/** S28 — where the "Por que apareceu" passage came from (label of the fallback). */
type ContentPieceThemeEvidenceSource = 'transcript' | 'description' | 'excerpt'

type ContentPieceThemeEvidence = {
  parts: SpeechHighlightPart[]
  truncatedStart: boolean
  truncatedEnd: boolean
  /**
   * True when the passage is the window that carries the matched term (the
   * quoted, highlighted one); false when it is a real passage of the piece that
   * does not contain the term (no quotes, no highlight, no claim).
   */
  quoted: boolean
  source: ContentPieceThemeEvidenceSource
}

export type ContentPieceThemeMatch = {
  /** The expanded term that surfaced the piece (never the literal query). */
  term: string
  /** Real passage for "Por que apareceu"; null when the piece carries no text. */
  evidence: ContentPieceThemeEvidence | null
}

/**
 * How the card/preview renders the archived file: the stored MIME decides
 * (video/audio play on demand, image previews, text shows the excerpt); an
 * unknown MIME falls back to the editorial type, and anything else stays a
 * download-only tile. A link piece has no file at all.
 */
export const contentPieceMediaKind = (
  item: Pick<ContentPiecePublicItem, 'isLink' | 'file' | 'type'>,
): ContentPieceMediaKind | null => {
  if (item.isLink) return null

  const mime = item.file?.mimeType ?? ''
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'text'
  if (mime) return 'other'

  if (item.type === 'video') return 'video'
  if (item.type === 'audio') return 'audio'
  if (item.type === 'foto' || item.type === 'card') return 'image'
  if (item.type === 'texto') return 'text'
  return 'other'
}

const DOWNLOAD_PREFIX = 'jorge-solla-1313'
const DOWNLOAD_FALLBACK_EXTENSION = 'bin'

/**
 * Legible download name: the stored upload filename can carry accents/spaces,
 * so the base comes from the public slug and the extension from the actual
 * file (same contract as the jingle download name).
 */
export const contentPieceDownloadFilename = (slug: string, filename?: string | null): string => {
  const base = slugify(slug) || 'peca'
  const lastDot = filename?.lastIndexOf('.') ?? -1
  const extension = lastDot > 0 ? filename?.slice(lastDot + 1).toLowerCase() : null
  const safeExtension =
    extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : DOWNLOAD_FALLBACK_EXTENSION

  return `${DOWNLOAD_PREFIX}-${base}.${safeExtension}`
}

const EXCERPT_MAX_LENGTH = 140

/** First non-empty paragraph of the text/transcript, truncated for the asset tile. */
export const contentPieceTextExcerpt = (
  transcript: string | null | undefined,
  maxLength = EXCERPT_MAX_LENGTH,
): string | null => {
  const paragraph = (transcript ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!paragraph) return null

  return paragraph.length <= maxLength
    ? paragraph
    : `${paragraph.slice(0, maxLength - 1).trimEnd()}…`
}

const durationLabelOf = (seconds: number | null | undefined): string | null =>
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? formatSpeechClock(seconds)
    : null

/**
 * S28 — the first expanded term that actually surfaced this piece. The gate is
 * the same normalized `includes` the filter runs over `searchText`, so the card
 * never claims a theme the search did not use. The evidence is the window that
 * carries the term (`transcript` > `description`, highlighted as one phrase);
 * when the match came from another part of the haystack (title, topic, city,
 * institution) the block falls back to a real passage of the piece without
 * highlight — text of the piece, never a fabricated quote. Terms must already
 * be filtered by `contentPieceThemeTerms` (the literal query is not a theme).
 */
export const contentPieceThemeMatch = (
  record: ContentPiecePublicSource,
  themeTerms: readonly string[],
): ContentPieceThemeMatch | null => {
  if (themeTerms.length === 0) return null

  const haystack = normalizeForSearch(record.searchText ?? '')
  const transcript = record.transcript?.trim() ?? ''
  const description = record.description?.trim() ?? ''

  for (const term of themeTerms) {
    const normalized = normalizeForSearch(term)
    if (!normalized || !haystack.includes(normalized)) continue

    if (normalizeForSearch(transcript).includes(normalized)) {
      return {
        term,
        evidence: {
          ...buildHighlightedExcerpt(transcript, term, { phrase: true }),
          quoted: true,
          source: 'transcript',
        },
      }
    }
    if (normalizeForSearch(description).includes(normalized)) {
      return {
        term,
        evidence: {
          ...buildHighlightedExcerpt(description, term, { phrase: true }),
          quoted: true,
          source: 'description',
        },
      }
    }

    // A real short passage of the piece (never the whole 1200-char description
    // on a card), without quotes: there is no matched term to point at.
    const fallback = contentPieceTextExcerpt(description || transcript)
    return {
      term,
      evidence: fallback
        ? {
            parts: [{ text: fallback, highlighted: false }],
            truncatedStart: false,
            truncatedEnd: false,
            quoted: false,
            source: description ? 'description' : 'excerpt',
          }
        : null,
    }
  }

  return null
}

const dateLabelOf = (value: string | null | undefined): string | null =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatSpeechDate(value) : null

const mediaOf = (
  media: ContentPiecePublicSource['media'],
): { id: number; filename: string | null; mimeType: string | null } | null => {
  if (typeof media === 'number') return { id: media, filename: null, mimeType: null }
  if (media && typeof media === 'object' && typeof media.id === 'number') {
    return { id: media.id, filename: media.filename ?? null, mimeType: media.mimeType ?? null }
  }
  return null
}

/**
 * Public view of one piece, or null when it may not be shown: no slug (never
 * published) or the `contentPieceIsPublic` predicate fails (published without
 * file and without link). The gate lives here too, not only in the query.
 *
 * S28 — `themeTerms` (already filtered by `contentPieceThemeTerms`) annotates
 * the item with the theme match; empty in the literal search.
 */
export const toContentPiecePublicItem = (
  record: ContentPiecePublicSource,
  { themeTerms = [] }: { themeTerms?: readonly string[] } = {},
): ContentPiecePublicItem | null => {
  const slug = record.slug?.trim()
  if (!slug) return null

  const status = isContentPieceStatus(record.status) ? record.status : 'rascunho'
  const sourceUrl = record.sourceUrl?.trim() || null
  const media = mediaOf(record.media)
  if (!contentPieceIsPublic({ status, hasFile: media !== null, sourceUrl })) return null

  const type = isContentPieceType(record.type) ? record.type : 'foto'
  const origin = isContentPieceOrigin(record.origin) ? record.origin : 'arquivo'
  const topics = (record.topics ?? []).filter(isContentPieceTopic)
  const topicLabels = topics.map(contentPieceTopicLabel)
  const cityLabel = record.cityLabel?.trim() || null
  const regionLabel = record.region?.trim() || null
  const institution = record.institution?.trim() || null
  const local = cityLabel ?? regionLabel
  const metaLabel = [topicLabels[0] ?? institution, local].filter(Boolean).join(' · ')
  const isLink = media === null && sourceUrl !== null

  return {
    id: record.id,
    slug,
    title: record.title?.trim() || `Peça ${record.id}`,
    type,
    typeLabel: contentPieceTypeLabels[type],
    origin,
    originLabel: contentPieceOriginLabels[origin],
    isLink,
    sourceUrl,
    topics,
    topicLabels,
    cityLabel,
    regionLabel,
    institution,
    description: record.description?.trim() || null,
    excerpt: contentPieceTextExcerpt(record.transcript),
    durationLabel: durationLabelOf(record.durationSeconds),
    pieceDateLabel: dateLabelOf(record.pieceDate),
    metaLabel,
    searchText: record.searchText ?? '',
    themeMatch: contentPieceThemeMatch(record, themeTerms),
    publicPath: contentPiecePublicPath(slug),
    file: media
      ? {
          id: media.id,
          path: contentPieceMediaPath(slug),
          mimeType: media.mimeType,
          downloadFilename: contentPieceDownloadFilename(slug, media.filename),
        }
      : null,
  }
}
