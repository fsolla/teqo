import 'server-only'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload, Where } from 'payload'
import sharp from 'sharp'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import {
  archivePhotoCatalogText,
  buildArchivePhotoCatalogWrite,
  buildArchivePhotoMetadataCatalogWrite,
  matchPublicFigureMentions,
  type ArchivePhotoCatalogSource,
  type ArchivePhotoCatalogWrite,
  type ArchivePhotoCuratedField,
  type ArchivePhotoMetadataCatalogWrite,
  type ArchivePhotoSuggestion,
} from '@/lib/archivePhotoCatalog'
import { classifySpeechByGazetteer } from '@/lib/speechGazetteer'
import type { ArchivePhoto } from '@/payload-types'
import { messageOf } from '@/utilities/media/ffmpeg'
import { resolveMentionedMunicipalityId } from '@/utilities/municipality/municipalityMentionResolver'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  downloadPrivateMediaToFile,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C232 — Payload-side cataloguing of one archive photo: the private bytes are
 * downloaded to a temp file, downscaled for the engine, answered by the
 * injected analyzer and merged with the deterministic text rules (gazetteer
 * municipality/themes, curated-catalog people) inside ONE transaction that
 * re-reads `curatedFields` and never overwrites a human decision. The engine
 * is a seam: `src/` never imports `scripts/`; the CLI injects the HTTP client.
 *
 * Failure of one photo is returned, never thrown — the caller owns the receipt,
 * nothing is written and the next run retries it (a failure is NOT a state).
 * The model never names people and there is no biometrics here.
 */

/** Long edge sent to the engine; the original never leaves the archive. */
const IMAGE_MAX_EDGE = 1024
const IMAGE_JPEG_QUALITY = 80

export type ArchivePhotoCatalogItem = {
  id: number
  flickrId: string
  filename: string | null
  mimeType: string | null
  title: string | null
  description: string | null
  takenAt: string | null
  alt: string
  albums: { title: string }[]
  tags: string[]
}

export type ArchivePhotoAnalyzer = (input: {
  imageDataUrl: string
}) => Promise<ArchivePhotoSuggestion>

export type ArchivePhotoCatalogResult =
  | { status: 'cataloged'; source: ArchivePhotoCatalogSource }
  | { status: 'skipped' }
  | {
      status: 'failed'
      stage: 'download' | 'image' | 'analyze' | 'resolve' | 'write'
      error: string
    }

const toItem = (doc: {
  id: number
  flickrId: string
  filename?: string | null
  mimeType?: string | null
  title?: string | null
  description?: string | null
  takenAt?: string | null
  alt: string
  albums?: ({ title?: string | null } | null)[] | null
  tags?: ({ name?: string | null } | null)[] | null
}): ArchivePhotoCatalogItem => ({
  id: doc.id,
  flickrId: doc.flickrId,
  filename: doc.filename ?? null,
  mimeType: doc.mimeType ?? null,
  title: doc.title ?? null,
  description: doc.description ?? null,
  takenAt: doc.takenAt ?? null,
  alt: doc.alt,
  albums: (doc.albums ?? [])
    .map((album) => album?.title ?? '')
    .filter((title) => title !== '')
    .map((title) => ({ title })),
  tags: (doc.tags ?? []).map((tag) => tag?.name ?? '').filter((name) => name !== ''),
})

const catalogSelect = {
  flickrId: true,
  filename: true,
  mimeType: true,
  title: true,
  description: true,
  takenAt: true,
  alt: true,
  albums: true,
  tags: true,
} as const

/**
 * The photos still waiting for a catalogue, oldest first. `catalogedAt` is the
 * idempotency key: a catalogued photo (any source, including "nada a propor")
 * never enters the queue again. `limit` is the canary cap — when absent, the
 * whole queue is paged read-only.
 */
export const listArchivePhotoCatalogQueue = async ({
  payload,
  limit,
}: {
  payload: Payload
  limit?: number | null
}): Promise<ArchivePhotoCatalogItem[]> =>
  pagedCatalogItems({
    payload,
    where: { 'catalog.catalogedAt': { exists: false } },
    limit,
  })

/**
 * C245 — the photos still waiting for the metadata-only layer: neither the
 * deterministic pass (metadataCheckedAt) nor the AI pass (catalogedAt) ran on
 * them. A row already catalogued by the AI never enters here — that pass
 * derives the same text fields — so the metadata layer cannot re-stamp a
 * `source` that the model earned. The AI queue above is untouched: the marker
 * of this layer never blocks the model.
 */
export const listArchivePhotoMetadataCatalogQueue = async ({
  payload,
  limit,
}: {
  payload: Payload
  limit?: number | null
}): Promise<ArchivePhotoCatalogItem[]> =>
  pagedCatalogItems({
    payload,
    where: {
      'catalog.metadataCheckedAt': { exists: false },
      'catalog.catalogedAt': { exists: false },
    },
    limit,
  })

const pagedCatalogItems = async ({
  payload,
  where,
  limit,
}: {
  payload: Payload
  where: Where
  limit?: number | null
}): Promise<ArchivePhotoCatalogItem[]> => {
  const items: ArchivePhotoCatalogItem[] = []
  let page = 1
  let totalPages = 1
  do {
    const found = await payload.find({
      collection: ARCHIVE_PHOTO_SLUG,
      where,
      page,
      limit: 100,
      depth: 0,
      sort: 'id',
      select: catalogSelect,
      // Intentional bypass: the catalogue CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    for (const doc of found.docs) {
      items.push(toItem(doc))
      if (limit != null && items.length >= limit) return items
    }
    totalPages = found.totalPages
    page += 1
  } while (page <= totalPages)
  return items
}

/** The stored catalog with the relationship normalized to its id (depth 0). */
const catalogSnapshot = (doc: ArchivePhotoCatalogDoc) =>
  doc.catalog
    ? {
        ...doc.catalog,
        municipality:
          typeof doc.catalog.municipality === 'number' ? doc.catalog.municipality : null,
      }
    : null

/** The fresh-read shape both layers' builders receive (partial select). */
type ArchivePhotoCatalogDoc = {
  alt?: string | null
  curatedFields?: ArchivePhotoCuratedField[] | null
  catalog?: ArchivePhoto['catalog'] | null
}

/**
 * The one transactional write both layers share: fresh-read inside the
 * transaction, skip when the layer's marker already landed (another run
 * committed before this transaction), merge via the layer's pure builder and
 * write with the `archivePhotoCatalog` context so the admin hook never marks
 * curation on a system write. `undefined` values are omitted by Payload — a
 * layer only touches what it proposes. The layers are run serially by ops
 * (metadata first, AI later), so there is no concurrent-write dance here.
 */
const writeArchivePhotoCatalog = async ({
  payload,
  item,
  skip,
  buildWrite,
}: {
  payload: Payload
  item: ArchivePhotoCatalogItem
  skip: (doc: ArchivePhotoCatalogDoc) => boolean
  buildWrite: (
    doc: ArchivePhotoCatalogDoc,
  ) => ArchivePhotoCatalogWrite | ArchivePhotoMetadataCatalogWrite
}): Promise<ArchivePhotoCatalogResult> => {
  try {
    return await withPayloadTransaction(payload, async ({ req }) => {
      // Fresh read inside the transaction: whatever the assessoria curated
      // (or another layer wrote) while this photo was in flight wins.
      const fresh = await payload.find({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { id: { equals: item.id } },
        depth: 0,
        limit: 1,
        pagination: false,
        select: { alt: true, curatedFields: true, catalog: true },
        req,
        // Intentional bypass: the catalogue CLI is a trusted actor with no session.
        overrideAccess: true,
      })
      const doc = fresh.docs[0]
      if (!doc) return { status: 'failed', stage: 'write', error: 'Foto não encontrada.' }
      if (skip(doc)) return { status: 'skipped' }

      const write = buildWrite(doc)

      await payload.update({
        collection: ARCHIVE_PHOTO_SLUG,
        id: item.id,
        data: write.data,
        depth: 0,
        req,
        context: { archivePhotoCatalog: true },
        // Intentional bypass: the catalogue CLI is a trusted actor with no session.
        overrideAccess: true,
      })

      return { status: 'cataloged', source: write.source }
    })
  } catch (error) {
    return { status: 'failed', stage: 'write', error: messageOf(error, 'erro desconhecido') }
  }
}

/**
 * The deterministic text derivations both layers share: the base text (plus
 * the AI extras, when present) feeds the gazetteer município and themes. A
 * failed município catalogue read throws — the caller names the `resolve`
 * stage on the receipt.
 */
const deriveArchivePhotoCatalogText = async ({
  payload,
  item,
  extras = [],
}: {
  payload: Payload
  item: ArchivePhotoCatalogItem
  extras?: readonly (string | null | undefined)[]
}) => {
  const text = archivePhotoCatalogText(
    {
      alt: item.alt,
      title: item.title,
      description: item.description,
      albumTitles: item.albums.map((album) => album.title),
      tagNames: item.tags,
    },
    extras,
  )
  const municipalityId = await resolveMentionedMunicipalityId({ payload, text })
  const gazetteerThemes = classifySpeechByGazetteer({ transcript: text }).topics
  return { text, municipalityId, gazetteerThemes }
}

/**
 * One photo through the whole pipeline. Phases fail with a NAMED stage so the
 * receipt says why: download/image never reach the engine, analyze is the
 * provider, write is the transaction. `skipped` means the photo was catalogued
 * after the queue was read (fresh read inside the transaction).
 */
export const catalogArchivePhoto = async ({
  payload,
  item,
  analyze,
}: {
  payload: Payload
  item: ArchivePhotoCatalogItem
  analyze: ArchivePhotoAnalyzer
}): Promise<ArchivePhotoCatalogResult> => {
  let tempDir: string | null = null
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'archive-photo-'))
    const originalPath = join(tempDir, 'original')

    try {
      await downloadPrivateMediaToFile({
        media: { filename: item.filename, mimeType: item.mimeType },
        staticDir: resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG),
        destinationPath: originalPath,
      })
    } catch (error) {
      return { status: 'failed', stage: 'download', error: messageOf(error, 'erro desconhecido') }
    }

    let imageDataUrl: string
    try {
      const resized = await sharp(originalPath)
        .rotate()
        .resize({
          width: IMAGE_MAX_EDGE,
          height: IMAGE_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMAGE_JPEG_QUALITY })
        .toBuffer()
      imageDataUrl = `data:image/jpeg;base64,${resized.toString('base64')}`
    } catch (error) {
      return { status: 'failed', stage: 'image', error: messageOf(error, 'erro desconhecido') }
    }

    let suggestion: ArchivePhotoSuggestion
    try {
      suggestion = await analyze({ imageDataUrl })
    } catch (error) {
      return { status: 'failed', stage: 'analyze', error: messageOf(error, 'erro desconhecido') }
    }

    let derivations: Awaited<ReturnType<typeof deriveArchivePhotoCatalogText>>
    try {
      derivations = await deriveArchivePhotoCatalogText({
        payload,
        item,
        extras: [suggestion.caption, suggestion.visibleText],
      })
    } catch (error) {
      return { status: 'failed', stage: 'resolve', error: messageOf(error, 'erro desconhecido') }
    }
    const mentionedPeople = matchPublicFigureMentions(derivations.text)
    const writtenAt = new Date().toISOString()

    const result = await writeArchivePhotoCatalog({
      payload,
      item,
      skip: (doc) => Boolean(doc.catalog?.catalogedAt),
      buildWrite: (doc) =>
        buildArchivePhotoCatalogWrite({
          suggestion,
          municipalityId: derivations.municipalityId,
          mentionedPeople,
          gazetteerThemes: derivations.gazetteerThemes,
          curatedFields: doc.curatedFields ?? [],
          currentCatalog: catalogSnapshot(doc),
          currentAlt: doc.alt,
          catalogedAt: writtenAt,
          // The AI pass runs the same deterministic derivation, so it also
          // stamps the metadata layer's own marker.
          metadataCheckedAt: writtenAt,
        }),
    })
    // A failed write is returned (never thrown); the temp dir cleanup happens
    // in the `finally` below either way.
    return result
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * C245 — one photo through the metadata-only catalogue: no media download, no
 * engine. The text already stored on the row (alt, title, Flickr description,
 * albums, tags) feeds the gazetteer municipality and themes; people are never
 * written here (C244 owns the facial facet). The write stamps
 * `metadataCheckedAt` only — `catalogedAt` is left for the AI layer, so the
 * photo stays in the model queue and a re-run converges.
 */
export const catalogArchivePhotoMetadata = async ({
  payload,
  item,
}: {
  payload: Payload
  item: ArchivePhotoCatalogItem
}): Promise<ArchivePhotoCatalogResult> => {
  let derivations: Awaited<ReturnType<typeof deriveArchivePhotoCatalogText>>
  try {
    derivations = await deriveArchivePhotoCatalogText({ payload, item })
  } catch (error) {
    return { status: 'failed', stage: 'resolve', error: messageOf(error, 'erro desconhecido') }
  }
  const checkedAt = new Date().toISOString()

  return writeArchivePhotoCatalog({
    payload,
    item,
    skip: (doc) => Boolean(doc.catalog?.metadataCheckedAt || doc.catalog?.catalogedAt),
    buildWrite: (doc) =>
      buildArchivePhotoMetadataCatalogWrite({
        municipalityId: derivations.municipalityId,
        gazetteerThemes: derivations.gazetteerThemes,
        curatedFields: doc.curatedFields ?? [],
        currentCatalog: catalogSnapshot(doc),
        metadataCheckedAt: checkedAt,
      }),
  })
}
