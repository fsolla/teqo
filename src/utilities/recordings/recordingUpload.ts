import 'server-only'

import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import {
  RECORDING_MAX_BYTES,
  RECORDING_MEDIA_SLUG,
  recordingUploadTooLargeMessage,
  sanitizeRecordingFilename,
} from '@/lib/recording'
import type { RecordingUploadMetadata } from '@/lib/schemas/recording'
import type { CampaignUser } from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { startRecordingJobInBackground } from '@/utilities/recordings/recordingScheduler'

/**
 * C199 — the upload half of the recordings flow: create the visible row, stream
 * the raw request body to a temp file with the size ceiling enforced, then store
 * the private media and hand the row to the transcription job. The route owns
 * the origin/session/role gate; this module owns the write path.
 */

/** Shared literal: the route allowlists it and the stream guard throws it. */
export const RECORDING_BODY_MISSING_MESSAGE = 'A requisição não trouxe o arquivo da gravação.'

const toUploadTooLarge = (): Error => new Error(recordingUploadTooLargeMessage)

/**
 * Streams the request body to `destination`, enforcing the ceiling even when
 * the request arrives chunked (a missing/lying `Content-Length` cannot fill the
 * disk). Returns the received byte count.
 */
const streamBodyToFile = async ({
  body,
  destination,
  maxBytes,
}: {
  body: ReadableStream<Uint8Array>
  destination: string
  maxBytes: number
}): Promise<number> => {
  let received = 0
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        callback(toUploadTooLarge())
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination),
  )
  return received
}

export const receiveRecordingUpload = async ({
  payload,
  actor,
  metadata,
  body,
  contentLength,
  startJob = startRecordingJobInBackground,
}: {
  payload: Payload
  actor: CampaignUser
  metadata: RecordingUploadMetadata
  body: ReadableStream<Uint8Array> | null
  contentLength: number | null
  /** Injectable for tests; the route uses the `after()`-based default. */
  startJob?: (recordingId: number) => void
}): Promise<{ id: number }> => {
  if (contentLength !== null && contentLength > RECORDING_MAX_BYTES) throw toUploadTooLarge()
  if (!body) throw new Error(RECORDING_BODY_MISSING_MESSAGE)

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

  let tempDir: string | null = null
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'recording-upload-'))
    const uploadName = sanitizeRecordingFilename(metadata.filename)
    const tempPath = join(tempDir, uploadName)
    await streamBodyToFile({ body, destination: tempPath, maxBytes: RECORDING_MAX_BYTES })

    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await payload.create({
        collection: RECORDING_MEDIA_SLUG,
        data: { alt: metadata.title },
        filePath: tempPath,
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
      await payload.update({
        collection: 'recording',
        id: recording.id,
        data: { status: 'processing', step: 'extracting', media: media.id },
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
    })

    startJob(recording.id)
    return { id: recording.id }
  } catch (error) {
    // The upload never completed: the row must not linger as a phantom
    // "Enviando". The media (when it exists) is unreachable without the row.
    await payload
      .delete({
        collection: 'recording',
        id: recording.id,
        // Intentional admin bypass: cleanup of the row this module just created.
        overrideAccess: true,
      })
      .catch(() => undefined)
    throw error
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
