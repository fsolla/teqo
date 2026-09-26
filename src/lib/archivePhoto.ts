/**
 * C231 — pure rules of the Flickr photo archive: the collection slug, the
 * original-file vocabulary, the deterministic storage name and the mapping
 * from the Flickr API listing item to the `archivePhoto` record. No I/O and no
 * `server-only`: the ingest CLI (`scripts/lib/flickrPlan.mjs`), the
 * Payload-side ingestion, the int spec and the unit tests share this module.
 *
 * The archive is raw material: nothing here publishes, curates or edits — the
 * metadata the Flickr listing brought is preserved as data (C232 curates these
 * same rows later; the Flickr account stays the source and is never touched).
 */

/** Owner of the private upload collection slug (collection, S3 map and CLI). */
export const ARCHIVE_PHOTO_SLUG = 'archivePhoto' as const

/**
 * Where the stored original came from: the listing's `url_o` ("original") or
 * the largest `flickr.photos.getSizes` entry when the original is restricted
 * ("largest"). Travels in the receipt so a fallback is never silent.
 */
type ArchivePhotoOriginalKind = 'original' | 'largest'

/** One album membership of a photo (a photo may live in N albums). */
export type ArchivePhotoAlbum = {
  albumId: string
  title: string
}

/** Both coordinates or no geotag at all — never half a point. */
export type ArchivePhotoGeo = {
  latitude: number
  longitude: number
}

export type ArchivePhotoExifEntry = {
  tag: string
  label: string
  value: string
}

/**
 * The normalized record the CLI hands to `ingestArchivePhoto`. `alt` is derived
 * (`archivePhotoAlt`), never carried here.
 */
export type ArchivePhotoImport = {
  flickrId: string
  sourceUrl: string | null
  owner: string | null
  license: string | null
  title: string | null
  description: string | null
  tags: string[]
  /** Flickr wall-clock `YYYY-MM-DD HH:MM:SS` (no timezone in the source). */
  takenAt: string | null
  /** Upload time as ISO UTC (derived from `dateupload`). */
  postedAt: string | null
  albums: ArchivePhotoAlbum[]
  geo: ArchivePhotoGeo | null
  exif: ArchivePhotoExifEntry[]
  originalUrl: string
  originalKind: ArchivePhotoOriginalKind
}

const FLICKR_ARCHIVE_PHOTO_FILENAME_DEFAULT_EXTENSION = '.jpg'
/** Flickr's zoneless wall clock: `YYYY-MM-DD[ HH:MM:SS]`. */
const FLICKR_TAKEN_AT_RE = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/
const FLICKR_ID_RE = /^\d{1,20}$/
const URL_EXTENSION_RE = /\.([a-z0-9]{2,5})$/i

const trimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text === '' ? null : text
}

const httpUrl = (value: unknown): string | null => {
  const text = trimmed(value)
  if (text === null) return null
  return text.startsWith('https://') || text.startsWith('http://') ? text : null
}

/** Flickr labels a missing geotag as (0, 0) — never a real Bahia coordinate. */
const isMissingGeo = (latitude: number, longitude: number): boolean =>
  latitude === 0 && longitude === 0

/**
 * Deterministic stored name: `flickr-<id>.<ext>`, extension from the original
 * URL (`.jpeg` normalized to `.jpg`, `.jpg` when absent/unknown). The name is
 * the idempotency key of the OBJECT too — a re-run overwrites the same key.
 */
export const archivePhotoStorageFilename = (flickrId: string, originalUrl: string): string => {
  const id = String(flickrId).replace(/[^0-9A-Za-z_-]/g, '')
  let extension = FLICKR_ARCHIVE_PHOTO_FILENAME_DEFAULT_EXTENSION
  try {
    const match = URL_EXTENSION_RE.exec(new URL(String(originalUrl)).pathname)
    if (match) {
      const found = `.${match[1].toLowerCase()}`
      extension = found === '.jpeg' ? '.jpg' : found
    }
  } catch {
    // Malformed URL: the default extension is the documented fallback.
  }
  return `flickr-${id}${extension}`
}

/** The Flickr page of a photo (path alias when the listing brought one). */
export const archivePhotoSourceUrl = ({
  flickrId,
  pathAlias,
}: {
  flickrId: string
  pathAlias: string | null
}): string =>
  pathAlias
    ? `https://www.flickr.com/photos/${encodeURIComponent(pathAlias)}/${flickrId}/`
    : `https://www.flickr.com/photo.gne?id=${flickrId}`

/** Accessible alt of the stored original; C232 refines the curated copy. */
export const archivePhotoAlt = (record: { title: string | null; flickrId: string }): string =>
  record.title?.trim() || `Foto do acervo (Flickr ${record.flickrId})`

/** Flickr `datetaken` is a zoneless wall clock; keep it verbatim (or null). */
export const archivePhotoTakenAt = (value: unknown): string | null => {
  const text = trimmed(value)
  if (text === null || !FLICKR_TAKEN_AT_RE.test(text)) return null
  return text.length === 10 ? `${text} 00:00:00` : text
}

/** `dateupload` (epoch seconds, string or number) → ISO UTC (or null). */
export const archivePhotoPostedAt = (value: unknown): string | null => {
  const seconds = typeof value === 'number' ? value : Number(trimmed(value))
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

/**
 * Listing `tags` rides as one space-separated string. Arrays are accepted for
 * the defensive path; empties drop, exact duplicates collapse, order stays.
 */
export const archivePhotoTags = (value: unknown): string[] => {
  const words = Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' ? entry.split(/\s+/) : []))
    : typeof value === 'string'
      ? value.split(/\s+/)
      : []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const word of words) {
    const tag = word.trim()
    if (tag === '' || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = trimmed(value)
  if (text === null) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/** Both coordinates in range and not the (0, 0) "no geotag" sentinel. */
export const archivePhotoGeoFrom = (
  latitude: unknown,
  longitude: unknown,
): ArchivePhotoGeo | null => {
  const lat = numberOrNull(latitude)
  const lon = numberOrNull(longitude)
  if (lat === null || lon === null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  if (isMissingGeo(lat, lon)) return null
  return { latitude: lat, longitude: lon }
}

/**
 * Normalizes `flickr.photos.getExif` (when it answered) into the stored json:
 * one entry per tag, empty values dropped, deterministic order.
 */
export const archivePhotoExifEntries = (value: unknown): ArchivePhotoExifEntry[] => {
  if (!Array.isArray(value)) return []
  const entries: ArchivePhotoExifEntry[] = []
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const tag = trimmed(entry.tag) ?? trimmed(entry.tagspace)
    const label = trimmed(entry.label) ?? tag
    const value = trimmed(entry.clean) ?? trimmed(entry.raw)
    if (tag === null || label === null || value === null) continue
    entries.push({ tag, label, value })
  }
  return entries.sort((a, b) => a.tag.localeCompare(b.tag) || a.label.localeCompare(b.label))
}

const normalizeAlbums = (albums: readonly ArchivePhotoAlbum[]): ArchivePhotoAlbum[] => {
  const byId = new Map<string, ArchivePhotoAlbum>()
  for (const album of albums) {
    const albumId = trimmed(album?.albumId)
    const title = trimmed(album?.title)
    if (albumId === null || title === null || byId.has(albumId)) continue
    byId.set(albumId, { albumId, title })
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))
}

export type ArchivePhotoImportSource = {
  /** One `flickr.people.getPhotos` item (extras included). */
  photo: unknown
  /** Album memberships of this photo, resolved before any write. */
  albums: readonly ArchivePhotoAlbum[]
  /** `flickr.photos.getExif` answer, when the per-photo call succeeded. */
  exif: unknown
  /** Largest `flickr.photos.getSizes` URL — the fallback for a missing `url_o`. */
  fallbackOriginalUrl?: string | null
}

export type ArchivePhotoImportResult =
  | { ok: true; record: ArchivePhotoImport }
  | { ok: false; reason: 'id' | 'not-a-photo' | 'original' }

const licenseOrNull = (value: unknown): string | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  return trimmed(value)
}

/**
 * Maps one listing item into the `archivePhoto` record. Only three things can
 * reject a photo — a missing/non-numeric id, a video item (own backlog, never
 * ingested here) and the absence of BOTH the original and the largest size —
 * and each rejection has its own named reason for the receipt.
 */
export const archivePhotoImportFromFlickr = ({
  photo,
  albums,
  exif,
  fallbackOriginalUrl = null,
}: ArchivePhotoImportSource): ArchivePhotoImportResult => {
  if (photo === null || typeof photo !== 'object') return { ok: false, reason: 'id' }
  const item = photo as Record<string, unknown>

  const flickrId = trimmed(item.id)
  if (flickrId === null || !FLICKR_ID_RE.test(flickrId)) return { ok: false, reason: 'id' }

  if (trimmed(item.media) !== 'photo') return { ok: false, reason: 'not-a-photo' }

  const original = httpUrl(item.url_o)
  const fallback = httpUrl(fallbackOriginalUrl)
  const originalUrl = original ?? fallback
  if (originalUrl === null) return { ok: false, reason: 'original' }

  const description =
    item.description !== null && typeof item.description === 'object'
      ? trimmed((item.description as Record<string, unknown>)._content)
      : trimmed(item.description)

  const license = licenseOrNull(item.license)

  return {
    ok: true,
    record: {
      flickrId,
      sourceUrl: archivePhotoSourceUrl({ flickrId, pathAlias: trimmed(item.path_alias) }),
      owner: trimmed(item.owner),
      license,
      title: trimmed(item.title),
      description,
      tags: archivePhotoTags(item.tags),
      takenAt: archivePhotoTakenAt(item.datetaken),
      postedAt: archivePhotoPostedAt(item.dateupload),
      albums: normalizeAlbums(albums),
      geo: archivePhotoGeoFrom(item.latitude, item.longitude),
      exif: archivePhotoExifEntries(exif),
      originalUrl,
      originalKind: original !== null ? 'original' : 'largest',
    },
  }
}
