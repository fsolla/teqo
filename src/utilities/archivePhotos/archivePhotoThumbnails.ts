import 'server-only'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { ARCHIVE_PHOTO_THUMB_WIDTH } from '@/lib/archivePhotoPublicCatalog'
import {
  ARCHIVE_PHOTO_GRADE_MIME_TYPE,
  ARCHIVE_PHOTO_GRADE_QUALITY,
  archivePhotoGradeFilename,
} from '@/lib/archivePhotoThumbnail'
import { isPrivateMediaMissingError } from '@/lib/privateMedia'
import { messageOf } from '@/utilities/media/ffmpeg'
import {
  downloadPrivateMediaToFile,
  encodePrivateImageFile,
  privateMediaObjectExists,
  resolvePrivateMediaStaticDir,
  writePrivateObject,
} from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C248 — the stored grade thumbnail of an archive photo: the 720px AVIF q60
 * the public grid serves when it exists. The route tries the deterministic
 * sibling key first; on a miss it answers the on-the-fly JPEG and calls
 * `ensureArchivePhotoGrade` in `after()`, so the next request hits the stored
 * derivative. The collection hook warms the same path when a photo is approved
 * and the backfill CLI covers the pre-existing archive.
 *
 * Nothing here touches the database or the original: the grade is a cache
 * entry in the same private store, discovered by exact key. Every failure is
 * classified and never thrown — the fallback is the product promise, so a
 * broken original or an unreachable store can only mean "skip", never a 500.
 */

/** Concurrent generations per process: a grid miss can ask for several at once. */
const MAX_CONCURRENT_GENERATIONS = 2

/** A failure is not retried on every view (the molde of C226). */
const FAILURE_TTL_MS = 5 * 60_000

const GENERATION_FAILURE_FALLBACK = 'Falha ao gerar a miniatura da foto.'

/** What one generation pass can produce (the CLI receipt vocabulary). */
export type ArchivePhotoGradeGeneration =
  | { status: 'generated'; filename: string; bytes: number }
  | {
      status: 'skipped'
      reason: 'no-filename' | 'missing-origin' | 'corrupt-origin'
      detail?: string
    }
  | { status: 'failed'; reason: string }

/** Add the probe/failure-memo results only `ensureArchivePhotoGrade` produces. */
export type ArchivePhotoGradeOutcome =
  | ArchivePhotoGradeGeneration
  | { status: 'skipped'; reason: 'already-present' | 'recent-failure' }

// Process-wide state (same shape as the C226 frame job): the in-memory slot
// gate keeps one Node server from stampeding sharp, the in-flight map
// deduplicates concurrent requests for the same photo and the failure memo
// stops one bad original from being re-decoded on every view.
let activeGenerations = 0
const waiting: Array<() => void> = []
const inFlight = new Map<string, Promise<ArchivePhotoGradeOutcome>>()
const failures = new Map<string, number>()

const rememberFailure = (gradeFilename: string): void => {
  const now = Date.now()
  for (const [key, at] of failures) {
    if (now - at >= FAILURE_TTL_MS) failures.delete(key)
  }
  failures.set(gradeFilename, now)
}

const acquireGenerationSlot = async (): Promise<() => void> => {
  if (activeGenerations >= MAX_CONCURRENT_GENERATIONS) {
    await new Promise<void>((resolve) => waiting.push(resolve))
  } else {
    activeGenerations += 1
  }

  let released = false
  return () => {
    if (released) return
    released = true
    const next = waiting.shift()
    if (next) next()
    else activeGenerations -= 1
  }
}

/**
 * One grade, from the stored original to the sibling AVIF. The original is
 * downloaded to a caller-owned temp file first: that is what tells a missing
 * object (honest skip, the C246 vocabulary) from a corrupt one (decode
 * failure, honest skip with the reason in the receipt) from a write failure
 * (retryable). Never throws.
 */
export const generateArchivePhotoGrade = async (
  payload: Payload,
  { filename }: { filename: string | null | undefined },
): Promise<ArchivePhotoGradeGeneration> => {
  if (!filename) return { status: 'skipped', reason: 'no-filename' }

  const staticDir = resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)
  const gradeFilename = archivePhotoGradeFilename(filename)

  const release = await acquireGenerationSlot()
  let tempDir: string | null = null
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'archive-photo-grade-'))
    const sourcePath = join(tempDir, 'source')

    try {
      await downloadPrivateMediaToFile({
        media: { filename },
        staticDir,
        destinationPath: sourcePath,
      })
    } catch (error) {
      if (isPrivateMediaMissingError(error)) {
        return { status: 'skipped', reason: 'missing-origin' }
      }
      return {
        status: 'failed',
        reason: `download: ${messageOf(error, GENERATION_FAILURE_FALLBACK)}`,
      }
    }

    let image: Buffer
    try {
      image = await encodePrivateImageFile({
        inputPath: sourcePath,
        width: ARCHIVE_PHOTO_THUMB_WIDTH,
        format: 'avif',
        quality: ARCHIVE_PHOTO_GRADE_QUALITY,
      })
    } catch (error) {
      return {
        status: 'skipped',
        reason: 'corrupt-origin',
        detail: messageOf(error, GENERATION_FAILURE_FALLBACK),
      }
    }

    try {
      await writePrivateObject({
        filename: gradeFilename,
        staticDir,
        data: image,
        mimeType: ARCHIVE_PHOTO_GRADE_MIME_TYPE,
      })
    } catch (error) {
      return {
        status: 'failed',
        reason: `upload: ${messageOf(error, GENERATION_FAILURE_FALLBACK)}`,
      }
    }

    return { status: 'generated', filename: gradeFilename, bytes: image.length }
  } catch (error) {
    return { status: 'failed', reason: messageOf(error, GENERATION_FAILURE_FALLBACK) }
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
    release()
  }
}

/**
 * Returns the stored grade of a photo, generating it on a miss. The probe and
 * the generation share the in-flight map, so a grid that asks for the same
 * missing photo twice runs sharp once. Never throws: a failure degrades to the
 * route's on-the-fly fallback and is memoized for a short while.
 */
export const ensureArchivePhotoGrade = async (
  payload: Payload,
  { filename }: { filename: string | null | undefined },
): Promise<ArchivePhotoGradeOutcome> => {
  if (!filename) return { status: 'skipped', reason: 'no-filename' }

  const gradeFilename = archivePhotoGradeFilename(filename)

  const failedAt = failures.get(gradeFilename)
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_TTL_MS) {
    return { status: 'skipped', reason: 'recent-failure' }
  }

  const staticDir = resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)
  const exists = await privateMediaObjectExists({ filename: gradeFilename, staticDir }).catch(
    () => false,
  )
  if (exists) return { status: 'skipped', reason: 'already-present' }

  const running = inFlight.get(gradeFilename)
  if (running) return running

  const generation = generateArchivePhotoGrade(payload, { filename })
    .then((result) => {
      if (result.status !== 'generated') rememberFailure(gradeFilename)
      return result
    })
    .catch((error: unknown) => {
      rememberFailure(gradeFilename)
      console.warn(
        `[archive-photo-grade] ${gradeFilename}: ${messageOf(error, GENERATION_FAILURE_FALLBACK)}`,
      )
      const reason = messageOf(error, GENERATION_FAILURE_FALLBACK)
      return { status: 'failed' as const, reason }
    })
    .finally(() => {
      inFlight.delete(gradeFilename)
    })

  inFlight.set(gradeFilename, generation)
  return generation
}
