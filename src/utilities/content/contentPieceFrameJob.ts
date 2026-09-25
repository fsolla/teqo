import 'server-only'

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { CONTENT_MEDIA_SLUG } from '@/lib/contentPiece'
import {
  buildContentPieceFrameFfmpegArgs,
  CONTENT_PIECE_FRAME_MIME_TYPE,
  CONTENT_PIECE_FRAME_SEEK_ATTEMPTS,
  contentPieceFrameFilename,
  contentPieceFrameMediaAlt,
  contentPieceFrameSizeAllowed,
} from '@/lib/contentPieceFrame'
import type { ContentMedia } from '@/payload-types'
import { messageOf, runFfmpeg } from '@/utilities/media/ffmpeg'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  downloadPrivateMediaToFile,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C226 — the still of a content piece video: one JPEG of the archived file,
 * stored in the PRIVATE `contentMedia` under a deterministic filename. The
 * public card asks for it by piece slug; on a miss this heals the row and the
 * route answers it (or the neutral slot when the budget runs out first).
 *
 * ONE owner, two callers: the C211 job passes the local file it already has (a
 * still is then nearly free) and covers every newly ingested piece; the route
 * covers the archive published before this slice, which no job will reprocess.
 * There is no backfill, no queue and no reaper — "invalidar" does not even
 * exist, because the public projection declares the frame by ELIGIBILITY and not
 * by the existence of this row.
 *
 * Never throws and never writes the piece: a broken ffmpeg, a missing file or a
 * full bucket must leave the piece `pronto` with a neutral slot, not a failed
 * ingestion. The failure is memoized for a short while so one bad video cannot
 * be re-extracted on every view.
 */

/** Concurrent generations per process: a catalogue page asks for several at once. */
const MAX_CONCURRENT_GENERATIONS = 2

/** A failure is not retried on every view. */
const FAILURE_TTL_MS = 5 * 60_000

const FAILURE_FALLBACK = 'Falha ao gerar o frame da peça.'

/** The stored frame of a piece, or null when it was never generated. */
export const findContentPieceFrameMedia = async (
  payload: Payload,
  pieceId: number,
  req?: PayloadTransactionRequest,
): Promise<ContentMedia | null> => {
  const result = await payload.find({
    collection: CONTENT_MEDIA_SLUG,
    where: { filename: { equals: contentPieceFrameFilename(pieceId) } },
    limit: 1,
    depth: 0,
    // Intentional admin bypass: the lookup is the cache probe of a derived file.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  return result.docs[0] ?? null
}

// Process-wide state: one Node server owns the cache, so an in-memory slot gate
// and a short failure memo are enough to keep a catalogue page from stampeding
// ffmpeg.
let activeGenerations = 0
const waiting: Array<() => void> = []
const inFlight = new Map<number, Promise<ContentMedia | null>>()
const failures = new Map<number, number>()

const rememberFailure = (pieceId: number): void => {
  const now = Date.now()
  for (const [id, at] of failures) {
    if (now - at >= FAILURE_TTL_MS) failures.delete(id)
  }
  failures.set(pieceId, now)
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
 * One still, with the seek retried once at zero. A seek past the end leaves no
 * file — that is a failure, never a broken row.
 */
const extractContentPieceFrame = async ({
  inputPath,
  outputPath,
  durationSeconds,
}: {
  inputPath: string
  outputPath: string
  durationSeconds: number | null
}): Promise<void> => {
  let lastError: unknown = null

  for (const atSeconds of CONTENT_PIECE_FRAME_SEEK_ATTEMPTS) {
    try {
      await runFfmpeg(
        buildContentPieceFrameFfmpegArgs({ inputPath, outputPath, atSeconds }),
        durationSeconds ?? 0,
        FAILURE_FALLBACK,
      )
      await stat(outputPath)
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(FAILURE_FALLBACK)
}

/**
 * Everything the extraction needs, or null when the piece cannot have a still:
 * a link piece, a row with no stored file, and — on the self-heal path only —
 * a source too large to be worth a visitor's connection.
 */
type FrameSource = {
  media: { filename: string; filesize?: number | null }
  title: string
  durationSeconds: number | null
  /** The caller's own copy of the file; null makes the job download it. */
  localPath: string | null
}

const resolveFrameSource = async (
  payload: Payload,
  pieceId: number,
  localPath: string | null,
): Promise<FrameSource | null> => {
  const piece = await payload.findByID({
    collection: 'contentPiece',
    id: pieceId,
    depth: 1,
    // Intentional admin bypass: the frame is derived from a piece whose file
    // the pipeline (or the published-slug gate) already resolved.
    overrideAccess: true,
  })
  const media = piece.media
  // C211: a missing stored file can never yield a still.
  if (!media || typeof media === 'number' || !media.filename) return null
  // The heal has to download the whole file; the job path (localPath) pays none
  // of that and is therefore never capped.
  if (!localPath && !contentPieceFrameSizeAllowed(media.filesize)) return null

  return {
    media: { filename: media.filename, filesize: media.filesize },
    title: piece.title,
    durationSeconds: piece.durationSeconds ?? null,
    localPath,
  }
}

const generateContentPieceFrame = async (
  payload: Payload,
  pieceId: number,
  localPath: string | null,
): Promise<ContentMedia | null> => {
  const source = await resolveFrameSource(payload, pieceId, localPath)
  if (!source) return null

  const release = await acquireGenerationSlot()
  const tempDir = await mkdtemp(join(tmpdir(), 'content-piece-frame-'))
  try {
    // The job hands over the file it already downloaded; the route has to copy
    // it here first. Either way the still is written inside our own temp dir,
    // so the cleanup below never touches the source.
    const inputPath = source.localPath ?? join(tempDir, 'source')
    if (!source.localPath) {
      await downloadPrivateMediaToFile({
        media: source.media,
        staticDir: resolvePrivateMediaStaticDir(payload, CONTENT_MEDIA_SLUG),
        destinationPath: inputPath,
      })
    }

    const outputPath = join(tempDir, contentPieceFrameFilename(pieceId))
    await extractContentPieceFrame({
      inputPath,
      outputPath,
      durationSeconds: source.durationSeconds,
    })

    return await withPayloadTransaction(payload, async ({ req }) => {
      await acquireTextAdvisoryLocks(payload, req, [`content-piece-frame:${pieceId}`])
      const existing = await findContentPieceFrameMedia(payload, pieceId, req)
      if (existing) return existing

      // Uploaded from the buffer, not from `filePath`: Payload derives no MIME
      // from a local path, and a derived row with no `mimeType` would degrade
      // to `application/octet-stream` and force a DOWNLOAD instead of rendering
      // as the image the card asked for. A 640px still is a few dozen kB.
      const bytes = await readFile(outputPath)
      return await payload.create({
        collection: CONTENT_MEDIA_SLUG,
        data: { alt: contentPieceFrameMediaAlt(source.title) },
        file: {
          data: bytes,
          mimetype: CONTENT_PIECE_FRAME_MIME_TYPE,
          name: contentPieceFrameFilename(pieceId),
          size: bytes.length,
        },
        // Intentional admin bypass: the stored file is the piece's cache entry.
        overrideAccess: true,
        req,
      })
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    release()
  }
}

/**
 * Returns the stored still of a piece video, generating it on the first miss.
 * `localPath` is the job's own temp copy of the file (a free extraction); the
 * route omits it and the job's file is downloaded to a temp dir instead.
 *
 * Never throws: a failure degrades to the card's neutral slot and is memoized
 * for a short while. Never writes the piece — a frame is a cache entry, not
 * part of the ingestion result.
 */
export const ensureContentPieceFrame = async (
  payload: Payload,
  pieceId: number,
  { localPath = null }: { localPath?: string | null } = {},
): Promise<ContentMedia | null> => {
  if (!Number.isInteger(pieceId) || pieceId <= 0) return null

  const failedAt = failures.get(pieceId)
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_TTL_MS) return null

  // The probe lives inside the same guard as the generation: a database hiccup
  // is a missing frame (the card's neutral slot), never a 500 on a public route.
  const cached = await findContentPieceFrameMedia(payload, pieceId).catch(() => null)
  if (cached) return cached

  const running = inFlight.get(pieceId)
  if (running) return running

  const generation = generateContentPieceFrame(payload, pieceId, localPath)
    .then((media) => {
      if (!media) rememberFailure(pieceId)
      return media
    })
    .catch((error: unknown) => {
      rememberFailure(pieceId)
      console.warn(`[content-piece-frame] peça ${pieceId}: ${messageOf(error, FAILURE_FALLBACK)}`)
      return null
    })
    .finally(() => {
      inFlight.delete(pieceId)
    })

  inFlight.set(pieceId, generation)
  return generation
}
