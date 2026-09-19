/**
 * C193 — pure rules of a reel: the status vocabulary (kill switch), the
 * feature catalog, the artifact `kind` → upload-field map and the private
 * media path. No I/O and no `server-only`: the collection config, the
 * authenticated media route and the C194 library share this module.
 */

import { campaignReelDetailHref } from '@/lib/campaignPaths'
import { formatBahiaCivilDate } from '@/lib/campaignTime'

/** Upload collection of the artifacts; also its local disk directory in dev. */
export const REEL_MEDIA_SLUG = 'reelMedia'

export const REEL_STATUSES = ['draft', 'published', 'unpublished'] as const
export type ReelStatus = (typeof REEL_STATUSES)[number]

/** One owner for the persisted field limit (collection, schema and C194). */
export const REEL_TITLE_MAX_LENGTH = 200

export const reelStatusLabels: Record<ReelStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  unpublished: 'Despublicado',
}

export const isReelStatus = (value: unknown): value is ReelStatus =>
  REEL_STATUSES.includes(value as ReelStatus)

/**
 * The closed feature vocabulary. Starts with `cards` (the home support cards at
 * `#cards`); a new tutorial feature appends here — never free text.
 */
export const REEL_FEATURES = ['cards'] as const
export type ReelFeature = (typeof REEL_FEATURES)[number]

/** Admin/select wording: keeps the public anchor the tutorial teaches. */
export const reelFeatureLabels: Record<ReelFeature, string> = {
  cards: 'Cards de apoio (#cards)',
}

/** Library UI wording: the anchor belongs to the admin context, not the card. */
const reelFeatureDisplayLabels: Record<ReelFeature, string> = {
  cards: 'Cards de apoio',
}

/**
 * The artifacts a reel can carry, each mapping to exactly one upload field.
 * `video` is the primary file (silent); the others are optional variants.
 */
export const REEL_MEDIA_KINDS = ['video', 'video-audio', 'narration', 'captions', 'cover'] as const
export type ReelMediaKind = (typeof REEL_MEDIA_KINDS)[number]

export type ReelMediaField = 'video' | 'videoWithAudio' | 'narrationAudio' | 'captions' | 'cover'

export const reelMediaFieldByKind: Record<ReelMediaKind, ReelMediaField> = {
  video: 'video',
  'video-audio': 'videoWithAudio',
  narration: 'narrationAudio',
  captions: 'captions',
  cover: 'cover',
}

export const isReelMediaKind = (value: unknown): value is ReelMediaKind =>
  REEL_MEDIA_KINDS.includes(value as ReelMediaKind)

/**
 * The authenticated serving path of one artifact. Lives under `/campanha` on
 * purpose: the `campaign-token` cookie is scoped to that path, so `<video>`/
 * `<img>` reach it without an `Authorization` header.
 */
export const reelMediaPath = (reelId: number, kind: ReelMediaKind): string =>
  `/campanha/comunicacao/reels/${reelId}/media/${kind}`

/** Only a published reel serves its files; `draft`/`unpublished` answer 404. */
export const canServeReelMedia = (status: ReelStatus): boolean => status === 'published'

const isReelFeature = (value: unknown): value is ReelFeature =>
  REEL_FEATURES.includes(value as ReelFeature)

// ---------------------------------------------------------------------------
// C194 — the library view models. Same shape as `lib/speechCut.ts`: the pure
// builders take the lean record the loader selected and return exactly what
// the list/detail render — the artifact URLs only exist when the kill switch
// says the file can be served.
// ---------------------------------------------------------------------------

type ReelMediaRef = number | { alt?: string | null } | null | undefined

/**
 * What the view models read. Structurally satisfied by a `Reel` document with
 * depth 1 (and by the lean `select` of the list loader) — defined here so
 * `lib/` stays free of `@/payload-types`, same reason `speechCut.ts` has its
 * own record type.
 */
export type ReelRecordForView = {
  id: number
  title: string
  feature: string
  status: string
  publishedAt?: string | null
  transcript?: string | null
  video?: ReelMediaRef
  videoWithAudio?: ReelMediaRef
  narrationAudio?: ReelMediaRef
  captions?: ReelMediaRef
  cover?: ReelMediaRef
}

/** Every artifact a person can take out of the library (the cover is not one). */
export type ReelDownloadKind = Exclude<ReelMediaKind, 'cover'>

const REEL_DOWNLOAD_KINDS = [
  'video',
  'video-audio',
  'narration',
  'captions',
] as const satisfies readonly ReelDownloadKind[]

const reelDownloadLabels: Record<ReelDownloadKind, { label: string; description: string }> = {
  video: { label: 'Vídeo sem áudio', description: 'MP4 · arquivo principal' },
  'video-audio': { label: 'Vídeo com áudio', description: 'Rascunho · MP4' },
  narration: { label: 'Narração', description: 'MP3' },
  captions: { label: 'Legendas', description: 'Arquivo .srt' },
}

/** Shown in place of the link when the artifact was never produced. */
export const reelDownloadUnavailableLabels: Record<ReelDownloadKind, string> = {
  video: 'Ainda não disponível.',
  'video-audio': 'Ainda não disponível.',
  narration: 'A narração será adicionada depois.',
  captions: 'A legenda ainda não foi gerada.',
}

/** Every file is withheld while the reel is unpublished (C193 kill switch). */
export const REEL_MEDIA_BLOCKED_LABEL = 'Disponível após republicar.'

/** A draft was never published; its files appear with the first publication. */
export const REEL_MEDIA_DRAFT_LABEL = 'Disponível após publicar.'

export type ReelLibraryItemViewModel = {
  id: number
  title: string
  featureLabel: string
  status: ReelStatus
  statusLabel: string
  coverUrl: string
  coverAlt: string
  publishedAtLabel: string | null
  detailHref: string
}

export type ReelDownloadItemViewModel = {
  kind: ReelDownloadKind
  label: string
  description: string
  /** The primary file the design's CTA leads with (always the silent video). */
  primary: boolean
  /** Null when the artifact is missing or the kill switch withholds the file. */
  href: string | null
  /** What the row says instead of a link when `href` is null. */
  unavailableLabel: string | null
}

export type ReelDetailViewModel = ReelLibraryItemViewModel & {
  /** Script/narration text: DB content, not a served file — kept when unpublished. */
  transcript: string | null
  /** False when the reel is `draft`/`unpublished` — no player, no download links. */
  canServeMedia: boolean
  /** Why the media is withheld while `canServeMedia` is false (draft ≠ unpublished). */
  mediaBlockedLabel: string
  /** `video-audio` when the rough cut with narration exists, else the silent video. */
  videoSourceUrl: string | null
  videoPosterUrl: string
  downloads: ReelDownloadItemViewModel[]
}

const normalizeReelStatus = (status: string): ReelStatus =>
  isReelStatus(status) ? status : 'draft'

const hasMedia = (value: ReelMediaRef): boolean => value !== null && value !== undefined

const mediaAlt = (value: ReelMediaRef, fallback: string): string => {
  if (typeof value !== 'object' || value === null) return fallback
  const alt = value.alt?.trim()
  return alt ? alt : fallback
}

/** Date-only (`dd/mm/aaaa`) publication label — the library never shows the hour. */
const publishedAtLabel = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) return null
  const [year, month, day] = formatBahiaCivilDate(instant).split('-')
  return `${day}/${month}/${year}`
}

const reelCover = (record: ReelRecordForView): { coverUrl: string; coverAlt: string } => ({
  coverUrl: reelMediaPath(record.id, 'cover'),
  coverAlt: mediaAlt(record.cover, record.title),
})

/** One card of the library list (published rows only — the loader filters). */
export const toReelLibraryItemViewModel = (record: ReelRecordForView): ReelLibraryItemViewModel => {
  const status = normalizeReelStatus(record.status)

  return {
    id: record.id,
    title: record.title,
    featureLabel: isReelFeature(record.feature)
      ? reelFeatureDisplayLabels[record.feature]
      : record.feature,
    status,
    statusLabel: reelStatusLabels[status],
    ...reelCover(record),
    publishedAtLabel: publishedAtLabel(record.publishedAt),
    detailHref: campaignReelDetailHref(record.id),
  }
}

/**
 * One reel with its artifacts. The media URLs are null unless the reel is
 * published: the kill switch withholds the player and every download, while
 * the title/feature/transcript stay readable (C193 decision B).
 */
export const toReelDetailViewModel = (record: ReelRecordForView): ReelDetailViewModel => {
  const base = toReelLibraryItemViewModel(record)
  const canServeMedia = canServeReelMedia(base.status)
  const transcript = record.transcript?.trim()
  const mediaBlockedLabel =
    base.status === 'draft' ? REEL_MEDIA_DRAFT_LABEL : REEL_MEDIA_BLOCKED_LABEL

  const unavailableLabelFor = (kind: ReelDownloadKind): string | null => {
    if (!canServeMedia) return mediaBlockedLabel
    return hasMedia(record[reelMediaFieldByKind[kind]]) ? null : reelDownloadUnavailableLabels[kind]
  }

  const downloads = REEL_DOWNLOAD_KINDS.map((kind): ReelDownloadItemViewModel => {
    const { label, description } = reelDownloadLabels[kind]

    return {
      kind,
      label,
      description,
      primary: kind === 'video',
      href:
        canServeMedia && hasMedia(record[reelMediaFieldByKind[kind]])
          ? `${reelMediaPath(record.id, kind)}?download=1`
          : null,
      unavailableLabel: unavailableLabelFor(kind),
    }
  })

  return {
    ...base,
    transcript: transcript ? transcript : null,
    canServeMedia,
    mediaBlockedLabel,
    videoSourceUrl: canServeMedia
      ? reelMediaPath(record.id, hasMedia(record.videoWithAudio) ? 'video-audio' : 'video')
      : null,
    videoPosterUrl: base.coverUrl,
    downloads,
  }
}
