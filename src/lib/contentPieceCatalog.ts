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
 */
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
import { normalizeForSearch } from '@/lib/speechSearch'

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

export type ContentPieceCatalogParams = {
  tipo: ContentPieceType | null
  cidade: string | null
  regiao: string | null
  tema: SpeechTopic | null
  instituicao: string | null
  q: string
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
    q: firstValue(raw.q),
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
  if (term) search.set('q', term)

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
 * Facet options are derived from the published items alone: a filter that
 * cannot match anything never renders. Tipo/Tema keep the persisted enum
 * order; the label facets are alphabetical by their pt-BR label.
 */
export const contentPieceCatalogFacets = (
  items: readonly ContentPiecePublicItem[],
): ContentPieceCatalogFacets => {
  const types = new Set<string>()
  const topics = new Set<string>()
  const cities = new Map<string, string>()
  const regions = new Map<string, string>()
  const institutions = new Map<string, string>()

  for (const item of items) {
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
      removeHref: buildContentPieceCatalogHref({ ...params, q: '' }),
    })
  }

  return filters
}

/** All active facets combine (AND); the term matches the denormalized haystack. */
export const filterContentPieceCatalogItems = (
  items: readonly ContentPiecePublicItem[],
  params: ContentPieceCatalogParams,
): ContentPiecePublicItem[] => {
  const term = normalizeForSearch(params.q)

  return items.filter(
    (item) =>
      (!params.tipo || item.type === params.tipo) &&
      (!params.cidade || (item.cityLabel !== null && slugify(item.cityLabel) === params.cidade)) &&
      (!params.regiao ||
        (item.regionLabel !== null && slugify(item.regionLabel) === params.regiao)) &&
      (!params.tema || item.topics.includes(params.tema)) &&
      (!params.instituicao ||
        (item.institution !== null && slugify(item.institution) === params.instituicao)) &&
      (!term || normalizeForSearch(item.searchText).includes(term)),
  )
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

export type ContentPieceMediaKind = 'video' | 'audio' | 'image' | 'text' | 'other'

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
 */
export const toContentPiecePublicItem = (
  record: ContentPiecePublicSource,
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
