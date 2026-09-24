/**
 * C211 — pure rules of a campaign content piece ("peça"): the type/status/step
 * vocabulary, the upload limits, the honest failure copy and the link
 * normalization. No I/O and no `server-only`: the client dialogs, the JSON
 * routes, the job, the loaders and the unit tests share this module.
 *
 * The piece is the internal catalogue the public Central (S27) consumes: this
 * module never implements a public surface — it owns the vocabulary and the
 * derivations both sides agree on.
 */
import {
  CAMPAIGN_COMMUNICATION_CONTEUDOS,
  campaignContentPieceFileHref,
  campaignContentPieceRetryHref,
} from '@/lib/campaignPaths'
import { formatRecordingFileSize } from '@/lib/recording'
import { formatSpeechClock, formatSpeechDate } from '@/lib/speechClock'
import { SPEECH_TOPICS, type SpeechTopic } from '@/lib/speechFacets'
import { normalizeForSearch } from '@/lib/speechSearch'

/** Owner of the private upload collection slug (collection, config and routes). */
export const CONTENT_MEDIA_SLUG = 'contentMedia' as const

export const CONTENT_PIECE_TYPES = ['video', 'foto', 'texto', 'audio', 'card'] as const

export type ContentPieceType = (typeof CONTENT_PIECE_TYPES)[number]

export const contentPieceTypeLabels: Record<ContentPieceType, string> = {
  video: 'Vídeo',
  foto: 'Foto',
  texto: 'Texto',
  audio: 'Áudio',
  card: 'Card',
}

export const isContentPieceType = (value: unknown): value is ContentPieceType =>
  CONTENT_PIECE_TYPES.includes(value as ContentPieceType)

export const CONTENT_PIECE_STATUSES = ['rascunho', 'publicado'] as const

export type ContentPieceStatus = (typeof CONTENT_PIECE_STATUSES)[number]

export const contentPieceStatusLabels: Record<ContentPieceStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
}

export const isContentPieceStatus = (value: unknown): value is ContentPieceStatus =>
  CONTENT_PIECE_STATUSES.includes(value as ContentPieceStatus)

export const CONTENT_PIECE_PROCESSING_STATUSES = ['processando', 'pronto', 'falhou'] as const

export type ContentPieceProcessingStatus = (typeof CONTENT_PIECE_PROCESSING_STATUSES)[number]

export const contentPieceProcessingStatusLabels: Record<ContentPieceProcessingStatus, string> = {
  processando: 'Processando',
  pronto: 'Pronto',
  falhou: 'Falhou',
}

export const isContentPieceProcessingStatus = (
  value: unknown,
): value is ContentPieceProcessingStatus =>
  CONTENT_PIECE_PROCESSING_STATUSES.includes(value as ContentPieceProcessingStatus)

export const CONTENT_PIECE_STEPS = [
  'extraindo',
  'transcrevendo',
  'catalogando',
  'salvando',
] as const

export type ContentPieceStep = (typeof CONTENT_PIECE_STEPS)[number]

export const contentPieceStepLabels: Record<ContentPieceStep, string> = {
  extraindo: 'Preparando a mídia da peça',
  transcrevendo: 'Transcrevendo a peça',
  catalogando: 'Catalogando a peça',
  salvando: 'Guardando a catalogação',
}

export const isContentPieceStep = (value: unknown): value is ContentPieceStep =>
  CONTENT_PIECE_STEPS.includes(value as ContentPieceStep)

export const CONTENT_PIECE_ORIGINS = ['arquivo', 'instagram', 'youtube'] as const

export type ContentPieceOrigin = (typeof CONTENT_PIECE_ORIGINS)[number]

export const contentPieceOriginLabels: Record<ContentPieceOrigin, string> = {
  arquivo: 'Arquivo enviado',
  instagram: 'Instagram',
  youtube: 'YouTube',
}

export const isContentPieceOrigin = (value: unknown): value is ContentPieceOrigin =>
  CONTENT_PIECE_ORIGINS.includes(value as ContentPieceOrigin)

const topicValues = new Set<string>(SPEECH_TOPICS.map((topic) => topic.value))

export const isContentPieceTopic = (value: unknown): value is SpeechTopic =>
  topicValues.has(value as SpeechTopic)

export const contentPieceTopicLabel = (value: SpeechTopic): string =>
  SPEECH_TOPICS.find((topic) => topic.value === value)?.label ?? value

/**
 * The catalog fields the pipeline may fill and the assessoria may curate. The
 * job never overwrites a field listed in `curatedFields` (D6) — the vocabulary
 * is persisted, so it stays one literal per field name.
 */
export const CONTENT_PIECE_CURATED_FIELDS = [
  'title',
  'description',
  'topics',
  'municipality',
  'institution',
  'pieceDate',
  'transcript',
  'type',
] as const

export type ContentPieceCuratedField = (typeof CONTENT_PIECE_CURATED_FIELDS)[number]

export const isContentPieceCuratedField = (value: unknown): value is ContentPieceCuratedField =>
  CONTENT_PIECE_CURATED_FIELDS.includes(value as ContentPieceCuratedField)

/** pt-BR names of the curated fields for the admin's read-only chip list. */
export const contentPieceCuratedFieldLabels: Record<ContentPieceCuratedField, string> = {
  title: 'Título',
  description: 'Descrição',
  topics: 'Temas',
  municipality: 'Cidade',
  institution: 'Instituição',
  pieceDate: 'Data da peça',
  transcript: 'Transcrição / texto',
  type: 'Tipo',
}

/** One owner for the persisted field limits (collection, schema and dialogs). */
export const CONTENT_PIECE_TITLE_MAX_LENGTH = 200
export const CONTENT_PIECE_DESCRIPTION_MAX_LENGTH = 1200
export const CONTENT_PIECE_INSTITUTION_MAX_LENGTH = 160

/** Batch policy: a generous ceiling with a clear message above it (product A). */
export const CONTENT_PIECE_BATCH_MAX_FILES = 50

/** Per-file ceiling: the same guard as a recording — hours of media stream, never buffer. */
export const CONTENT_PIECE_MAX_BYTES = 4 * 1024 * 1024 * 1024
export const CONTENT_PIECE_MAX_SIZE_LABEL = '4 GB'

/** A text piece is a document, not a media dump; the extraction reads it whole. */
export const CONTENT_PIECE_TEXT_MAX_BYTES = 5 * 1024 * 1024
const CONTENT_PIECE_TEXT_MAX_SIZE_LABEL = '5 MB'

/** The video/audio extraction timeout has no duration to scale from; 30 min is ample. */
export const CONTENT_PIECE_FFMPEG_TIMEOUT_MS = 30 * 60_000

/**
 * The causes the job and the reaper store in `error` (the operator's detail)
 * and the honest pt-BR copy the detail shows. A raw transport message
 * (URL, stderr) stays in the admin.
 */
export const CONTENT_PIECE_FAILURE_INTERRUPTED =
  'O processamento foi interrompido antes de terminar.'

const CONTENT_PIECE_FAILURE_EXTRACTING_COPY = 'Não foi possível preparar a mídia da peça.'
const CONTENT_PIECE_FAILURE_TRANSCRIBING_COPY = 'Não foi possível transcrever a peça.'
const CONTENT_PIECE_FAILURE_CATALOGING_COPY = 'Não foi possível catalogar a peça.'
const CONTENT_PIECE_FAILURE_SAVING_COPY = 'Não foi possível guardar a catalogação.'
const CONTENT_PIECE_FAILURE_UNKNOWN_COPY = 'Não foi possível processar a peça.'

/**
 * Maps the stored cause of a failed piece to what the person reads: the exact
 * literal when the job named it, otherwise the failure step, otherwise a
 * generic-but-honest line. Null when the row stored no cause at all.
 */
export const contentPieceFailureMessage = ({
  error,
  step,
}: {
  error?: string | null
  step?: ContentPieceStep | null
}): string | null => {
  const stored = error?.trim()
  if (!stored) return null

  if (stored === CONTENT_PIECE_FAILURE_INTERRUPTED) return CONTENT_PIECE_FAILURE_INTERRUPTED
  if (step === 'extraindo') return CONTENT_PIECE_FAILURE_EXTRACTING_COPY
  if (step === 'transcrevendo') return CONTENT_PIECE_FAILURE_TRANSCRIBING_COPY
  if (step === 'catalogando') return CONTENT_PIECE_FAILURE_CATALOGING_COPY
  if (step === 'salvando') return CONTENT_PIECE_FAILURE_SAVING_COPY
  return CONTENT_PIECE_FAILURE_UNKNOWN_COPY
}

/** The retry button only applies to a failed piece. */
export const canRetryContentPiece = (processingStatus: ContentPieceProcessingStatus): boolean =>
  processingStatus === 'falhou'

/**
 * What the pipeline runs for each type: video and audio are transcribed, text
 * has its content extracted. Photo and card are ready on upload (the aceite
 * does not ask for transcription; the cataloguing still fills the metadata).
 */
export const needsContentPieceProcessing = (type: ContentPieceType): boolean =>
  type === 'video' || type === 'audio' || type === 'texto'

/**
 * The S27 contract, as a pure predicate: a piece is public only once published
 * AND with something to show (an archived file or the platform link).
 */
export const contentPieceIsPublic = (piece: {
  status: ContentPieceStatus
  hasFile: boolean
  sourceUrl: string | null
}): boolean => piece.status === 'publicado' && (piece.hasFile || Boolean(piece.sourceUrl))

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac']
const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'text']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'avif']

const extensionOf = (filename: string | null | undefined): string =>
  (filename ?? '')
    .toLowerCase()
    .split('.')
    .pop()
    ?.replace(/[^a-z0-9]/g, '') ?? ''

/**
 * The piece type the upload derives from the file. MIME is the primary signal
 * (`video/*` cannot be a photo), the extension the fallback for the formats the
 * OS often reports without a type (the C199 `.mkv` lesson). Images land as
 * `foto` — whether the image is a card is an editorial call the assessoria
 * makes on the ficha, and the type is editable; a card is not a distinct file.
 * Null means the upload refuses the file.
 */
export const contentPieceTypeFromMime = (
  mimeType: string | null | undefined,
  filename?: string | null,
): ContentPieceType | null => {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'texto'
  if (mime.startsWith('image/')) return 'foto'

  const extension = extensionOf(filename)
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video'
  if (AUDIO_EXTENSIONS.includes(extension)) return 'audio'
  if (TEXT_EXTENSIONS.includes(extension)) return 'texto'
  if (IMAGE_EXTENSIONS.includes(extension)) return 'foto'
  return null
}

/** The file types the picker offers — the four families the catalogue reads. */
export const CONTENT_PIECE_ACCEPT =
  'video/*,audio/*,image/*,text/*,.mkv,.mov,.mp4,.webm,.mp3,.wav,.m4a,.ogg,.opus,.txt,.md,.markdown'

/** Basename without path parts or unsafe characters, keeping the extension. */
export const sanitizeContentPieceFilename = (filename: string): string => {
  const base = filename.split(/[\\/]/).pop() ?? ''
  const safe = base.replace(/[^\w.-]+/g, '_').replace(/^[._]+/, '')
  return safe || 'peca'
}

export const contentPieceTooLargeMessage = (bytes: number): string =>
  `Este arquivo tem ${formatRecordingFileSize(bytes)}. Escolha uma peça de até ${CONTENT_PIECE_MAX_SIZE_LABEL}.`

export const CONTENT_PIECE_BATCH_LIMIT_MESSAGE = `Envie até ${CONTENT_PIECE_BATCH_MAX_FILES} arquivos por lote.`

export const CONTENT_PIECE_TEXT_TOO_LARGE_MESSAGE = `O texto excede o limite de ${CONTENT_PIECE_TEXT_MAX_SIZE_LABEL}.`

/** Dialog copy of the batch help (approved design, scene 2). */
export const CONTENT_PIECE_BATCH_HELP = 'Cada arquivo vira um rascunho independente.'

/**
 * The piece title starts from the filename (the assessoria renames it; the
 * automatic cataloguing replaces it while the field is not curated).
 */
export const contentPieceTitleFromFilename = (filename: string): string => {
  const base = (filename.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, '')
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Nova peça'
}

/**
 * The slug base of a piece: accent/case-insensitive, alphanumeric groups joined
 * by `-`. Empty when the title has no usable character.
 */
export const contentPieceSlugBase = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** The slug candidates in order: base, then `-2`, `-3`… (uniqueness lives in the DB). */
export const contentPieceSlugCandidates = (title: string, maximum = 50): string[] => {
  const base = contentPieceSlugBase(title) || 'peca'
  const candidates = [base]
  for (let suffix = 2; candidates.length < maximum; suffix += 1) {
    candidates.push(`${base}-${suffix}`)
  }
  return candidates
}

type ContentPieceSearchInput = {
  title?: string | null
  description?: string | null
  transcript?: string | null
  institution?: string | null
  topics?: readonly string[] | null
  cityLabel?: string | null
}

/**
 * The normalized haystack the list search matches: title, description, the
 * transcript/text, the topic labels and the city/institution — everything the
 * design's placeholder promises ("Buscar por título, tema ou cidade…").
 */
export const contentPieceSearchText = (input: ContentPieceSearchInput): string =>
  normalizeForSearch(
    [
      input.title ?? '',
      input.description ?? '',
      input.transcript ?? '',
      input.institution ?? '',
      ...(input.topics ?? []).filter(isContentPieceTopic).map(contentPieceTopicLabel),
      input.cityLabel ?? '',
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' '),
  )

/**
 * C220 — why a piece added by link stayed a peça-link. Closed vocabulary in
 * product language (the UI only maps the label), persisted by the pipeline on
 * a `pronto` row: a peça-link is a legitimate outcome, never a failure. The
 * labels are the gate's verbatim literals.
 */
export const CONTENT_PIECE_LINK_FAILURE_REASONS = [
  'nao-encontrado',
  'carrossel',
  'indisponivel',
  'sem-credencial',
] as const

export type ContentPieceLinkFailureReason = (typeof CONTENT_PIECE_LINK_FAILURE_REASONS)[number]

export const contentPieceLinkFailureReasonLabels: Record<ContentPieceLinkFailureReason, string> = {
  'nao-encontrado': 'Link não encontrado entre as mídias recentes do perfil',
  carrossel: 'Carrossel: sem arquivo único para baixar',
  indisponivel: 'Instagram indisponível no momento',
  'sem-credencial': 'Sem credencial do Instagram configurada',
}

export const isContentPieceLinkFailureReason = (
  value: unknown,
): value is ContentPieceLinkFailureReason =>
  CONTENT_PIECE_LINK_FAILURE_REASONS.includes(value as ContentPieceLinkFailureReason)

/** The honest name of a piece that circulates only by its platform link. */
export const CONTENT_PIECE_LINK_LABEL = 'Peça-link'

type ContentPieceInstagramLink = {
  origin: 'instagram'
  canonicalUrl: string
  shortcode: string
}

type ContentPieceYoutubeLink = {
  origin: 'youtube'
  canonicalUrl: string
  videoId: string
}

export type ContentPieceLink = ContentPieceInstagramLink | ContentPieceYoutubeLink

const INSTAGRAM_KINDS = ['p', 'reel', 'reels', 'tv']

/**
 * Normalizes an Instagram or YouTube link into its canonical form, dropping
 * tracking parameters and hash. The shortcode/video id is the identity, so two
 * pastes of the same post collapse into one `sourceUrl` (unique in the DB) —
 * including the profile-prefixed spelling the browser copies from the grid
 * (`/<profile>/reel/<shortcode>/`). Returns null for any other host — the
 * piece only accepts the two platforms.
 */
export const parseContentPieceLink = (raw: string | null | undefined): ContentPieceLink | null => {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, '')
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'instagram.com') {
    // Two accepted spellings: the canonical `/<kind>/<shortcode>/` and the one
    // the browser copies from the profile, `/<profile>/<kind>/<shortcode>/`.
    const [first, second, third] = segments
    const prefixed = segments.length === 3
    if (prefixed && (first ?? '').toLowerCase() === 'stories') return null
    const kind = prefixed ? second : first
    const shortcode = prefixed ? third : second
    if (!kind || !shortcode || !INSTAGRAM_KINDS.includes(kind.toLowerCase())) return null
    const safeShortcode = shortcode.replace(/[^A-Za-z0-9_-]/g, '')
    if (!safeShortcode) return null
    const canonicalKind = kind.toLowerCase() === 'reels' ? 'reel' : kind.toLowerCase()
    return {
      origin: 'instagram',
      shortcode: safeShortcode,
      canonicalUrl: `https://www.instagram.com/${canonicalKind}/${safeShortcode}/`,
    }
  }

  if (host === 'youtube.com' || host === 'youtu.be') {
    const videoId =
      host === 'youtu.be'
        ? (segments[0] ?? '')
        : segments[0] === 'watch'
          ? (url.searchParams.get('v') ?? '')
          : ['shorts', 'live', 'embed'].includes(segments[0] ?? '')
            ? (segments[1] ?? '')
            : ''
    const safeVideoId = videoId.replace(/[^A-Za-z0-9_-]/g, '')
    if (!safeVideoId) return null
    return {
      origin: 'youtube',
      videoId: safeVideoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${safeVideoId}`,
    }
  }

  return null
}

/** The platform of a link, or null when it is not an accepted one. */
export const contentPieceOriginFromLink = (
  raw: string | null | undefined,
): ContentPieceOrigin | null => parseContentPieceLink(raw)?.origin ?? null

/** A short, identifyable provisional title while the cataloguing has not run. */
export const contentPieceLinkTitle = (link: ContentPieceLink): string =>
  link.origin === 'instagram' ? `Instagram · ${link.shortcode}` : `YouTube · ${link.videoId}`

export type ContentPieceViewModel = {
  id: number
  title: string
  type: ContentPieceType
  status: ContentPieceStatus
  processingStatus: ContentPieceProcessingStatus
  step: ContentPieceStep | null
  origin: ContentPieceOrigin
  typeLabel: string
  originLabel: string
  statusLabel: string
  processingLabel: string
  topics: SpeechTopic[]
  cityLabel: string | null
  regionLabel: string | null
  durationLabel: string | null
  pieceDateLabel: string | null
  publishedAtLabel: string | null
  failureMessage: string | null
  linkFailureReason: ContentPieceLinkFailureReason | null
  linkFailureReasonLabel: string | null
  canRetry: boolean
  isPublished: boolean
  hasFile: boolean
  detailHref: string
  fileHref: string | null
  retryHref: string
}

type ContentPieceViewRecord = {
  id: number
  title?: string | null
  type?: string | null
  status?: string | null
  processingStatus?: string | null
  step?: string | null
  origin?: string | null
  topics?: string[] | null
  cityLabel?: string | null
  region?: string | null
  durationSeconds?: number | null
  pieceDate?: string | null
  publishedAt?: string | null
  error?: string | null
  linkFailureReason?: string | null
  media?: number | { id: number } | null
}

const normalizedType = (value: string | null | undefined): ContentPieceType =>
  isContentPieceType(value) ? value : 'foto'

const normalizedStatus = (value: string | null | undefined): ContentPieceStatus =>
  isContentPieceStatus(value) ? value : 'rascunho'

const normalizedProcessingStatus = (
  value: string | null | undefined,
): ContentPieceProcessingStatus => (isContentPieceProcessingStatus(value) ? value : 'falhou')

const normalizedOrigin = (value: string | null | undefined): ContentPieceOrigin =>
  isContentPieceOrigin(value) ? value : 'arquivo'

const dateLabelOf = (value: string | null | undefined): string | null =>
  /^(\d{4})-(\d{2})-(\d{2})/.test(value ?? '') && value ? formatSpeechDate(value) : null

const durationLabelOf = (seconds: number | null | undefined): string | null =>
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? formatSpeechClock(seconds)
    : null

const mediaIdOf = (media: ContentPieceViewRecord['media']): number | null =>
  typeof media === 'number' ? media : (media?.id ?? null)

/**
 * Internal/status wire view of a piece. `error` and `createdBy` never pass
 * through raw: a failure becomes the mapped `failureMessage`.
 */
export const toContentPieceViewModel = (record: ContentPieceViewRecord): ContentPieceViewModel => {
  const processingStatus = normalizedProcessingStatus(record.processingStatus)
  const step = isContentPieceStep(record.step) ? record.step : null
  const type = normalizedType(record.type)
  const status = normalizedStatus(record.status)
  const origin = normalizedOrigin(record.origin)
  const hasFile = mediaIdOf(record.media) !== null
  const linkFailureReason = isContentPieceLinkFailureReason(record.linkFailureReason)
    ? record.linkFailureReason
    : null

  return {
    id: record.id,
    title: record.title?.trim() || `Peça ${record.id}`,
    type,
    status,
    processingStatus,
    step,
    origin,
    typeLabel: contentPieceTypeLabels[type],
    originLabel: contentPieceOriginLabels[origin],
    statusLabel: contentPieceStatusLabels[status],
    processingLabel: contentPieceProcessingStatusLabels[processingStatus],
    topics: (record.topics ?? []).filter(isContentPieceTopic),
    cityLabel: record.cityLabel?.trim() || null,
    regionLabel: record.region?.trim() || null,
    durationLabel: durationLabelOf(record.durationSeconds),
    pieceDateLabel: dateLabelOf(record.pieceDate),
    publishedAtLabel: dateLabelOf(record.publishedAt),
    failureMessage: contentPieceFailureMessage({ error: record.error, step }),
    linkFailureReason,
    linkFailureReasonLabel: linkFailureReason
      ? contentPieceLinkFailureReasonLabels[linkFailureReason]
      : null,
    canRetry: canRetryContentPiece(processingStatus),
    isPublished: status === 'publicado',
    hasFile,
    detailHref: `${CAMPAIGN_COMMUNICATION_CONTEUDOS}/${record.id}`,
    fileHref: hasFile ? campaignContentPieceFileHref(record.id) : null,
    retryHref: campaignContentPieceRetryHref(record.id),
  }
}
