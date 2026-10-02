import 'server-only'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { FACE_SEARCH_MODEL, readFaceVector } from '@/lib/faceSearch'
import { messageOf } from '@/utilities/media/ffmpeg'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  downloadPrivateMediaToFile,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C242 — the batch owner of the anonymous face index (`pnpm faces:index`). For
 * every approved photo it downloads the private original, prepares a small RGB
 * image and asks the INJECTED analyzer (the same face-api engine the browser
 * runs) for the descriptors of every face; the descriptors are PERSISTED as
 * identity-free rows in `archivePhotoFace` (scope B, decision of 2026-10-01:
 * any visitor can find themselves). One photo's rows are replaced atomically —
 * never merged with a previous revision.
 *
 * Skipping is honest by construction: the photo's `faces.checkedKey` records
 * the model that produced the stored descriptors, so a model change marks every
 * photo stale and the next run recomputes. The batch's own writes never change
 * the key (`context.faceIndex` skips the catalog derivation and the marker
 * write does not read it back).
 *
 * A failure of one photo is returned, never thrown: nothing is written, the
 * next run retries it and the receipt names the stage.
 */

/** Long edge sent to the engine; the original never leaves the archive. */
const IMAGE_MAX_EDGE = 1024

export type ArchivePhotoFaceImage = {
  pixels: Buffer
  width: number
  height: number
}

/** The engine seam: `src/` never imports `scripts/`; the CLI injects it. */
export type ArchivePhotoFaceAnalyzer = (image: ArchivePhotoFaceImage) => Promise<number[][]>

/**
 * Decodes any stored image (EXIF-rotated, alpha flattened, ≤1024px raw RGB) —
 * the exact input both the batch, the C244 figure enrollment and the browser
 * compute descriptors over, so every vector enters the same space.
 */
export const prepareFaceImage = async (filePath: string): Promise<ArchivePhotoFaceImage> => {
  const prepared = await sharp(filePath)
    .rotate()
    .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return { pixels: prepared.data, width: prepared.info.width, height: prepared.info.height }
}

export type ArchivePhotoFaceIndexItem = {
  id: number
  filename: string | null
  checkedKey: string | null
}

export type ArchivePhotoFaceIndexQueue = {
  /** The revision every processed photo is stamped with. */
  indexKey: string
  totalApproved: number
  /** Approved photos whose `faces.checkedKey` is not the current revision. */
  stale: number
  /** The work list (newest first); capped by `limit` when asked. */
  items: ArchivePhotoFaceIndexItem[]
}

export type ArchivePhotoFaceIndexResult =
  | { status: 'indexed'; descriptorCount: number }
  | {
      status: 'failed'
      stage: 'download' | 'image' | 'analyze' | 'write'
      error: string
    }

/**
 * The batch queue: the approved photos with their marker and the revision to
 * stamp. `refresh` ignores the marker; `limit` caps only the returned work list
 * (the counts stay true).
 */
export const listArchivePhotoFaceIndexQueue = async ({
  payload,
  refresh = false,
  limit,
}: {
  payload: Payload
  refresh?: boolean
  limit?: number
}): Promise<ArchivePhotoFaceIndexQueue> => {
  const indexKey = FACE_SEARCH_MODEL

  const photos = await payload.find({
    collection: ARCHIVE_PHOTO_SLUG,
    where: { publicationStatus: { equals: 'approved' } },
    sort: ['-takenOn', '-id'],
    depth: 0,
    limit: 0,
    pagination: false,
    select: { filename: true, faces: true },
    // Intentional bypass: the batch CLI is a trusted operator with no session.
    overrideAccess: true,
  })

  const rows: ArchivePhotoFaceIndexItem[] = photos.docs.map((doc) => ({
    id: doc.id,
    filename: doc.filename ?? null,
    checkedKey: doc.faces?.checkedKey ?? null,
  }))
  const staleRows = refresh ? rows : rows.filter((row) => row.checkedKey !== indexKey)

  return {
    indexKey,
    totalApproved: photos.docs.length,
    stale: staleRows.length,
    items: limit && limit > 0 ? staleRows.slice(0, limit) : staleRows,
  }
}

/**
 * One photo: download → prepare → analyze → transactional descriptor replace +
 * marker. The rows of the previous revision are deleted inside the same
 * transaction, so a query never sees a half-replaced photo.
 */
export const indexArchivePhotoFaces = async ({
  payload,
  item,
  indexKey,
  analyze,
}: {
  payload: Payload
  item: ArchivePhotoFaceIndexItem
  indexKey: string
  analyze: ArchivePhotoFaceAnalyzer
}): Promise<ArchivePhotoFaceIndexResult> => {
  if (!item.filename) {
    return { status: 'failed', stage: 'download', error: 'Foto sem arquivo armazenado.' }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'teqo-face-index-'))
  const imagePath = join(tempDir, 'original')

  try {
    try {
      await downloadPrivateMediaToFile({
        media: { filename: item.filename },
        staticDir: resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG),
        destinationPath: imagePath,
      })
    } catch (error) {
      return { status: 'failed', stage: 'download', error: messageOf(error, 'erro desconhecido') }
    }

    let image: ArchivePhotoFaceImage
    try {
      image = await prepareFaceImage(imagePath)
    } catch (error) {
      return { status: 'failed', stage: 'image', error: messageOf(error, 'erro desconhecido') }
    }

    let descriptors: number[][]
    try {
      descriptors = await analyze(image)
    } catch (error) {
      return { status: 'failed', stage: 'analyze', error: messageOf(error, 'erro desconhecido') }
    }

    try {
      const descriptorCount = await writeArchivePhotoFaceDescriptors({
        payload,
        photoId: item.id,
        descriptors,
        indexKey,
      })
      return { status: 'indexed', descriptorCount }
    } catch (error) {
      return { status: 'failed', stage: 'write', error: messageOf(error, 'erro desconhecido') }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Replaces the descriptor rows of one photo and stamps the marker — one
 * transaction, so a concurrent takedown or search never meets a half-written
 * photo. Invalid descriptors are dropped (fail-closed) instead of poisoning the
 * index.
 */
export const writeArchivePhotoFaceDescriptors = async ({
  payload,
  photoId,
  descriptors,
  indexKey,
}: {
  payload: Payload
  photoId: number
  descriptors: readonly number[][]
  indexKey: string
}): Promise<number> => {
  const vectors = descriptors
    .map((descriptor) => readFaceVector(descriptor))
    .filter((vector): vector is number[] => vector !== null)

  const write = async (writeReq?: { transactionID?: number | string }) => {
    await payload.delete({
      collection: 'archivePhotoFace',
      where: { photo: { equals: photoId } },
      depth: 0,
      req: writeReq,
      // Intentional bypass: the batch CLI is a trusted operator with no session.
      overrideAccess: true,
    })

    for (const vector of vectors) {
      await payload.create({
        collection: 'archivePhotoFace',
        data: {
          photo: photoId,
          model: indexKey,
          detectedAt: new Date().toISOString(),
          vector,
        },
        depth: 0,
        req: writeReq,
        // Intentional bypass: same trusted operator.
        overrideAccess: true,
      })
    }

    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photoId,
      data: { faces: { checkedAt: new Date().toISOString(), checkedKey: indexKey } },
      depth: 0,
      req: writeReq,
      context: { faceIndex: true },
      // Intentional bypass: same trusted operator.
      overrideAccess: true,
    })
  }

  return withPayloadTransaction(payload, async ({ req }) => {
    await write(req)
    return vectors.length
  })
}

/**
 * Purges every descriptor row of one photo. Called by the photo lifecycle hooks
 * when a photo stops being `approved` (unapproval/removal) and on deletion — the
 * DB-level FK cascade covers direct SQL deletes, this covers the Local API path.
 */
export const purgeFaceDescriptorsForPhoto = async ({
  payload,
  photoId,
  req,
}: {
  payload: Payload
  photoId: number
  req?: PayloadRequest
}): Promise<void> => {
  await payload.delete({
    collection: 'archivePhotoFace',
    where: { photo: { equals: photoId } },
    depth: 0,
    req,
    // Intentional bypass: lifecycle maintenance, never an actor-bound write.
    overrideAccess: true,
  })
}
