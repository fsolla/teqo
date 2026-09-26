/**
 * C231 — pure planning/reporting of the Flickr photo-archive ingestion:
 * listing collection (pagination, videos, limit), the photo→albums map, the
 * plan entries (new/existing/fallback/invalid), the run summaries and the
 * human lines + JSON receipt. No I/O of its own: the Flickr client and the
 * Payload lookups arrive as parameters, so the unit spec drives everything
 * with fakes.
 */

import { archivePhotoImportFromFlickr } from '../../src/lib/archivePhoto.ts'

/**
 * @typedef {import('../../src/lib/archivePhoto.ts').ArchivePhotoAlbum} ArchivePhotoAlbum
 * @typedef {import('../../src/lib/archivePhoto.ts').ArchivePhotoImport} ArchivePhotoImport
 */

/**
 * @typedef {object} FlickrPhotoItem
 * @property {string | number} [id]
 * @property {string} [media]
 * @property {string} [url_o]
 * @property {Record<string, unknown>} [key: string]
 *
 * The client is injected (real one in the CLI, fakes in the unit spec): any
 * method answering a Promise; the call shapes are pinned by the CLI's usage.
 *
 * @typedef {Object<string, (options?: any) => Promise<any>>} FlickrClientLike
 */

const VIDEO_MEDIA = 'video'
const BYTES_PER_MIB = 1024 * 1024

const USAGE =
  'uso: `pnpm flickr:import [--apply|--verify] [--limit <n>] [--page <n>] [--out <dir>]`'

export const ARCHIVE_PHOTO_DEFAULT_OUT_DIR = 'data/flickr'

export const archivePhotoReportStamp = (runAt) => runAt.replace(/[:.]/g, '-')

/**
 * `pnpm flickr:import` argv parser — pure, so the unit spec pins it (the CLI
 * owns the exit and the help text). The default mode is the plan/dry-run;
 * errors carry the usage line.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, verify: boolean, limit: number | null, page: number, out: string, help: boolean }}
 */
export const parseArchiveCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    verify: false,
    limit: null,
    page: 1,
    out: ARCHIVE_PHOTO_DEFAULT_OUT_DIR,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para ${arg} — ${USAGE}.`)
      }
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--verify') options.verify = true
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--page') options.page = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (options.apply && options.verify) {
    throw new Error(`--apply e --verify são mutuamente exclusivos — ${USAGE}.`)
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit deve ser >= 1.')
  }
  if (!Number.isInteger(options.page) || options.page < 1) {
    throw new Error('--page deve ser >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * Walks `flickr.people.getPhotos` pages until the listing ends or `limit`
 * photos were collected. Videos are counted and skipped (own backlog; never
 * ingested here), and an item without a usable id is named in `malformed`
 * instead of vanishing.
 *
 * @param {{
 *   client: any,
 *   userId: string,
 *   startPage?: number,
 *   limit?: number | null,
 * }} options
 * @returns {Promise<{
 *   items: any[],
 *   videos: string[],
 *   malformed: Array<{ reason: string }>,
 *   apiTotal: number,
 *   pages: number,
 *   pagesFetched: number,
 * }>}
 */
export const collectArchiveListing = async ({ client, userId, startPage = 1, limit = null }) => {
  const items = []
  const videos = []
  const malformed = []
  let apiTotal = 0
  let pages = 1
  let page = startPage

  for (;;) {
    const listing = await client.listPhotosPage({ userId, page })
    pages = Math.max(1, Number(listing?.pages) || 1)
    if (page === startPage) apiTotal = Number(listing?.total) || 0

    const batch = Array.isArray(listing?.photo) ? listing.photo : []
    for (const photo of batch) {
      if (photo?.media === VIDEO_MEDIA) {
        videos.push(String(photo.id ?? ''))
        continue
      }
      const id = photo?.id === undefined || photo?.id === null ? null : String(photo.id).trim()
      if (id === null || id === '') {
        malformed.push({ reason: 'id' })
        continue
      }
      items.push(photo)
      if (limit !== null && items.length >= limit) {
        return { items, videos, malformed, apiTotal, pages, pagesFetched: page - startPage + 1 }
      }
    }

    if (page >= pages) break
    page += 1
  }

  return { items, videos, malformed, apiTotal, pages, pagesFetched: page - startPage + 1 }
}

/**
 * The whole photo→albums map, resolved BEFORE any write: every album of the
 * account is listed, then each album's photos are walked. A photo in N albums
 * stays one photo with N memberships (the ingestion never duplicates it).
 *
 * @param {{ client: FlickrClientLike, userId: string }} options
 * @returns {Promise<{
 *   albumsById: Map<string, ArchivePhotoAlbum>,
 *   albumsByPhotoId: Map<string, ArchivePhotoAlbum[]>,
 *   skippedAlbums: Array<{ albumId: string, reason: 'id' | 'title' }>,
 * }>}
 */
export const collectArchiveAlbums = async ({ client, userId }) => {
  const albumsById = new Map()
  const albumsByPhotoId = new Map()
  const skippedAlbums = []

  let page = 1
  let pages = 1
  do {
    const listing = await client.listPhotoSets({ userId, page })
    pages = Math.max(1, Number(listing?.pages) || 1)
    for (const photoset of Array.isArray(listing?.photoset) ? listing.photoset : []) {
      const albumId =
        photoset?.id === undefined || photoset?.id === null ? '' : String(photoset.id).trim()
      const titleValue = photoset?.title?._content ?? photoset?.title
      const title = typeof titleValue === 'string' ? titleValue.trim() : ''
      if (albumId === '' || title === '') {
        skippedAlbums.push({ albumId, reason: albumId === '' ? 'id' : 'title' })
        continue
      }
      if (!albumsById.has(albumId)) albumsById.set(albumId, { albumId, title })
    }
    page += 1
  } while (page <= pages)

  for (const album of albumsById.values()) {
    let photoPage = 1
    let photoPages = 1
    do {
      const listing = await client.listPhotoSetPage({
        userId,
        albumId: album.albumId,
        page: photoPage,
      })
      photoPages = Math.max(1, Number(listing?.pages) || 1)
      for (const photo of Array.isArray(listing?.photo) ? listing.photo : []) {
        const photoId = photo?.id === undefined || photo?.id === null ? '' : String(photo.id).trim()
        if (photoId === '') continue
        const memberships = albumsByPhotoId.get(photoId) ?? []
        if (!memberships.some((entry) => entry.albumId === album.albumId)) {
          memberships.push(album)
        }
        albumsByPhotoId.set(photoId, memberships)
      }
      photoPage += 1
    } while (photoPage <= photoPages)
  }

  return { albumsById, albumsByPhotoId, skippedAlbums }
}

/**
 * Maps the collected listing into plan entries, checking each `flickrId`
 * against what is already archived FIRST — an archived photo is never
 * re-mapped nor re-downloaded, even one that needed the size fallback. For the
 * rest, the mapper is the single judge of `url_o`: its absence is the named
 * `fallback` status (the apply pass resolves the largest size), anything else
 * is invalid with its own reason.
 *
 * @param {{
 *   items: FlickrPhotoItem[],
 *   albumsByPhotoId: Map<string, ArchivePhotoAlbum[]>,
 *   findExisting: (flickrId: string) => Promise<unknown>,
 * }} options
 */
export const planArchiveEntries = async ({ items, albumsByPhotoId, findExisting }) => {
  const entries = []

  for (const photo of items) {
    const flickrId = String(photo.id).trim()
    const albums = albumsByPhotoId?.get(flickrId) ?? []

    const existing = await findExisting(flickrId)
    if (existing) {
      entries.push({ flickrId, albums, photo, status: 'existing', existing })
      continue
    }

    const mapped = archivePhotoImportFromFlickr({ photo, albums, exif: null })
    if (mapped.ok) {
      entries.push({ flickrId, albums, photo, status: 'new', record: mapped.record })
    } else if (mapped.reason === 'original') {
      entries.push({ flickrId, albums, photo, status: 'fallback' })
    } else {
      entries.push({ flickrId, albums, photo, status: 'invalid', reason: mapped.reason })
    }
  }

  return entries
}

/** @param {Array<{ status: string }>} entries */
export const summarizeArchivePlan = (entries) => ({
  new: entries.filter((entry) => entry.status === 'new').length,
  existing: entries.filter((entry) => entry.status === 'existing').length,
  fallback: entries.filter((entry) => entry.status === 'fallback').length,
  invalid: entries.filter((entry) => entry.status === 'invalid').length,
})

/**
 * @param {Array<{ status: string, bytes?: number | null, flickrId: string, stage?: string | null, error?: string | null }>} results
 */
export const summarizeArchiveResults = (results) => ({
  created: results.filter((result) => result.status === 'created').length,
  existing: results.filter((result) => result.status === 'existing').length,
  failed: results.filter((result) => result.status === 'failed').length,
  bytes: results.reduce((total, result) => total + (Number(result.bytes) || 0), 0),
  failures: results
    .filter((result) => result.status === 'failed')
    .map((result) => ({
      flickrId: result.flickrId,
      stage: result.stage ?? null,
      error: result.error ?? null,
    })),
})

/**
 * The `--verify` inventory over the stored rows (read-only, no Flickr, no
 * bucket): counts, bytes, per-album coverage, metadata gaps and rows without
 * a stored filename (the one broken state this check fails on).
 *
 * @param {any[]} rows
 */
export const summarizeArchiveInventory = (rows) => {
  const albums = new Map()
  const missingFilename = []
  let bytes = 0
  let withTakenAt = 0
  let withGeo = 0
  let withExif = 0
  let withTags = 0
  let withAlbums = 0

  for (const row of rows) {
    bytes += Number(row?.filesize) || 0
    if (row?.takenAt) withTakenAt += 1
    if (row?.geo?.latitude !== undefined && row?.geo?.latitude !== null) withGeo += 1
    if (Array.isArray(row?.exif) && row.exif.length > 0) withExif += 1
    if (Array.isArray(row?.tags) && row.tags.length > 0) withTags += 1
    if (Array.isArray(row?.albums) && row.albums.length > 0) withAlbums += 1
    for (const album of Array.isArray(row?.albums) ? row.albums : []) {
      const albumId = String(album?.albumId ?? '')
      if (albumId === '') continue
      const entry = albums.get(albumId) ?? { albumId, title: album?.title ?? '', count: 0 }
      entry.count += 1
      albums.set(albumId, entry)
    }
    if (!row?.filename) missingFilename.push(String(row?.flickrId ?? ''))
  }

  return {
    total: rows.length,
    bytes,
    withTakenAt,
    withGeo,
    withExif,
    withTags,
    withAlbums,
    albums: [...albums.values()].sort((a, b) => b.count - a.count),
    missingFilename,
  }
}

const REPORT_LABEL = '[flickr:import]'

/** Byte label shared by the report lines and the CLI progress log. */
export const formatArchiveBytes = (bytes) =>
  `${((Number(bytes) || 0) / BYTES_PER_MIB).toFixed(1)} MiB`

/**
 * Human lines for stdout; the JSON file keeps the full report. Failures and
 * invalid entries are never hidden — each one names its reason.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveReport = (report) => {
  const label = REPORT_LABEL
  const lines = []

  lines.push(
    `${label} fotos na API: ${report.apiTotal} · coletadas: ${report.collected} · vídeos pulados: ${report.videos} · sem id: ${report.malformed.length}`,
  )
  if (report.albums !== undefined) {
    lines.push(`${label} álbuns: ${report.albums}`)
  }

  if (report.mode === 'plan') {
    lines.push(
      `${label} plano (dry-run): novas: ${report.plan.new} · já existiam: ${report.plan.existing} · original via maior tamanho: ${report.plan.fallback} · inválidas: ${report.plan.invalid}`,
    )
  } else {
    lines.push(
      `${label} resultado: novas: ${report.summary.created} · já existiam: ${report.summary.existing} · falhas: ${report.summary.failed} · bytes baixados: ${formatArchiveBytes(report.summary.bytes)}`,
    )
  }

  lines.push(`${label} tempo: ${(report.durationMs / 1000).toFixed(1)}s`)

  for (const invalid of report.invalidEntries ?? []) {
    lines.push(`${label} inválida ${invalid.flickrId}: ${invalid.reason}`)
  }
  const failures = report.failures ?? report.summary?.failures ?? []
  if (failures.length > 0) {
    lines.push(`${label} falhas:`)
    for (const failure of failures) {
      lines.push(
        `  - ${failure.flickrId} (${failure.stage ?? 'desconhecido'}): ${failure.error ?? 'erro'}`,
      )
    }
  }
  return lines
}

/** `--verify` human lines (inventory, read-only). */
export const formatArchiveInventory = (inventory) => {
  const label = REPORT_LABEL
  const lines = [
    `${label} inventário: ${inventory.total} foto(s) · ${formatArchiveBytes(inventory.bytes)}`,
    `${label} metadados: data: ${inventory.withTakenAt} · geotag: ${inventory.withGeo} · EXIF: ${inventory.withExif} · tags: ${inventory.withTags} · álbuns: ${inventory.withAlbums}`,
    `${label} álbuns no acervo: ${inventory.albums.length}`,
  ]
  for (const album of inventory.albums) {
    lines.push(`  - ${album.title || album.albumId} (${album.albumId}): ${album.count}`)
  }
  if (inventory.missingFilename.length > 0) {
    lines.push(`${label} sem arquivo armazenado: ${inventory.missingFilename.join(', ')}`)
  }
  return lines
}
