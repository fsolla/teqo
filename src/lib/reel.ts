/**
 * C193 — pure rules of a reel: the status vocabulary (kill switch), the
 * feature catalog, the artifact `kind` → upload-field map and the private
 * media path. No I/O and no `server-only`: the collection config, the
 * authenticated media route and the C194 library share this module.
 */

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

export const reelFeatureLabels: Record<ReelFeature, string> = {
  cards: 'Cards de apoio (#cards)',
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
