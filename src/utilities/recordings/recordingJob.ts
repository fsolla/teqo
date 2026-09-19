import 'server-only'

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import {
  RECORDING_FAILURE_INTERRUPTED,
  RECORDING_MEDIA_SLUG,
  type RecordingStep,
} from '@/lib/recording'
import {
  buildRecordingAudioFfmpegArgs,
  mergeChunkTranscriptions,
  RECORDING_AUDIO_CHUNK_SECONDS,
  recordingSearchText,
} from '@/lib/recordingTranscription'
import type { Recording } from '@/payload-types'
import {
  deepInfraTranscribeSegments,
  type TranscribeSegmentsResult,
} from '@/utilities/ai/deepInfraTranscribe'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { messageOf, runFfmpeg } from '@/utilities/media/ffmpeg'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { downloadPrivateMediaToFile } from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C199 — the transcription job: download the private recording, extract/split
 * the audio with ffmpeg, transcribe each chunk with timestamps and persist the
 * merged transcript (the `ready` state). Runs after the upload response
 * (`recordingScheduler`) so no request waits on hours of audio; every failure
 * leaves the row `failed` with the file preserved and the retry reuses the row.
 */

/** A recording stopped mid-flight (deploy/restart) is reaped to `failed` after this. */
export const RECORDING_STALE_MS = 60 * 60_000

/** Audio extraction has no duration to scale the timeout from; 30 min is ample. */
const RECORDING_FFMPEG_TIMEOUT_MS = 30 * 60_000

const FAILURE_FALLBACK = 'Falha ao transcrever a gravação.'
const NO_AUDIO_MESSAGE = 'Não foi possível extrair o áudio da gravação.'

type ChunkTranscriber = (
  file: Blob,
  options?: { filename?: string; timeoutMs?: number },
) => Promise<TranscribeSegmentsResult>

// The job runs after the upload response, with no request actor: every write
// below is an intentional admin bypass, justified because the row was created
// behind the acervo gate and the pipeline owns its state.

const loadRecordingSystem = (payload: Payload, recordingId: number) =>
  payload.findByID({
    collection: 'recording',
    id: recordingId,
    depth: 1,
    // Intentional admin bypass: the job reads the row it owns.
    overrideAccess: true,
  })

const updateRecordingSystem = (
  payload: Payload,
  recordingId: number,
  data: Partial<Recording>,
  req?: PayloadTransactionRequest,
) =>
  payload.update({
    collection: 'recording',
    id: recordingId,
    data,
    // Intentional admin bypass: the pipeline owns the row state.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

/**
 * Fails the row and keeps the step it died on: the detail maps the step and the
 * known literals into the honest message, while `error` keeps the raw detail
 * for the admin.
 */
const failRecording = (
  payload: Payload,
  recordingId: number,
  message: string,
  step: RecordingStep | null = 'extracting',
): Promise<unknown> =>
  updateRecordingSystem(payload, recordingId, { status: 'failed', step, error: message })

const staticDirOf = (payload: Payload): string => {
  const upload = payload.collections[RECORDING_MEDIA_SLUG].config.upload
  return upload && typeof upload === 'object' && upload.staticDir
    ? upload.staticDir
    : RECORDING_MEDIA_SLUG
}

const chunkFilesIn = async (tempDir: string): Promise<string[]> => {
  const entries = await readdir(tempDir)
  return entries.filter((name) => /^chunk-\d+\.mp3$/.test(name)).sort()
}

/**
 * The whole pipeline of one recording. Never throws: an orphan job (server
 * restart) is covered by the lazy reaper, and any error marks the row `failed`
 * so the retry reuses it.
 */
export const runRecordingJob = async (
  payload: Payload,
  recordingId: number,
  transcribe: ChunkTranscriber = deepInfraTranscribeSegments,
): Promise<void> => {
  let tempDir: string | null = null
  let currentStep: RecordingStep = 'extracting'
  const markStep = async (step: RecordingStep): Promise<void> => {
    currentStep = step
    await updateRecordingSystem(payload, recordingId, { step })
  }

  try {
    const recording = await loadRecordingSystem(payload, recordingId)
    if (recording.status !== 'processing') return

    const media =
      typeof recording.media === 'object' && recording.media !== null ? recording.media : null
    if (!media?.filename) {
      await failRecording(payload, recordingId, NO_AUDIO_MESSAGE, 'extracting')
      return
    }

    await markStep('extracting')
    tempDir = await mkdtemp(join(tmpdir(), 'recording-'))
    const inputPath = join(tempDir, 'source')
    const outputPattern = join(tempDir, 'chunk-%03d.mp3')

    await downloadPrivateMediaToFile({
      media,
      staticDir: staticDirOf(payload),
      destinationPath: inputPath,
    })
    await runFfmpeg(
      buildRecordingAudioFfmpegArgs({ inputPath, outputPattern }),
      RECORDING_AUDIO_CHUNK_SECONDS,
      NO_AUDIO_MESSAGE,
      RECORDING_FFMPEG_TIMEOUT_MS,
    )

    const chunkFiles = await chunkFilesIn(tempDir)
    if (chunkFiles.length === 0) {
      await failRecording(payload, recordingId, NO_AUDIO_MESSAGE, 'extracting')
      return
    }

    await markStep('transcribing')
    const chunks: {
      offsetSeconds: number
      segments: { start: number; end: number; text: string }[]
    }[] = []
    let durationSeconds = 0
    for (const [index, chunkFile] of chunkFiles.entries()) {
      const bytes = await readFile(join(tempDir, chunkFile))
      const result = await transcribe(new Blob([bytes], { type: 'audio/mpeg' }), {
        filename: chunkFile,
      })
      if (!result.ok) {
        await failRecording(payload, recordingId, result.error, 'transcribing')
        return
      }
      chunks.push({
        offsetSeconds: index * RECORDING_AUDIO_CHUNK_SECONDS,
        segments: result.segments,
      })
      // Only what the provider measured: a guessed duration would make the
      // detail label lie.
      if (result.durationSeconds !== null) durationSeconds += result.durationSeconds
      // Heartbeat: a chunk takes minutes; the updatedAt keeps the reaper away.
      await updateRecordingSystem(payload, recordingId, { step: 'transcribing' })
    }

    const segments = mergeChunkTranscriptions(chunks)
    if (segments.length === 0) {
      await failRecording(payload, recordingId, FAILURE_FALLBACK, 'transcribing')
      return
    }

    await markStep('saving')
    await withPayloadTransaction(payload, async ({ req }) => {
      await payload.delete({
        collection: 'recordingSegment',
        where: { recording: { equals: recordingId } },
        req,
        // Intentional admin bypass: replacing segments owned by the recording.
        overrideAccess: true,
      })
      for (const segment of segments) {
        await payload.create({
          collection: 'recordingSegment',
          // `searchText` is filled by the collection's own beforeValidate hook.
          data: hookFilledCreateData<'recordingSegment'>({
            recording: recordingId,
            order: segment.order + 1,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            text: segment.text,
          }),
          req,
          // Intentional admin bypass: the transcript belongs to the recording row.
          overrideAccess: true,
        })
      }
      await updateRecordingSystem(
        payload,
        recordingId,
        {
          status: 'ready',
          step: null,
          error: null,
          durationSeconds: Math.round(durationSeconds),
          searchText: recordingSearchText(segments),
        },
        req,
      )
    })
  } catch (error) {
    await failRecording(
      payload,
      recordingId,
      messageOf(error, FAILURE_FALLBACK),
      currentStep,
    ).catch(() => undefined)
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Lazy reaper: a row untouched for `RECORDING_STALE_MS` was lost to a restart
 * (there is no queue to ask). A stale `processing` row becomes `failed` with the
 * interruption copy; a stale `uploading` row never stored a usable file, so it
 * is removed — the same outcome as the upload path's own cleanup. The
 * conditional `where` never clobbers a job that just finished — intentional
 * admin bypass, like the other system writes above.
 */
export const reapStaleRecording = async (
  payload: Payload,
  recording: { id: number; status: string; updatedAt: string },
): Promise<boolean> => {
  if (recording.status !== 'processing' && recording.status !== 'uploading') return false
  const updatedAt = Date.parse(recording.updatedAt)
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < RECORDING_STALE_MS) return false

  if (recording.status === 'uploading') {
    const deleted = await payload.delete({
      collection: 'recording',
      where: { and: [{ id: { equals: recording.id } }, { status: { equals: 'uploading' } }] },
      // Intentional admin bypass: the reaper repairs a row the system owns.
      overrideAccess: true,
    })
    return deleted.docs.length > 0
  }

  const result = await payload.update({
    collection: 'recording',
    where: { and: [{ id: { equals: recording.id } }, { status: { equals: 'processing' } }] },
    data: { status: 'failed', step: null, error: RECORDING_FAILURE_INTERRUPTED },
    // Intentional admin bypass: the reaper repairs a row the system owns.
    overrideAccess: true,
  })
  return result.docs.length > 0
}
