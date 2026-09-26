import 'server-only'

import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import { RECORDING_MEDIA_SLUG, sanitizeRecordingFilename } from '@/lib/recording'
import type { RecordingUploadMetadata } from '@/lib/schemas/recording'
import type { CampaignUser } from '@/payload-types'
import { deleteLargeMedia, uploadLargeMedia } from '@/utilities/media/largeS3Upload'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { createPrivateMediaFromFile } from '@/utilities/privateMedia/privateMediaUpload'
import { startRecordingJobInBackground } from '@/utilities/recordings/recordingScheduler'

/**
 * C199 — the upload half of the recordings flow: create the visible row, stream
 * the raw request body to a temp file, then store the private media (multipart
 * above the Payload buffer boundary, see `privateMediaUpload`) and hand the row
 * to the transcription job. The route owns the origin/session/role gate; this
 * module owns the write path.
 */

/** Shared literal: the route allowlists it and the missing body throws it. */
export const RECORDING_BODY_MISSING_MESSAGE = 'A requisição não trouxe o arquivo da gravação.'

/**
 * Streams the request body to `destination` with backpressure. There is no
 * product ceiling (the upload accepts hours of plenary): the container disk and
 * the S3 multipart limit are the bounds.
 */
const streamBodyToFile = async ({
  body,
  destination,
}: {
  body: ReadableStream<Uint8Array>
  destination: string
}): Promise<void> => {
  await pipeline(
    Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
    createWriteStream(destination),
  )
}

export const receiveRecordingUpload = async ({
  payload,
  actor,
  metadata,
  body,
  startJob = startRecordingJobInBackground,
  largeThresholdBytes,
  uploadLarge,
  removeLarge,
}: {
  payload: Payload
  actor: CampaignUser
  metadata: RecordingUploadMetadata
  body: ReadableStream<Uint8Array> | null
  /** Injectable for tests; the route uses the `after()`-based default. */
  startJob?: (recordingId: number) => void
  /** Test seams; the production defaults live in the private-media owner. */
  largeThresholdBytes?: number
  uploadLarge?: typeof uploadLargeMedia
  removeLarge?: typeof deleteLargeMedia
}): Promise<{ id: number }> => {
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
  const mediaCleanup: { current?: () => Promise<void> } = {}
  try {
    const uploadDir = await mkdtemp(join(tmpdir(), 'recording-upload-'))
    tempDir = uploadDir
    const uploadName = sanitizeRecordingFilename(metadata.filename)
    const tempPath = join(uploadDir, uploadName)
    await streamBodyToFile({ body, destination: tempPath })

    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await createPrivateMediaFromFile({
        inputPath: tempPath,
        // Same basename as the upload: the stored name (and the download) keeps
        // the original file name even on the multipart path.
        placeholderPath: join(uploadDir, 'placeholder', uploadName),
        thresholdBytes: largeThresholdBytes,
        // No product ceiling for recordings; disk is the bound.
        maxBytes: Number.POSITIVE_INFINITY,
        uploadLarge,
        removeLarge,
        create: (filePath) =>
          payload.create({
            collection: RECORDING_MEDIA_SLUG,
            data: { alt: metadata.title },
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
        id: recording.id,
        data: { status: 'processing', step: 'extracting', media: media.id },
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
    })
    // Committed: the multipart object is the recording's media now.
    mediaCleanup.current = undefined

    startJob(recording.id)
    return { id: recording.id }
  } catch (error) {
    // The upload never completed: the row must not linger as a phantom
    // "Enviando". A rolled-back transaction leaves the multipart object (when
    // the large path ran) with no row owning it, so it is removed too.
    await mediaCleanup.current?.().catch(() => undefined)
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
