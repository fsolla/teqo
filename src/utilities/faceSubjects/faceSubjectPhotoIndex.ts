import 'server-only'

import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import {
  FACE_SEARCH_MAX_DISTANCE,
  FACE_SEARCH_MODEL,
  faceEuclideanDistance,
  readFaceVector,
} from '@/lib/faceSearch'
import {
  listFaceSubjects,
  type FaceSubjectSummary,
} from '@/utilities/faceSubjects/faceSubjectReads'
import { messageOf } from '@/utilities/media/ffmpeg'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  downloadPrivateMediaToFile,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C234 — the batch index of the selfie search (`pnpm faces:index`). For every
 * approved photo it downloads the private original, prepares a small RGB image
 * and asks the INJECTED analyzer (the same face-api engine the browser runs)
 * for the descriptors of every face. The descriptors are TRANSIENT — they are
 * compared against the enrolled subjects and thrown away; only the
 * photo↔subject links are persisted, inside one transaction per photo. That is
 * the A/C line of the gate: there is no anonymous face index anywhere.
 *
 * Skipping is honest by construction: the photo's `faces.checkedKey` records
 * the model plus the enrollment revision (`enrolledAt`) of every eligible
 * subject, so a new/updated/removed subject invalidates every photo and the
 * next run recomputes — while the batch's own writes never change the key.
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
 * the exact input both the batch and the enrollment CLI hand to the engine, so
 * the selfie and the archive enter the same space.
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
  /** Subjects the batch will look for (`active` + current model + vector). */
  eligibleSubjects: number
  totalApproved: number
  /** Approved photos whose `faces.checkedKey` is not the current revision. */
  stale: number
  /** The work list (newest first); capped by `limit` when asked. */
  items: ArchivePhotoFaceIndexItem[]
}

export type ArchivePhotoFaceIndexResult =
  | { status: 'indexed'; matchedSubjects: number[] }
  | {
      status: 'failed'
      stage: 'download' | 'image' | 'analyze' | 'write'
      error: string
    }

const isIndexableSubject = (subject: FaceSubjectSummary): boolean =>
  subject.status === 'active' &&
  subject.model === FACE_SEARCH_MODEL &&
  readFaceVector(subject.vector) !== null

/**
 * The revision stamped on each processed photo: the model plus the enrollment
 * revision of every indexable subject. Deliberately ignores `updatedAt` (the
 * batch writes `matchedPhotos`, which would bump it and make every photo stale
 * forever) and ignores removed/stale subjects (they are not searched).
 */
const facePhotoIndexKey = (subjects: readonly FaceSubjectSummary[]): string => {
  const revisions = subjects
    .filter(isIndexableSubject)
    .map((subject) => `${subject.id}:${subject.enrolledAt ?? ''}`)
    .sort()

  return createHash('sha256')
    .update([FACE_SEARCH_MODEL, ...revisions].join('\n'))
    .digest('hex')
}

/**
 * The batch queue: the approved photos with their marker, the subjects that
 * will be searched, and the revision to stamp. `refresh` ignores the marker;
 * `limit` caps only the returned work list (the counts stay true).
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
  const subjects = await listFaceSubjects(payload)
  const indexKey = facePhotoIndexKey(subjects)

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
    eligibleSubjects: subjects.filter(isIndexableSubject).length,
    totalApproved: photos.docs.length,
    stale: staleRows.length,
    items: limit && limit > 0 ? staleRows.slice(0, limit) : staleRows,
  }
}

/**
 * One photo: download → prepare → analyze → transactional link update + marker.
 * The fresh subject read happens INSIDE the transaction, so an enrollment that
 * lands mid-run is respected (the photo is simply reprocessed by the changed
 * key on a later run).
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
      const matchedSubjects = await writeArchivePhotoFaceMatches({
        payload,
        photoId: item.id,
        descriptors,
        indexKey,
      })
      return { status: 'indexed', matchedSubjects }
    } catch (error) {
      return { status: 'failed', stage: 'write', error: messageOf(error, 'erro desconhecido') }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Replaces the links of one photo for every eligible subject and stamps the
 * marker — one transaction with a fresh read, so a concurrent enrollment or
 * takedown never meets a half-written state.
 */
const writeArchivePhotoFaceMatches = async ({
  payload,
  photoId,
  descriptors,
  indexKey,
}: {
  payload: Payload
  photoId: number
  descriptors: number[][]
  indexKey: string
}): Promise<number[]> =>
  withPayloadTransaction(payload, async ({ req }) => {
    const subjects = await listFaceSubjects(payload, req)
    const matchedSubjects: number[] = []

    for (const subject of subjects) {
      if (!isIndexableSubject(subject)) continue

      const vector = readFaceVector(subject.vector)
      if (!vector) continue
      const matched = descriptors.some(
        (descriptor) => faceEuclideanDistance(descriptor, vector) < FACE_SEARCH_MAX_DISTANCE,
      )
      const linked = subject.matchedPhotoIds.includes(photoId)
      if (matched) matchedSubjects.push(subject.id)
      if (matched === linked) continue

      const next = matched
        ? [...subject.matchedPhotoIds, photoId]
        : subject.matchedPhotoIds.filter((id) => id !== photoId)
      await payload.update({
        collection: 'faceSubject',
        id: subject.id,
        data: { matchedPhotos: next },
        depth: 0,
        req,
        // Intentional bypass: the batch CLI is a trusted operator with no session.
        overrideAccess: true,
      })
    }

    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photoId,
      data: { faces: { checkedAt: new Date().toISOString(), checkedKey: indexKey } },
      depth: 0,
      req,
      context: { faceIndex: true },
      // Intentional bypass: the batch CLI is a trusted operator with no session.
      overrideAccess: true,
    })

    return matchedSubjects
  })
