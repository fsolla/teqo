import 'server-only'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import {
  buildArchivePhotoCatalogWrite,
  matchPublicFigureMentions,
  type ArchivePhotoCatalogSource,
  type ArchivePhotoSuggestion,
} from '@/lib/archivePhotoCatalog'
import { classifySpeechByGazetteer } from '@/lib/speechGazetteer'
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
}): Promise<ArchivePhotoCatalogItem[]> => {
  const items: ArchivePhotoCatalogItem[] = []
  let page = 1
  let totalPages = 1
  do {
    const found = await payload.find({
      collection: ARCHIVE_PHOTO_SLUG,
      where: { 'catalog.catalogedAt': { exists: false } },
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

    const text = [
      item.alt,
      item.title,
      item.description,
      ...item.albums.map((album) => album.title),
      ...item.tags,
      suggestion.caption,
      suggestion.visibleText,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .join(' ')

    let municipalityId: number | null
    try {
      municipalityId = await resolveMentionedMunicipalityId({ payload, text })
    } catch (error) {
      return { status: 'failed', stage: 'resolve', error: messageOf(error, 'erro desconhecido') }
    }
    const mentionedPeople = matchPublicFigureMentions(text)
    const gazetteerThemes = classifySpeechByGazetteer({ transcript: text }).topics

    try {
      return await withPayloadTransaction(payload, async ({ req }) => {
        // Fresh read inside the transaction: whatever the assessoria curated
        // (or another run catalogued) while this photo was in flight wins.
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
        if (doc.catalog?.catalogedAt) return { status: 'skipped' }

        const write = buildArchivePhotoCatalogWrite({
          suggestion,
          municipalityId,
          mentionedPeople,
          gazetteerThemes,
          curatedFields: doc.curatedFields ?? [],
          // Depth 0: the relationship is the id even when the generated type
          // still allows the populated shape.
          currentCatalog: doc.catalog
            ? {
                ...doc.catalog,
                municipality:
                  typeof doc.catalog.municipality === 'number' ? doc.catalog.municipality : null,
              }
            : null,
          currentAlt: doc.alt,
          catalogedAt: new Date().toISOString(),
        })

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
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
