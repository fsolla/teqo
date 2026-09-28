import 'server-only'

import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import {
  RECORDING_MEDIA_SLUG,
  RECORDING_UPLOAD_CHUNK_BYTES,
  sanitizeRecordingFilename,
} from '@/lib/recording'
import {
  RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE,
  RECORDING_CHUNK_TOO_LARGE_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_UPLOAD_NOT_IN_PROGRESS_MESSAGE,
  RECORDING_UPLOAD_SESSION_LOST_MESSAGE,
  RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE,
  type RecordingUploadMetadata,
} from '@/lib/schemas/recording'
import type { CampaignUser } from '@/payload-types'
import { deleteLargeMedia, uploadLargeMedia } from '@/utilities/media/largeS3Upload'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { createPrivateMediaFromFile } from '@/utilities/privateMedia/privateMediaUpload'
import { startRecordingJobInBackground } from '@/utilities/recordings/recordingScheduler'
import {
  assertRecordingUploadDiskRoom,
  createRecordingUploadSession,
  readRecordingUploadSession,
  recordingUploadFilePath,
  recordingUploadPlaceholderPath,
  removeRecordingUploadSession,
  type RecordingUploadSession,
} from '@/utilities/recordings/recordingUploadSession'

/**
 * C199-fix — the upload half of the recordings flow, now chunked. The dialog
 * starts a session (row `uploading` + temp dir), then POSTs the file in parts
 * of `RECORDING_UPLOAD_CHUNK_BYTES`: production is behind the Cloudflare
 * Tunnel, whose edge refuses any single request body above ~100 MB with a 413
 * before the app sees it, so a multi-GB recording MUST travel in parts. Each
 * part is appended in strict order, finalize happens only when the received
 * bytes match the size declared at start, and the private media + job are the
 * same C199/C199-large flow as before.
 *
 * The route owns the origin/session/role gate; this module owns the write path.
 * Any failed part aborts the session (row and temp dir), so a broken upload
 * never lingers as a phantom "Enviando".
 */

/** Shared literal: the route allowlists it and the missing body throws it. */
export const RECORDING_BODY_MISSING_MESSAGE = 'A requisição não trouxe o arquivo da gravação.'

const deleteUploadingRow = async (payload: Payload, recordingId: number): Promise<void> => {
  await payload
    .delete({
      collection: 'recording',
      where: { and: [{ id: { equals: recordingId } }, { status: { equals: 'uploading' } }] },
      // Intentional admin bypass: cleanup of the session this module owns. The
      // conditional `where` never deletes a row another actor already finalized.
      overrideAccess: true,
    })
    .catch(() => undefined)
}

/**
 * Removes the row (only while it is still `uploading`) and the temp dir; the
 * same outcome as a failed single-shot upload. Order matters on purpose: a
 * concurrent finalize keeps its row until it commits, so the dir is only
 * discarded after the conditional delete had a chance to lose that race.
 */
export const abortRecordingUpload = async (
  payload: Payload,
  recordingId: number,
): Promise<void> => {
  await deleteUploadingRow(payload, recordingId)
  await removeRecordingUploadSession(recordingId)
}

/**
 * Creates the visible row the chunk route will grow and the on-disk session.
 * A failure while creating the session removes the row: an aborted start never
 * leaves a phantom "Enviando".
 */
export const startRecordingUpload = async ({
  payload,
  actor,
  metadata,
}: {
  payload: Payload
  actor: CampaignUser
  metadata: RecordingUploadMetadata
}): Promise<{ id: number }> => {
  // Fail before any write when the disk cannot hold the declared file: the
  // user learns it in seconds, not after hours of transfer.
  await assertRecordingUploadDiskRoom(metadata.size)

  const recording = await payload.create({
    collection: 'recording',
    data: {
      title: metadata.title,
      status: 'uploading',
      ...(metadata.recordedAt ? { recordedAt: metadata.recordedAt } : {}),
    },
    depth: 0,
    user: actor,
    overrideAccess: false,
  })

  try {
    await createRecordingUploadSession(recording.id, {
      uploadName: sanitizeRecordingFilename(metadata.filename),
      expectedBytes: metadata.size,
    })
  } catch (error) {
    // A half-created session (dir without the empty file, or without the
    // state) is unreachable by every other cleanup path: the row is gone and
    // the reaper only looks at rows.
    await abortRecordingUpload(payload, recording.id)
    throw error
  }
  return { id: recording.id }
}

/**
 * Appends one chunk to the session file with backpressure, refusing a request
 * that carries more than one chunk or that would cross the declared size.
 * There is no product ceiling (the upload accepts hours of plenary): the
 * container disk and the S3 multipart limit are the bounds.
 */
const appendChunkToFile = async ({
  body,
  destination,
  initialBytes,
  expectedBytes,
  chunkSize,
}: {
  body: ReadableStream<Uint8Array>
  destination: string
  initialBytes: number
  expectedBytes: number
  chunkSize: number
}): Promise<number> => {
  let received = initialBytes
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received - initialBytes > chunkSize) {
        callback(new Error(RECORDING_CHUNK_TOO_LARGE_MESSAGE))
        return
      }
      if (received > expectedBytes) {
        callback(new Error(RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE))
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination, { flags: 'a' }),
  )
  return received
}

/** Keeps `updatedAt` fresh while a multi-hour upload streams part by part. */
const heartbeatRecordingUpload = (
  payload: Payload,
  actor: CampaignUser,
  recordingId: number,
): Promise<unknown> =>
  payload.update({
    collection: 'recording',
    id: recordingId,
    data: { status: 'uploading' },
    depth: 0,
    user: actor,
    overrideAccess: false,
  })

/**
 * Stores the private media of a complete session and hands the row to the job.
 * A rolled-back transaction leaves the multipart object (when the large path
 * ran) with no row owning it, so it is removed too; the session dir goes away
 * with the outer abort.
 */
const finalizeRecordingUpload = async ({
  payload,
  actor,
  recordingId,
  title,
  session,
  startJob,
  largeThresholdBytes,
  uploadLarge,
  removeLarge,
}: {
  payload: Payload
  actor: CampaignUser
  recordingId: number
  title: string
  session: RecordingUploadSession
  startJob: (recordingId: number) => void
  largeThresholdBytes?: number
  uploadLarge?: typeof uploadLargeMedia
  removeLarge?: typeof deleteLargeMedia
}): Promise<void> => {
  const mediaCleanup: { current?: () => Promise<void> } = {}
  try {
    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await createPrivateMediaFromFile({
        inputPath: recordingUploadFilePath(recordingId, session.uploadName),
        // Same basename as the upload: the stored name (and the download) keeps
        // the original file name even on the multipart path.
        placeholderPath: recordingUploadPlaceholderPath(recordingId, session.uploadName),
        thresholdBytes: largeThresholdBytes,
        // No product ceiling for recordings; disk is the bound.
        maxBytes: Number.POSITIVE_INFINITY,
        uploadLarge,
        removeLarge,
        create: (filePath) =>
          payload.create({
            collection: RECORDING_MEDIA_SLUG,
            data: { alt: title },
            filePath,
            depth: 0,
            user: actor,
            overrideAccess: false,
            req,
          }),
        update: (id, data) =>
          payload.update({
            collection: RECORDING_MEDIA_SLUG,
            id,
            data,
            depth: 0,
            user: actor,
            overrideAccess: false,
            req,
          }),
      })
      mediaCleanup.current = media.cleanup

      await payload.update({
        collection: 'recording',
        id: recordingId,
        data: { status: 'processing', step: 'extracting', media: media.id },
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
    })
    // Committed: the multipart object is the recording's media now.
    mediaCleanup.current = undefined

    startJob(recordingId)
  } catch (error) {
    await mediaCleanup.current?.().catch(() => undefined)
    throw error
  }
}

/**
 * Receives one part of an in-flight upload. The index must be exactly the next
 * part (`floor(receivedBytes / chunkSize)`), so a duplicated or out-of-order
 * part is refused instead of corrupting the file; a chunk that completes the
 * declared size finalizes the media in the same request.
 */
export const receiveRecordingChunk = async ({
  payload,
  actor,
  recordingId,
  index,
  body,
  startJob = startRecordingJobInBackground,
  largeThresholdBytes,
  chunkSize = RECORDING_UPLOAD_CHUNK_BYTES,
  uploadLarge,
  removeLarge,
}: {
  payload: Payload
  actor: CampaignUser
  recordingId: number
  index: number
  body: ReadableStream<Uint8Array> | null
  /** Injectable for tests; the route uses the `after()`-based default. */
  startJob?: (recordingId: number) => void
  /** Test seams; the production defaults live in the private-media owner. */
  largeThresholdBytes?: number
  /** Part size the index math and the per-request guard agree on. */
  chunkSize?: number
  uploadLarge?: typeof uploadLargeMedia
  removeLarge?: typeof deleteLargeMedia
}): Promise<{ done: boolean }> => {
  if (!body) throw new Error(RECORDING_BODY_MISSING_MESSAGE)

  const row = (
    await payload.find({
      collection: 'recording',
      where: { id: { equals: recordingId } },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { status: true, title: true },
      user: actor,
      overrideAccess: false,
    })
  ).docs[0]
  if (!row) throw new Error(RECORDING_NOT_FOUND_MESSAGE)
  if (row.status !== 'uploading') throw new Error(RECORDING_UPLOAD_NOT_IN_PROGRESS_MESSAGE)

  const session = await readRecordingUploadSession(recordingId)
  if (!session) {
    await abortRecordingUpload(payload, recordingId)
    throw new Error(RECORDING_UPLOAD_SESSION_LOST_MESSAGE)
  }

  const destination = recordingUploadFilePath(recordingId, session.uploadName)
  let receivedBefore: number
  try {
    receivedBefore = (await stat(destination)).size
  } catch {
    await abortRecordingUpload(payload, recordingId)
    throw new Error(RECORDING_UPLOAD_SESSION_LOST_MESSAGE)
  }

  if (index !== Math.floor(receivedBefore / chunkSize)) {
    await abortRecordingUpload(payload, recordingId)
    throw new Error(RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE)
  }

  try {
    const received = await appendChunkToFile({
      body,
      destination,
      initialBytes: receivedBefore,
      expectedBytes: session.expectedBytes,
      chunkSize,
    })

    if (received < session.expectedBytes) {
      await heartbeatRecordingUpload(payload, actor, recordingId)
      return { done: false }
    }

    await finalizeRecordingUpload({
      payload,
      actor,
      recordingId,
      title: row.title ?? `Gravação ${recordingId}`,
      session,
      startJob,
      largeThresholdBytes,
      uploadLarge,
      removeLarge,
    })
    // The session file was fully consumed and committed: the temp copy never
    // outlives the request that completed it.
    await removeRecordingUploadSession(recordingId)
    return { done: true }
  } catch (error) {
    await abortRecordingUpload(payload, recordingId)
    throw error
  }
}
