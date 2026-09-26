/**
 * C232 — pure contract of the AI pre-cataloguing of the photo archive: the
 * closed scene vocabulary, the curated-field vocabulary (the same mechanism
 * C230 persists on a content piece), the source states of a ficha, the vision
 * output parser and the deterministic merge that decides what gets written.
 * No I/O and no `server-only`: the collection hooks, the Payload pipeline, the
 * CLI and the tests share this module.
 *
 * The rules encoded here are product rules: the model never names people (only
 * the curated `publicFigureCatalog` matched against TEXT does, and the
 * assessoria confirms on the ficha), the scene/themes are closed vocabularies
 * (unknown tokens are dropped, never invented) and a failed call is not a
 * state — it stays out of the row so the next run retries it.
 */
import { z } from 'zod'

import { publicFigureCatalog } from '@/lib/publicFigureCatalog'
import { SPEECH_TOPICS, resolveSpeechTopic, type SpeechTopic } from '@/lib/speechFacets'
import { escapeRegExp, normalizeForSearch } from '@/lib/speechSearch'

/** Closed vocabulary of atividade/cena (the facet C233 consumes). */
export const ARCHIVE_PHOTO_SCENES = [
  { value: 'plenaria', label: 'Plenária' },
  { value: 'audiencia', label: 'Audiência' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'evento', label: 'Evento' },
  { value: 'mobilizacao', label: 'Mobilização' },
  { value: 'visita', label: 'Visita' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'discurso', label: 'Discurso' },
  { value: 'retrato', label: 'Retrato' },
  { value: 'gabinete', label: 'Gabinete' },
  { value: 'outro', label: 'Outro' },
] as const

export type ArchivePhotoScene = (typeof ARCHIVE_PHOTO_SCENES)[number]['value']

/**
 * Resolves a scene token (value or pt-BR label, accent/case insensitive) to its
 * taxonomy entry. Fail-closed: unknown tokens return null.
 */
export const resolveArchivePhotoScene = (token: unknown): ArchivePhotoScene | null => {
  if (typeof token !== 'string') return null
  const key = normalizeForSearch(token).replace(/-/g, ' ')
  if (!key) return null
  const match = ARCHIVE_PHOTO_SCENES.find(
    (scene) =>
      normalizeForSearch(scene.value).replace(/-/g, ' ') === key ||
      normalizeForSearch(scene.label) === key,
  )
  return match?.value ?? null
}

const archivePhotoSceneLabel = (value: ArchivePhotoScene): string =>
  ARCHIVE_PHOTO_SCENES.find((scene) => scene.value === value)?.label ?? value

/**
 * The fields a human edit freezes: the cataloguing never writes a field listed
 * in `curatedFields` (C230's mechanism, one literal per persisted field name).
 */
export const ARCHIVE_PHOTO_CURATED_FIELDS = [
  'alt',
  'caption',
  'description',
  'scene',
  'visibleText',
  'hasPeople',
  'themes',
  'people',
  'municipality',
] as const

export type ArchivePhotoCuratedField = (typeof ARCHIVE_PHOTO_CURATED_FIELDS)[number]

/** pt-BR names of the curated fields for the admin's read-only chip list. */
export const archivePhotoCuratedFieldLabels: Record<ArchivePhotoCuratedField, string> = {
  alt: 'Texto alternativo',
  caption: 'Legenda',
  description: 'Descrição',
  scene: 'Atividade/cena',
  visibleText: 'Texto visível',
  hasPeople: 'Pessoas na cena',
  themes: 'Temas',
  people: 'Pessoas públicas',
  municipality: 'Município',
}

/** Outcome of one photo: the model contributed, only metadata did, or nothing. */
export const ARCHIVE_PHOTO_CATALOG_SOURCES = ['ai', 'metadata', 'none'] as const

export type ArchivePhotoCatalogSource = (typeof ARCHIVE_PHOTO_CATALOG_SOURCES)[number]

export const archivePhotoCatalogSourceLabels: Record<ArchivePhotoCatalogSource, string> = {
  ai: 'IA',
  metadata: 'Metadados',
  none: 'Nada a propor',
}

export const ARCHIVE_PHOTO_CAPTION_MAX_LENGTH = 200
export const ARCHIVE_PHOTO_DESCRIPTION_MAX_LENGTH = 600
export const ARCHIVE_PHOTO_VISIBLE_TEXT_MAX_LENGTH = 1000
const ARCHIVE_PHOTO_ALT_MAX_LENGTH = 300
const ARCHIVE_PHOTO_PEOPLE_MAX = 8

/** What one vision call proposes; every field can be empty (nothing to propose). */
export type ArchivePhotoSuggestion = {
  caption: string | null
  description: string | null
  scene: ArchivePhotoScene | null
  visibleText: string | null
  hasPeople: boolean | null
  themes: SpeechTopic[]
}

const clip = (value: string | null, maximum: number): string | null => {
  if (value === null) return null
  const text = value.trim().slice(0, maximum).trim()
  return text === '' ? null : text
}

/**
 * Resolves the model's theme tokens against the existing taxonomy (value or
 * pt-BR label); unknown tokens are dropped and duplicates collapse. Never
 * invents a slug outside `SPEECH_TOPICS`.
 */
export const archivePhotoThemesFrom = (values: readonly unknown[]): SpeechTopic[] => {
  const themes: SpeechTopic[] = []
  for (const value of values) {
    const entry = typeof value === 'string' ? resolveSpeechTopic(value) : null
    if (entry && !themes.includes(entry.value)) themes.push(entry.value)
  }
  return themes
}

/**
 * Names of the curated catalog mentioned in the TEXT (title, album, caption,
 * visible text…). This is a reading of what is written — never of a face — and
 * an unresolved or ambiguous value never becomes a name. Whole-word,
 * accent/case insensitive, same normalization family as the catalog resolver.
 */
export const matchPublicFigureMentions = (text: string): string[] => {
  const haystack = normalizeForSearch(text)
  if (!haystack) return []

  const mentioned: string[] = []
  for (const entry of publicFigureCatalog) {
    const needle = normalizeForSearch(entry.name)
    if (!needle) continue
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`)
    if (!pattern.test(haystack)) continue
    if (!mentioned.includes(entry.name) && mentioned.length < ARCHIVE_PHOTO_PEOPLE_MAX) {
      mentioned.push(entry.name)
    }
  }
  return mentioned
}

const archiveVisionField = {
  text: z.string().nullish().catch(null),
  boolean: z.boolean().nullish().catch(null),
}

const archiveVisionOutputSchema = z
  .object({
    caption: archiveVisionField.text,
    description: archiveVisionField.text,
    scene: archiveVisionField.text,
    visibleText: archiveVisionField.text,
    hasPeople: archiveVisionField.boolean,
    themes: z.array(z.unknown()).nullish().catch(null),
  })
  .passthrough()

const parseJsonObject = (raw: string): unknown => {
  const text = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Fail-closed parser of one vision answer: a non-object (or unparsable) answer
 * is null — the caller reports a named failure and retries next run. Inside a
 * valid object each field degrades alone: an invalid scene or theme is
 * dropped, never guessed.
 */
export const parseArchiveVisionOutput = (raw: unknown): ArchivePhotoSuggestion | null => {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const result = archiveVisionOutputSchema.safeParse(parsed)
  if (!result.success) return null

  const data = result.data
  return {
    caption: clip(data.caption ?? null, ARCHIVE_PHOTO_CAPTION_MAX_LENGTH),
    description: clip(data.description ?? null, ARCHIVE_PHOTO_DESCRIPTION_MAX_LENGTH),
    scene: resolveArchivePhotoScene(data.scene),
    visibleText: clip(data.visibleText ?? null, ARCHIVE_PHOTO_VISIBLE_TEXT_MAX_LENGTH),
    hasPeople: data.hasPeople ?? null,
    themes: archivePhotoThemesFrom(data.themes ?? []),
  }
}

type ArchivePhotoSearchInput = {
  alt?: string | null
  title?: string | null
  description?: string | null
  catalogDescription?: string | null
  caption?: string | null
  scene?: ArchivePhotoScene | null
  visibleText?: string | null
  themes?: readonly SpeechTopic[] | null
  people?: readonly string[] | null
  municipalityName?: string | null
  albumTitles?: readonly string[] | null
  tagNames?: readonly string[] | null
}

/**
 * The normalized haystack the admin list search matches (the same shape C199/
 * C230 persist): what a person would type to find the photo — names, places,
 * themes, what is written in it.
 */
export const archivePhotoSearchText = (input: ArchivePhotoSearchInput): string =>
  normalizeForSearch(
    [
      input.alt ?? '',
      input.title ?? '',
      input.description ?? '',
      input.catalogDescription ?? '',
      input.caption ?? '',
      input.scene ? archivePhotoSceneLabel(input.scene) : '',
      input.visibleText ?? '',
      ...(input.themes ?? []).map((theme) => resolveSpeechTopic(theme)?.label ?? theme),
      ...(input.people ?? []),
      input.municipalityName ?? '',
      ...(input.albumTitles ?? []),
      ...(input.tagNames ?? []),
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' '),
  )

/**
 * The date facet derived from the Flickr wall clock (`YYYY-MM-DD HH:MM:SS`):
 * fixed at noon UTC so the admin never shows the previous day. Invalid input
 * (or an impossible date) is null — never a guessed day.
 */
export const archivePhotoTakenOn = (takenAt: unknown): string | null => {
  if (typeof takenAt !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/.exec(takenAt.trim())
  if (!match) return null
  const [, year, month, day] = match
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), 12)
  const date = new Date(utc)
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }
  return date.toISOString()
}

const comparableCuratedValue = (field: ArchivePhotoCuratedField, value: unknown): unknown => {
  if (field === 'municipality') {
    if (typeof value === 'number') return value
    if (value !== null && typeof value === 'object' && 'id' in (value as object)) {
      return (value as { id: unknown }).id
    }
    return null
  }
  if (field === 'themes' || field === 'people') {
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      : []
  }
  if (field === 'hasPeople') {
    return typeof value === 'boolean' ? value : null
  }
  return typeof value === 'string' ? value : null
}

/**
 * The admin edit path marks which fields the assessoria touched: an incoming
 * value that differs from the stored one (arrays normalized, clearing counts)
 * enters `curatedFields`. Only runs for a request with a user — the system
 * writes (ingest, cataloguing) never mark.
 */
export const changedArchivePhotoCuratedFields = ({
  data,
  originalDoc,
}: {
  data: Record<string, unknown> | null | undefined
  originalDoc: Record<string, unknown> | null | undefined
}): ArchivePhotoCuratedField[] => {
  if (!data) return []
  const catalog = data.catalog
  const incomingCatalog =
    catalog !== null && typeof catalog === 'object' ? (catalog as Record<string, unknown>) : null
  const originalCatalog = originalDoc?.catalog
  const storedCatalog =
    originalCatalog !== null && typeof originalCatalog === 'object'
      ? (originalCatalog as Record<string, unknown>)
      : null

  const changed: ArchivePhotoCuratedField[] = []
  for (const field of ARCHIVE_PHOTO_CURATED_FIELDS) {
    const incoming = field === 'alt' ? data.alt : incomingCatalog?.[field]
    if (incoming === undefined) continue
    const stored = field === 'alt' ? originalDoc?.alt : storedCatalog?.[field]
    const before = comparableCuratedValue(field, stored)
    const after = comparableCuratedValue(field, incoming)
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(field)
  }
  return changed
}

type ArchivePhotoCatalogValues = {
  caption?: string
  description?: string
  scene?: ArchivePhotoScene
  visibleText?: string
  hasPeople?: boolean
  themes?: SpeechTopic[]
  people?: string[]
  municipality?: number
  source: ArchivePhotoCatalogSource
  catalogedAt: string
}

export type ArchivePhotoCatalogWrite = {
  data: {
    alt?: string
    catalog: ArchivePhotoCatalogValues
  }
  source: ArchivePhotoCatalogSource
}

/**
 * The deterministic merge of one photo: proposed values (model + text
 * metadata) fill only fields the assessoria never curated, and the source
 * states what actually landed — `ai` when a model field was written,
 * `metadata` when only the text-derived ones were, `none` when there was
 * nothing to propose. `catalogedAt` is set on every outcome, so "nada a
 * propor" is a final honest state instead of a silent retry loop.
 */
export const buildArchivePhotoCatalogWrite = ({
  suggestion,
  municipalityId,
  mentionedPeople,
  gazetteerThemes,
  curatedFields,
  currentCatalog,
  currentAlt,
  catalogedAt,
}: {
  suggestion: ArchivePhotoSuggestion | null
  municipalityId: number | null
  mentionedPeople: readonly string[]
  gazetteerThemes: readonly SpeechTopic[]
  curatedFields: readonly string[]
  currentCatalog?: {
    caption?: string | null
    description?: string | null
    scene?: ArchivePhotoScene | null
    visibleText?: string | null
    hasPeople?: boolean | null
    themes?: SpeechTopic[] | null
    people?: string[] | null
    municipality?: number | null
  } | null
  currentAlt?: string | null
  catalogedAt: string
}): ArchivePhotoCatalogWrite => {
  const curated = new Set<string>(curatedFields)
  const current: NonNullable<typeof currentCatalog> = currentCatalog ?? {}

  /** A proposed value that will be written: not curated, not blank/empty. */
  const writes = (field: ArchivePhotoCuratedField, value: unknown): boolean =>
    !curated.has(field) &&
    value !== null &&
    value !== undefined &&
    !(typeof value === 'string' && value.trim() === '') &&
    !(Array.isArray(value) && value.length === 0)

  /**
   * Kept curated value when the field is frozen (verbatim), otherwise the
   * proposal normalized: blank strings and empty arrays are "nothing to
   * propose", never a written value.
   */
  const pick = <Key extends keyof typeof current>(
    field: Key,
    proposed: NonNullable<(typeof current)[Key]> | null | undefined,
  ): NonNullable<(typeof current)[Key]> | undefined => {
    if (curated.has(field)) {
      const kept = current[field]
      return kept === null || kept === undefined
        ? undefined
        : (kept as NonNullable<(typeof current)[Key]>)
    }
    if (proposed === null || proposed === undefined) return undefined
    if (Array.isArray(proposed)) {
      return proposed.length === 0 ? undefined : (proposed as NonNullable<(typeof current)[Key]>)
    }
    if (typeof proposed === 'string') {
      const text = proposed.trim()
      return text === '' ? undefined : (text as NonNullable<(typeof current)[Key]>)
    }
    return proposed as NonNullable<(typeof current)[Key]>
  }

  const aiThemes = suggestion?.themes ?? []
  const themes = [...new Set<SpeechTopic>([...aiThemes, ...gazetteerThemes])]
  const people = [...new Set(mentionedPeople)]

  const caption = suggestion?.caption ?? null
  const written = {
    caption: pick('caption', caption),
    description: pick('description', suggestion?.description ?? null),
    scene: pick('scene', suggestion?.scene ?? null),
    visibleText: pick('visibleText', suggestion?.visibleText ?? null),
    hasPeople: pick('hasPeople', suggestion?.hasPeople ?? null),
    themes: pick('themes', themes.length > 0 ? themes : null),
    people: pick('people', people.length > 0 ? people : null),
    municipality: pick('municipality', municipalityId),
  }

  const modelWrote =
    writes('caption', caption) ||
    writes('description', suggestion?.description) ||
    writes('scene', suggestion?.scene) ||
    writes('visibleText', suggestion?.visibleText) ||
    writes('hasPeople', suggestion?.hasPeople) ||
    writes('themes', aiThemes)
  const metadataWrote =
    !modelWrote &&
    (writes('municipality', municipalityId) ||
      writes('people', people) ||
      writes('themes', gazetteerThemes))
  const source: ArchivePhotoCatalogSource = modelWrote ? 'ai' : metadataWrote ? 'metadata' : 'none'

  // The AI refines the alt only from its OWN caption (never from human text):
  // a curated caption leaves the alt exactly where it was.
  const alt = curated.has('alt')
    ? (currentAlt ?? undefined)
    : curated.has('caption')
      ? undefined
      : (clip(caption, ARCHIVE_PHOTO_ALT_MAX_LENGTH) ?? undefined)

  return {
    data: {
      ...(alt !== undefined ? { alt } : {}),
      catalog: {
        ...written,
        source,
        catalogedAt,
      },
    },
    source,
  }
}

const ARCHIVE_VISION_SCENE_LINES = ARCHIVE_PHOTO_SCENES.filter((scene) => scene.value !== 'outro')
  .map((scene) => `${scene.value}=${scene.label}`)
  .join('; ')

/** The theme vocabulary is offered from its owner — no copied literal to drift. */
const ARCHIVE_VISION_THEME_LINES = SPEECH_TOPICS.map(
  ({ value, label }) => `${value}=${label}`,
).join('; ')

export const ARCHIVE_VISION_SYSTEM_PROMPT =
  'Você pré-cataloga fotos do acervo do deputado federal Jorge Solla (PT-BA) para uma base interna da campanha. ' +
  'Descreva apenas o que está visível na imagem: nunca invente lugar, data, evento, número ou fala. ' +
  'NUNCA identifique pessoas por rosto nem escreva nomes de pessoas (nem do deputado). ' +
  'Não escreva nomes de cidades: o local é resolvido por outra via. ' +
  'Responda SOMENTE com um objeto JSON válido, sem markdown e sem comentários.'

/**
 * The user prompt of one photo: the closed vocabularies the answer must use.
 * The model is free to answer null/empty for anything it cannot see — the
 * parser drops whatever leaves the vocabulary.
 */
export const buildArchiveVisionPrompt = (): string =>
  [
    'Analise a foto e devolva um JSON com exatamente estas chaves:',
    '{"caption": "legenda curta em português (máx. 200 caracteres)",',
    ' "description": "uma ou duas frases factuais em português (máx. 600 caracteres)",',
    ' "scene": "um dos valores de cena ou null",',
    ' "visibleText": "texto legível de faixas, placas e banners ou null",',
    ' "hasPeople": true, false ou null,',
    ' "themes": ["zero ou mais valores de tema"]}',
    '',
    `Cenas: ${ARCHIVE_VISION_SCENE_LINES}; outro=Outro (use outro só se nenhuma se aplicar).`,
    `Temas: ${ARCHIVE_VISION_THEME_LINES}.`,
    'Use null ou lista vazia quando não houver certeza; é melhor não propor do que inventar.',
  ].join('\n')
