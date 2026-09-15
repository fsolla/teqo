import 'server-only'

import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import { formatSpeechDate } from '@/lib/speechClock'
import {
  buildSpeechCutFallbackMetadata,
  buildSpeechCutFfmpegArgs,
  type SpeechCutStep,
} from '@/lib/speechCut'
import { CAMARA_USER_AGENT, speechVodCoordinates } from '@/lib/speechVod'
import type { SpeechCut } from '@/payload-types'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { resolveSpeechVod } from '@/utilities/speech/speechVodResolver'

/**
 * C167 — the cut job: resolve the Câmara VOD, cut the exact [start, end] with
 * ffmpeg, store the MP4 as `media` and publish the `speechCut` row. Runs after
 * the create response (`speechCutScheduler`) so no request waits on ffmpeg;
 * every failure leaves the row `failed` and nothing published.
 */

/** `FFMPEG_PATH` lets a test/runtime point at a fake binary; the image ships `ffmpeg`. */
const ffmpegBinary = (): string => process.env.FFMPEG_PATH?.trim() || 'ffmpeg'

/** A cut stopped mid-flight (deploy/restart) is reaped to `failed` after this. */
export const SPEECH_CUT_STALE_MS = 15 * 60_000

/** Defensive ceiling for the source download (the VOD of a speech is minutes long). */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024

const SOURCE_DOWNLOAD_TIMEOUT_MS = 180_000
const FFMPEG_MIN_TIMEOUT_MS = 30_000
const FFMPEG_MAX_TIMEOUT_MS = 300_000
const FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message !== '' ? error.message : 'Falha ao processar o corte.'

// The job runs after the create response, with no request actor: every write
// below is an intentional admin bypass, justified because the row was created
// behind the acervo gate and the pipeline owns its state. Keeping the writes in
// these helpers keeps the bypass deliberate (and documented for the guard).

const loadCutSystem = (payload: Payload, cutId: number) =>
  payload.findByID({
    collection: 'speechCut',
    id: cutId,
    depth: 1,
    // Intentional admin bypass: the job reads the row it owns.
    overrideAccess: true,
  })

const updateCutSystem = (
  payload: Payload,
  cutId: number,
  data: Partial<SpeechCut>,
  req?: PayloadTransactionRequest,
) =>
  payload.update({
    collection: 'speechCut',
    id: cutId,
    data,
    // Intentional admin bypass: the pipeline owns the row state.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

const createMediaSystem = (
  payload: Payload,
  alt: string,
  filePath: string,
  req?: PayloadTransactionRequest,
) =>
  payload.create({
    collection: 'media',
    data: { alt },
    filePath,
    // Intentional admin bypass: the stored file belongs to the cut row.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

const failCut = (payload: Payload, cutId: number, message: string): Promise<unknown> =>
  updateCutSystem(payload, cutId, { status: 'failed', step: null, error: message })

const updateStep = (payload: Payload, cutId: number, step: SpeechCutStep): Promise<unknown> =>
  updateCutSystem(payload, cutId, { step })

/**
 * Streams the resolved VOD to a temp file. A `text/html` body is the CDN's
 * error page wearing a 200 (same rule as the C162 probe) and is refused.
 */
const downloadSource = async (url: string, destination: string): Promise<void> => {
  const response = await fetch(url, {
    headers: { 'User-Agent': CAMARA_USER_AGENT },
    signal: AbortSignal.timeout(SOURCE_DOWNLOAD_TIMEOUT_MS),
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || contentType.includes('text/html')) {
    throw new Error(`A Câmara não entregou o arquivo do trecho (HTTP ${response.status}).`)
  }
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
    throw new Error('O arquivo do trecho na Câmara é grande demais para cortar.')
  }
  if (!response.body) throw new Error('A Câmara não entregou o corpo do arquivo do trecho.')

  // The counter enforces the ceiling even when the CDN answers chunked (no
  // content-length): the stream aborts instead of filling the disk.
  let received = 0
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > MAX_SOURCE_BYTES) {
        callback(new Error('O arquivo do trecho na Câmara é grande demais para cortar.'))
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination),
  )
}

const runFfmpeg = (args: string[], durationSeconds: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = Math.min(
      FFMPEG_MAX_TIMEOUT_MS,
      Math.max(FFMPEG_MIN_TIMEOUT_MS, durationSeconds * 8_000),
    )
    execFile(
      ffmpegBinary(),
      args,
      { timeout, maxBuffer: FFMPEG_MAX_BUFFER_BYTES },
      (error, _stdout, stderr) => {
        if (!error) {
          resolve()
          return
        }
        const detail = String(stderr ?? '')
          .trim()
          .slice(-400)
        reject(new Error(`${messageOf(error)}${detail ? ` — ${detail}` : ''}`))
      },
    )
  })

/**
 * The whole pipeline of one cut. Never throws: an orphan job (server restart)
 * is covered by the lazy reaper, and any error marks the row `failed` so the
 * retry reuses it.
 */
export const runSpeechCutJob = async (payload: Payload, cutId: number): Promise<void> => {
  let tempDir: string | null = null

  try {
    const cut = await loadCutSystem(payload, cutId)
    if (cut.status !== 'processing') return

    await updateStep(payload, cutId, 'resolving')
    const speech = typeof cut.speech === 'object' && cut.speech !== null ? cut.speech : null
    if (!speech) {
      await failCut(payload, cutId, 'A fala deste corte não está mais disponível.')
      return
    }
    const coordinates = speechVodCoordinates(speech)
    if (!coordinates) {
      await failCut(payload, cutId, 'Esta fala não tem trecho de vídeo para resolver na Câmara.')
      return
    }

    const resolution = await resolveSpeechVod(coordinates)
    if (resolution.state === 'gerando') {
      await failCut(payload, cutId, 'A Câmara ainda está gerando o vídeo deste trecho.')
      return
    }
    if (resolution.state !== 'pronto') {
      await failCut(payload, cutId, 'A Câmara não entregou o arquivo deste trecho.')
      return
    }
    const sourceUrl = resolution.playbackUrl ?? resolution.downloadUrl
    if (!sourceUrl) {
      await failCut(payload, cutId, 'A Câmara não entregou um arquivo jogável deste trecho.')
      return
    }

    await updateStep(payload, cutId, 'cutting')
    tempDir = await mkdtemp(join(tmpdir(), 'speech-cut-'))
    const inputPath = join(tempDir, 'source.mp4')
    const outputName = `corte-${cut.id}-${Math.round(cut.startSeconds)}-${Math.round(cut.endSeconds)}.mp4`
    const outputPath = join(tempDir, outputName)
    const durationSeconds = Math.max(0, Math.round(cut.endSeconds) - Math.round(cut.startSeconds))

    await downloadSource(sourceUrl, inputPath)
    await runFfmpeg(
      buildSpeechCutFfmpegArgs({
        inputPath,
        outputPath,
        startSeconds: cut.startSeconds,
        endSeconds: cut.endSeconds,
      }),
      durationSeconds,
    )

    await updateStep(payload, cutId, 'metadata')
    const fallback = buildSpeechCutFallbackMetadata({
      speechType: speech.type ?? null,
      dateLabel: formatSpeechDate(speech.speechAt),
      summary: speech.summary ?? null,
    })
    const title = cut.title?.trim() || fallback.title
    const description = cut.description?.trim() || fallback.description
    if (title !== cut.title || description !== cut.description) {
      await updateCutSystem(payload, cutId, { title, description })
    }

    await updateStep(payload, cutId, 'publishing')
    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await createMediaSystem(payload, title, outputPath, req)
      await updateCutSystem(
        payload,
        cutId,
        {
          status: 'published',
          media: media.id,
          publishedAt: new Date().toISOString(),
          step: null,
          error: null,
        },
        req,
      )
    })
  } catch (error) {
    await failCut(payload, cutId, messageOf(error)).catch(() => undefined)
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Lazy reaper: a `processing` row untouched for `SPEECH_CUT_STALE_MS` was lost
 * to a restart (there is no queue to ask). The conditional `where` never
 * clobbers a job that just finished — intentional admin bypass, like the other
 * system writes above.
 */
export const reapStaleSpeechCut = async (
  payload: Payload,
  cut: { id: number; status: string; updatedAt: string },
): Promise<boolean> => {
  if (cut.status !== 'processing') return false
  const updatedAt = Date.parse(cut.updatedAt)
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < SPEECH_CUT_STALE_MS) return false

  const result = await payload.update({
    collection: 'speechCut',
    where: { and: [{ id: { equals: cut.id } }, { status: { equals: 'processing' } }] },
    data: { status: 'failed', step: null, error: 'O corte foi interrompido antes de terminar.' },
    // Intentional admin bypass: the reaper repairs a row the system owns.
    overrideAccess: true,
  })
  return result.docs.length > 0
}
