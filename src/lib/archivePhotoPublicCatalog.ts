/**
 * C233 — pure contract of the public photo album (`/fotos`): the URL vocabulary
 * (path, single-value facets, term, pagination, the non-canonical overlay id),
 * the in-memory filtering over the approved list, the derived facets and the
 * serializable view model the grid, the dialog and the removal band render. No
 * I/O and no `server-only`: the cached public read, the server components and
 * the unit tests share this module.
 *
 * Everything here is fed ONLY by approved photos: the facet vocabularies and
 * the headings are derived from the items the caller already gated through
 * `archivePhotoIsPublic`, so a filter that cannot match anything never renders
 * and the empty states stay honest.
 */
import {
  ARCHIVE_PHOTO_SCENES,
  archivePhotoIsPublic,
  archivePhotoSceneLabel,
  archivePhotoTakenOn,
  resolveArchivePhotoScene,
  type ArchivePhotoScene,
} from '@/lib/archivePhotoCatalog'
import { resolvePublicFigureName } from '@/lib/publicFigureCatalog'
import { SLUG_PATTERN, slugify } from '@/lib/slug'
import { normalizeForSearch } from '@/lib/speechSearch'

export const ARCHIVE_PHOTO_ALBUM_PATH = '/fotos'

/**
 * C234 — the selfie search entry (`/fotos/encontre`): a page of the album
 * (noindex), gated by the album global's `selfieSearchEnabled` flag and by the
 * Consent resolved server-side.
 */
export const ARCHIVE_PHOTO_ALBUM_ENTRY_PATH = `${ARCHIVE_PHOTO_ALBUM_PATH}/encontre`

/** Grid page size (design scene 07: 24 itens; prev/next preserve the facets). */
export const ARCHIVE_PHOTO_ALBUM_PAGE_SIZE = 24

/** Thumbnail width the media route resizes to (2× of the widest card). */
export const ARCHIVE_PHOTO_THUMB_WIDTH = 720

const archivePhotoMediaPath = (id: number): string => `${ARCHIVE_PHOTO_ALBUM_PATH}/${id}/midia`

const archivePhotoThumbnailPath = (id: number): string =>
  `${archivePhotoMediaPath(id)}?tamanho=grade`

const archivePhotoDownloadPath = (id: number): string => `${archivePhotoMediaPath(id)}?download=1`

/**
 * The one value per facet, in the canonical URL order (mirrors the staff list
 * contracts): `data` is one day, `municipio` a catalog slug, `atividade` a
 * scene value and `pessoa` the slug of a canonical display name. `pagina` is
 * 1-based and `foto` is the overlay-only id, never canonical.
 */
export type ArchivePhotoAlbumParams = {
  data: string | null
  municipio: string | null
  atividade: ArchivePhotoScene | null
  pessoa: string | null
  q: string
  pagina: number
  foto: number | null
}

export type ArchivePhotoAlbumSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? ''

const parsePositiveInt = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null
}

/**
 * One value per facet; unknown enum values, non-slug labels and impossible
 * days are dropped (a hand-typed `?atividade=../etc` never reaches a query or
 * a comparison), the page falls back to 1 and an invalid `foto` simply does
 * not open the overlay.
 */
export const parseArchivePhotoAlbumParams = (
  raw: ArchivePhotoAlbumSearchParams,
): ArchivePhotoAlbumParams => {
  const data = firstValue(raw.data)
  const day = archivePhotoTakenOn(data)
  const atividade = firstValue(raw.atividade)
  const municipio = firstValue(raw.municipio)
  const pessoa = firstValue(raw.pessoa)

  return {
    data: day ? day.slice(0, 10) : null,
    municipio: municipio && SLUG_PATTERN.test(municipio) ? municipio : null,
    atividade: resolveArchivePhotoScene(atividade),
    pessoa: pessoa && SLUG_PATTERN.test(pessoa) ? pessoa : null,
    q: firstValue(raw.q),
    pagina: parsePositiveInt(firstValue(raw.pagina)) ?? 1,
    foto: parsePositiveInt(firstValue(raw.foto)),
  }
}

/**
 * Canonical listing URL: fixed facet order, no empty params, `pagina=1`
 * dropped, no params at all when clean. `foto` is included only when asked
 * (the card links) — the canonical metadata and every filter-removal href pass
 * `foto: null`.
 */
export const buildArchivePhotoAlbumHref = (params: Partial<ArchivePhotoAlbumParams>): string => {
  const search = new URLSearchParams()
  if (params.data) search.set('data', params.data)
  if (params.municipio) search.set('municipio', params.municipio)
  if (params.atividade) search.set('atividade', params.atividade)
  if (params.pessoa) search.set('pessoa', params.pessoa)
  const term = params.q?.trim()
  if (term) search.set('q', term)
  if (params.pagina && params.pagina > 1) search.set('pagina', String(params.pagina))
  if (params.foto) search.set('foto', String(params.foto))

  const query = search.toString()
  return query ? `${ARCHIVE_PHOTO_ALBUM_PATH}?${query}` : ARCHIVE_PHOTO_ALBUM_PATH
}

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

const SHORT_MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

const dayPartsOf = (value: string | null | undefined): [string, string, string] | null => {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  return [match[1], match[2], match[3]]
}

/** "12 de setembro de 2026" (the dialog and the date facet label). */
export const archivePhotoLongDateLabel = (value: string | null | undefined): string | null => {
  const parts = dayPartsOf(value)
  if (!parts) return null
  const [year, month, day] = parts
  const monthLabel = MONTHS_PT[Number(month) - 1]
  if (!monthLabel) return null
  return `${Number(day)} de ${monthLabel} de ${year}`
}

/** "12 set 2026" (the card's metadata line). */
export const archivePhotoShortDateLabel = (value: string | null | undefined): string | null => {
  const parts = dayPartsOf(value)
  if (!parts) return null
  const [year, month, day] = parts
  const monthLabel = SHORT_MONTHS_PT[Number(month) - 1]
  if (!monthLabel) return null
  return `${Number(day)} ${monthLabel} ${year}`
}

/** The day (`YYYY-MM-DD`) a photo belongs to, or null — the `data` facet key. */
const archivePhotoDayOf = (value: string | null | undefined): string | null =>
  dayPartsOf(value)?.join('-') ?? null

type ArchivePhotoPublicPerson = { slug: string; name: string }

/** One appearance: canonical catalog spelling (when it resolves), slug-keyed. */
const archivePhotoPublicPeople = (names: readonly string[]): ArchivePhotoPublicPerson[] => {
  const people = new Map<string, string>()
  for (const raw of names) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const name = resolvePublicFigureName(trimmed) ?? trimmed
    const slug = slugify(name)
    if (!slug) continue
    people.set(slug, name)
  }
  return [...people.entries()].map(([slug, name]) => ({ slug, name }))
}

export type ArchivePhotoPublicSource = {
  id: number
  alt?: string | null
  takenOn?: string | null
  municipalityName?: string | null
  municipalitySlug?: string | null
  filename?: string | null
  publicationStatus?: string | null
  searchText?: string | null
  catalog?: {
    caption?: string | null
    scene?: string | null
    people?: string[] | null
  } | null
}

export type ArchivePhotoPublicItem = {
  id: number
  /** Curated alt of the file (the image's accessible text, never the filename). */
  alt: string
  /** `catalog.caption` when curated, else the alt — the card/dialog title. */
  title: string
  takenOn: string | null
  dateLabel: string | null
  shortDateLabel: string | null
  municipalityName: string | null
  municipalitySlug: string | null
  scene: ArchivePhotoScene | null
  sceneLabel: string | null
  people: string[]
  peopleLabel: string | null
  /** "12 set 2026 · Município · Plenária" — the card's metadata line. */
  metaLabel: string
  searchText: string
  thumbnailPath: string
  mediaPath: string
  downloadPath: string
  downloadFilename: string
}

/** Portuguese list join ("A", "A e B", "A, B e C"). */
const archivePhotoPeopleLabel = (people: readonly string[]): string | null => {
  const names = people.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

const DOWNLOAD_PREFIX = 'jorge-solla-1313-foto'
const FALLBACK_EXTENSION = 'jpg'

/** Legible download name (`jorge-solla-1313-foto-<id>.<ext>`), never the stored key. */
const archivePhotoDownloadFilename = (id: number, filename?: string | null): string => {
  const lastDot = filename?.lastIndexOf('.') ?? -1
  const extension = lastDot > 0 ? filename?.slice(lastDot + 1).toLowerCase() : null
  const safeExtension =
    extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : FALLBACK_EXTENSION
  return `${DOWNLOAD_PREFIX}-${id}.${safeExtension}`
}

/**
 * Public view of one photo, or null when it may not be shown: the
 * `archivePhotoIsPublic` predicate fails (draft, removed, unknown) — the gate
 * lives here too, not only in the query, so every caller is fail-closed.
 */
export const toArchivePhotoPublicItem = (
  record: ArchivePhotoPublicSource,
): ArchivePhotoPublicItem | null => {
  if (!archivePhotoIsPublic(record)) return null

  const alt = record.alt?.trim() || `Foto ${record.id}`
  const caption = record.catalog?.caption?.trim() || null
  const scene = resolveArchivePhotoScene(record.catalog?.scene)
  const sceneText = scene ? archivePhotoSceneLabel(scene) : null
  const people = archivePhotoPublicPeople(record.catalog?.people ?? [])
  const takenOn = record.takenOn ?? null
  const shortDateLabel = archivePhotoShortDateLabel(takenOn)
  const municipalityName = record.municipalityName?.trim() || null
  const municipalitySlug = record.municipalitySlug?.trim() || null
  const peopleNames = people.map((person) => person.name)

  return {
    id: record.id,
    alt,
    title: caption ?? alt,
    takenOn,
    dateLabel: archivePhotoLongDateLabel(takenOn),
    shortDateLabel,
    municipalityName,
    municipalitySlug,
    scene,
    sceneLabel: sceneText,
    people: peopleNames,
    peopleLabel: archivePhotoPeopleLabel(peopleNames),
    metaLabel: [shortDateLabel, municipalityName, sceneText].filter(Boolean).join(' · '),
    searchText: record.searchText ?? '',
    thumbnailPath: archivePhotoThumbnailPath(record.id),
    mediaPath: archivePhotoMediaPath(record.id),
    downloadPath: archivePhotoDownloadPath(record.id),
    downloadFilename: archivePhotoDownloadFilename(record.id, record.filename),
  }
}

type ArchivePhotoAlbumFacetOption = { value: string; label: string }

/**
 * The single-value facets, in the canonical URL order. One owner: the active
 * chips, the desktop menus and the mobile sheet all derive from this list.
 */
export const ARCHIVE_PHOTO_ALBUM_FACETS = ['data', 'municipio', 'atividade', 'pessoa'] as const

export type ArchivePhotoAlbumFacet = (typeof ARCHIVE_PHOTO_ALBUM_FACETS)[number]

export const archivePhotoAlbumFacetLabels: Record<ArchivePhotoAlbumFacet, string> = {
  data: 'Data',
  municipio: 'Município',
  atividade: 'Atividade',
  pessoa: 'Pessoa pública',
}

export type ArchivePhotoAlbumFacets = {
  /** Days with approved photos, most recent first. */
  data: ArchivePhotoAlbumFacetOption[]
  municipio: ArchivePhotoAlbumFacetOption[]
  atividade: ArchivePhotoAlbumFacetOption[]
  pessoa: ArchivePhotoAlbumFacetOption[]
}

const sortedByLabel = (options: Map<string, string>): ArchivePhotoAlbumFacetOption[] =>
  [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

/**
 * Facet options derived from the approved items alone: a filter that cannot
 * match anything never renders. Dias come most recent first; cenas keep the
 * closed vocabulary order; município/pessoa are alphabetical by their label.
 */
export const archivePhotoAlbumFacets = (
  items: readonly ArchivePhotoPublicItem[],
): ArchivePhotoAlbumFacets => {
  const days = new Map<string, string>()
  const municipalities = new Map<string, string>()
  const scenes = new Set<ArchivePhotoScene>()
  const people = new Map<string, string>()

  for (const item of items) {
    const day = archivePhotoDayOf(item.takenOn)
    const dayLabel = archivePhotoLongDateLabel(item.takenOn)
    if (day && dayLabel) days.set(day, dayLabel)
    if (item.municipalitySlug && item.municipalityName) {
      municipalities.set(item.municipalitySlug, item.municipalityName)
    }
    if (item.scene) scenes.add(item.scene)
    for (const person of archivePhotoPublicPeople(item.people)) {
      people.set(person.slug, person.name)
    }
  }

  return {
    data: [...days.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value)),
    municipio: sortedByLabel(municipalities),
    atividade: ARCHIVE_PHOTO_SCENES.filter((scene) => scenes.has(scene.value)).map((scene) => ({
      value: scene.value,
      label: scene.label,
    })),
    pessoa: sortedByLabel(people),
  }
}

export type ArchivePhotoAlbumActiveFilter = {
  facet: ArchivePhotoAlbumFacet | 'q'
  label: string
  value: string
  removeHref: string
}

/** The active filters in canonical order, with the URL that removes each one. */
export const archivePhotoAlbumActiveFilters = (
  params: ArchivePhotoAlbumParams,
  facets: ArchivePhotoAlbumFacets,
): ArchivePhotoAlbumActiveFilter[] => {
  const filters: ArchivePhotoAlbumActiveFilter[] = []
  const withoutOverlay = { ...params, foto: null }

  for (const facet of ARCHIVE_PHOTO_ALBUM_FACETS) {
    const value = params[facet]
    if (!value) continue
    const option = facets[facet].find((candidate) => candidate.value === value)
    filters.push({
      facet,
      label: archivePhotoAlbumFacetLabels[facet],
      value: option?.label ?? value,
      removeHref: buildArchivePhotoAlbumHref({ ...withoutOverlay, [facet]: null }),
    })
  }

  if (params.q.trim()) {
    filters.push({
      facet: 'q',
      label: 'Busca',
      value: params.q.trim(),
      removeHref: buildArchivePhotoAlbumHref({ ...withoutOverlay, q: '' }),
    })
  }

  return filters
}

/**
 * All active facets combine (AND); the term matches the denormalized haystack.
 * `pessoa` compares the canonical slug of every appearance, so the URL key and
 * the facet option always agree.
 */
export const filterArchivePhotoAlbumItems = (
  items: readonly ArchivePhotoPublicItem[],
  params: ArchivePhotoAlbumParams,
): ArchivePhotoPublicItem[] => {
  const term = normalizeForSearch(params.q)

  return items.filter((item) => {
    if (params.data && archivePhotoDayOf(item.takenOn) !== params.data) return false
    if (params.municipio && item.municipalitySlug !== params.municipio) return false
    if (params.atividade && item.scene !== params.atividade) return false
    if (
      params.pessoa &&
      !archivePhotoPublicPeople(item.people).some((person) => person.slug === params.pessoa)
    ) {
      return false
    }
    if (!term) return true
    return normalizeForSearch(item.searchText).includes(term)
  })
}

/**
 * Contextual heading (design scene 06): município → atividade → pessoa → data
 * → termo; the other criteria stay visible as removable chips. The heading is
 * derived from the items' own labels, never from the raw param.
 */
export const archivePhotoAlbumHeading = (
  params: ArchivePhotoAlbumParams,
  facets: ArchivePhotoAlbumFacets,
): string => {
  const labelOf = (facet: ArchivePhotoAlbumFacet): string | null => {
    const value = params[facet]
    if (!value) return null
    return facets[facet].find((option) => option.value === value)?.label ?? null
  }

  const municipality = labelOf('municipio')
  if (municipality) return `Fotos em ${municipality}`
  const scene = labelOf('atividade')
  if (scene) return `Fotos de ${scene}`
  const person = labelOf('pessoa')
  if (person) return `Fotos com ${person}`
  const day = labelOf('data')
  if (day) return `Fotos de ${day}`
  const term = params.q.trim()
  if (term) return `Resultados para “${term}”`
  return 'Fotos da nossa caminhada'
}

export type ArchivePhotoAlbumPage = {
  /** Clamped to `[1, pageCount]`; `pageCount` is 1 even with zero items. */
  page: number
  pageCount: number
  items: ArchivePhotoPublicItem[]
  hasPrevious: boolean
  hasNext: boolean
}

/** Slices the filtered list for the current page (24/page, design scene 07). */
export const paginateArchivePhotoAlbumItems = (
  items: readonly ArchivePhotoPublicItem[],
  page: number,
): ArchivePhotoAlbumPage => {
  const pageCount = Math.max(1, Math.ceil(items.length / ARCHIVE_PHOTO_ALBUM_PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * ARCHIVE_PHOTO_ALBUM_PAGE_SIZE

  return {
    page: current,
    pageCount,
    items: items.slice(start, start + ARCHIVE_PHOTO_ALBUM_PAGE_SIZE),
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  }
}
