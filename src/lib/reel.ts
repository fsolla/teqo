/**
 * C193 — pure rules of a reel: the status vocabulary (kill switch), the
 * feature catalog, the artifact `kind` → upload-field map and the private
 * media path. No I/O and no `server-only`: the collection config, the
 * authenticated media route and the C194 library share this module. Since C195
 * it also owns the ingestion package contract (`REEL_PACKAGE_*`) that the
 * production skill (C196/C197) writes and `pnpm reels:ingest` validates.
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

/** Manifest file of the ingestion package (C195). */
export const REEL_PACKAGE_METADATA_FILENAME = 'metadata.json'

/** Human-readable script of the package; becomes the reel `transcript`. */
export const REEL_PACKAGE_TRANSCRIPT_FILENAME = 'roteiro.md'

/**
 * Keys of `metadata.json`. `shotListHash` is the identity of the reel (the
 * ingest updates the same entry for the same hash); `coverAlt` is the required
 * alt text of the cover. `durationSeconds`/`createdAt` are validated when
 * present but deliberately not persisted (no consumer yet).
 */
export const REEL_PACKAGE_METADATA_KEYS = {
  title: 'title',
  feature: 'feature',
  shotListHash: 'shotListHash',
  coverAlt: 'coverAlt',
  durationSeconds: 'durationSeconds',
  createdAt: 'createdAt',
} as const

export type ReelPackageArtifact = {
  /** File name inside the package directory. */
  filename: string
  kind: ReelMediaKind
  /** Required artifacts must be present; optional ones are ingested when there. */
  required: boolean
}

/** The package files, in the order the ingest echoes them. */
export const REEL_PACKAGE_ARTIFACTS: readonly ReelPackageArtifact[] = [
  { filename: 'reel.mp4', kind: 'video', required: true },
  { filename: 'capa.png', kind: 'cover', required: true },
  { filename: 'narracao.srt', kind: 'captions', required: true },
  { filename: 'reel-audio.mp4', kind: 'video-audio', required: false },
  { filename: 'narracao.mp3', kind: 'narration', required: false },
]

/** Content type per artifact kind — the package filenames are fixed, so is this. */
const REEL_PACKAGE_MIMETYPES: Record<ReelMediaKind, string> = {
  video: 'video/mp4',
  'video-audio': 'video/mp4',
  narration: 'audio/mpeg',
  captions: 'application/x-subrip',
  cover: 'image/png',
}

export const reelArtifactMimetype = (kind: ReelMediaKind): string => REEL_PACKAGE_MIMETYPES[kind]

/**
 * Deterministic stored file name: re-ingesting the same reel (same shot list
 * hash) overwrites the same object key, and the full hash makes two reels
 * collide only if their shot lists do.
 */
export const reelArtifactStorageFilename = (
  shotListHash: string,
  artifact: Pick<ReelPackageArtifact, 'filename' | 'kind'>,
): string => {
  const extension = artifact.filename.match(/\.[^.]+$/)?.[0] ?? ''
  return `reel-${shotListHash}-${artifact.kind}${extension}`
}

/** One artifact entry of a read package: contract + where it lives on disk. */
export type ReelPackageArtifactEntry = ReelPackageArtifact & {
  field: ReelMediaField
  present: boolean
  path: string
}

/**
 * The shape `readReelPackage` returns and `ingestReelPackage` consumes. Lives
 * next to the package contract because it is the same contract: the producer
 * writes these files, the CLI validates them and the writer persists them.
 */
export type ReelPackage = {
  directory: string
  metadata: {
    title: string
    feature: ReelFeature
    shotListHash: string
    coverAlt: string
  }
  artifacts: ReelPackageArtifactEntry[]
  transcriptPath: string | null
}

/** Alt text: the manifest alt for the cover, derived from the title otherwise. */
export const reelArtifactAlt = ({
  title,
  kind,
  coverAlt,
}: {
  title: string
  kind: ReelMediaKind
  coverAlt: string
}): string => {
  if (kind === 'cover') return coverAlt
  const labels: Record<Exclude<ReelMediaKind, 'cover'>, string> = {
    video: 'Vídeo',
    'video-audio': 'Vídeo com áudio',
    narration: 'Narração',
    captions: 'Legendas',
  }
  return `${labels[kind]} do reel "${title}"`
}
