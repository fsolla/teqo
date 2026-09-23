import 'server-only'

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import {
  CONTENT_MEDIA_SLUG,
  CONTENT_PIECE_FAILURE_INTERRUPTED,
  CONTENT_PIECE_FFMPEG_TIMEOUT_MS,
  needsContentPieceProcessing,
  type ContentPieceStep,
  type ContentPieceType,
} from '@/lib/contentPiece'
import {
  buildRecordingAudioFfmpegArgs,
  mergeChunkTranscriptions,
  RECORDING_AUDIO_CHUNK_SECONDS,
} from '@/lib/recordingTranscription'
import type { ContentPiece } from '@/payload-types'
import {
  deepInfraTranscribeSegments,
  type TranscribeSegmentsResult,
} from '@/utilities/ai/deepInfraTranscribe'
import { catalogContentPiece } from '@/utilities/content/contentPieceCataloging'
import { resolveContentPieceSource } from '@/utilities/content/contentPieceLink'
import { messageOf, runFfmpeg } from '@/utilities/media/ffmpeg'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { downloadPrivateMediaToFile } from '@/utilities/privateMedia/privateMediaResponse'

/**
 * C211 — the processing job of one content piece: resolve the source (archived
 * file or the official Instagram extraction; a YouTube/unsupported link becomes
 * a peça-link), extract/split the audio with ffmpeg, transcribe it and run the
 * automatic cataloguing, then persist the result (`pronto`). Runs after the
 * upload response (`contentPieceScheduler`) so no request waits on minutes of
 * ASR; every failure leaves the row `falhou` with the file preserved and the
 * retry reuses the row.
 *
 * The cataloguing never overwrites a field the assessoria already edited
 * (`curatedFields`): the final write re-reads the row inside the transaction.
 */

/** A piece stopped mid-flight (deploy/restart) is reaped to `falhou` after this. */
export const CONTENT_PIECE_STALE_MS = 60 * 60_000

const FAILURE_FALLBACK = 'Falha ao processar a peça.'
const NO_AUDIO_MESSAGE = 'Não foi possível extrair o áudio da peça.'

type ChunkTranscriber = (
  file: Blob,
  options?: { filename?: string; timeoutMs?: number },
) => Promise<TranscribeSegmentsResult>

// The job runs after the upload response, with no request actor: every write
// below is an intentional admin bypass, justified because the row was created
// behind the Central gate and the pipeline owns its state.

const loadContentPieceSystem = (payload: Payload, contentPieceId: number) =>
  payload.findByID({
    collection: 'contentPiece',
    id: contentPieceId,
    depth: 1,
    // Intentional admin bypass: the job reads the row it owns.
    overrideAccess: true,
  })

const updateContentPieceSystem = (
  payload: Payload,
  contentPieceId: number,
  data: Partial<ContentPiece>,
  req?: PayloadTransactionRequest,
) =>
  payload.update({
    collection: 'contentPiece',
    id: contentPieceId,
    data,
    // Intentional admin bypass: the pipeline owns the row state.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

const failContentPiece = (
  payload: Payload,
  contentPieceId: number,
  message: string,
  step: ContentPieceStep | null = 'extraindo',
): Promise<unknown> =>
  updateContentPieceSystem(payload, contentPieceId, {
    processingStatus: 'falhou',
    step,
    error: message,
  })

const staticDirOf = (payload: Payload): string => {
  const upload = payload.collections[CONTENT_MEDIA_SLUG].config.upload
  return upload && typeof upload === 'object' && upload.staticDir
    ? upload.staticDir
    : CONTENT_MEDIA_SLUG
}

const chunkFilesIn = async (tempDir: string): Promise<string[]> => {
  const entries = await readdir(tempDir)
  return entries.filter((name) => /^chunk-\d+\.mp3$/.test(name)).sort()
}

/**
 * The audio half of the pipeline: extract/split the archived media and
 * transcribe every chunk. Returns the transcript and the measured duration, or
 * a failure message the caller stores.
 */
const transcribeContentPieceMedia = async ({
  payload,
  piece,
  media,
  localPath,
  tempDir,
  transcribe,
}: {
  payload: Payload
  piece: { id: number }
  media: { filename?: string | null; filesize?: number | null; mimeType?: string | null }
  localPath: string | null
  tempDir: string
  transcribe: ChunkTranscriber
}): Promise<
  | { transcript: string; durationSeconds: number }
  | { failure: { message: string; step: ContentPieceStep } }
> => {
  const inputPath = localPath ?? join(tempDir, 'source')
  const outputPattern = join(tempDir, 'chunk-%03d.mp3')

  if (!localPath) {
    await downloadPrivateMediaToFile({
      media,
      staticDir: staticDirOf(payload),
      destinationPath: inputPath,
    })
  }

  await runFfmpeg(
    buildRecordingAudioFfmpegArgs({ inputPath, outputPattern }),
    RECORDING_AUDIO_CHUNK_SECONDS,
    NO_AUDIO_MESSAGE,
    CONTENT_PIECE_FFMPEG_TIMEOUT_MS,
  )

  const chunkFiles = await chunkFilesIn(tempDir)
  if (chunkFiles.length === 0) {
    return { failure: { message: NO_AUDIO_MESSAGE, step: 'extraindo' } }
  }

  await updateContentPieceSystem(payload, piece.id, { step: 'transcrevendo' })
  const chunks: {
    offsetSeconds: number
    segments: { start: number; end: number; text: string }[]
  }[] = []
  let measured = 0
  for (const [index, chunkFile] of chunkFiles.entries()) {
    const bytes = await readFile(join(tempDir, chunkFile))
    const result = await transcribe(new Blob([bytes], { type: 'audio/mpeg' }), {
      filename: chunkFile,
    })
    if (!result.ok) {
      return { failure: { message: result.error, step: 'transcrevendo' } }
    }
    chunks.push({
      offsetSeconds: index * RECORDING_AUDIO_CHUNK_SECONDS,
      segments: result.segments,
    })
    // Only what the provider measured: a guessed duration would make the ficha
    // label lie.
    if (result.durationSeconds !== null) measured += result.durationSeconds
    // Heartbeat: a chunk takes minutes; the updatedAt keeps the reaper away.
    await updateContentPieceSystem(payload, piece.id, { step: 'transcrevendo' })
  }

  const segments = mergeChunkTranscriptions(chunks)
  if (segments.length === 0) {
    return { failure: { message: FAILURE_FALLBACK, step: 'transcrevendo' } }
  }
  return {
    transcript: segments
      .map((segment) => segment.text)
      .join(' ')
      .trim(),
    durationSeconds: Math.round(measured),
  }
}

/**
 * The whole pipeline of one piece. Never throws: an orphan job (server restart)
 * is covered by the lazy reaper, and any error marks the row `falhou` so the
 * retry reuses it.
 */
export const runContentPieceJob = async (
  payload: Payload,
  contentPieceId: number,
  {
    transcribe = deepInfraTranscribeSegments,
    catalog = catalogContentPiece,
    resolveSource = resolveContentPieceSource,
  }: {
    transcribe?: ChunkTranscriber
    catalog?: typeof catalogContentPiece
    resolveSource?: typeof resolveContentPieceSource
  } = {},
): Promise<void> => {
  let tempDir: string | null = null
  let currentStep: ContentPieceStep = 'extraindo'
  const markStep = async (step: ContentPieceStep): Promise<void> => {
    currentStep = step
    await updateContentPieceSystem(payload, contentPieceId, { step })
  }

  try {
    const piece = await loadContentPieceSystem(payload, contentPieceId)
    if (piece.processingStatus !== 'processando') return

    tempDir = await mkdtemp(join(tmpdir(), 'content-piece-'))
    await markStep('extraindo')
    const source = await resolveSource({ payload, piece, tempDir })
    const suggestedType: ContentPieceType | null = source.suggestedType ?? null
    const effectiveType = suggestedType ?? piece.type
    let transcript = piece.transcript?.trim() ?? ''
    let durationSeconds: number | null = null

    if (!transcript && source.caption) transcript = source.caption.trim()

    if (needsContentPieceProcessing(effectiveType) && source.media) {
      const result = await transcribeContentPieceMedia({
        payload,
        piece,
        media: source.media,
        localPath: source.localPath,
        tempDir,
        transcribe,
      })
      if ('failure' in result) {
        await failContentPiece(payload, contentPieceId, result.failure.message, result.failure.step)
        return
      }
      transcript = result.transcript
      // Only what the provider measured: a zero/absent measurement never
      // becomes a duration the ficha would present as real.
      durationSeconds = result.durationSeconds > 0 ? result.durationSeconds : null
    }

    await markStep('catalogando')
    const catalogued = await catalog({
      payload,
      type: effectiveType,
      title: piece.title,
      transcript: transcript || null,
    })

    await markStep('salvando')
    await withPayloadTransaction(payload, async ({ req }) => {
      // Fresh read inside the transaction: the fields the assessoria edited
      // while the pipeline ran must not be overwritten (D6).
      const fresh = await payload.find({
        collection: 'contentPiece',
        where: { id: { equals: contentPieceId } },
        depth: 0,
        limit: 1,
        pagination: false,
        select: { curatedFields: true },
        req,
        // Intentional admin bypass: the pipeline owns the row state.
        overrideAccess: true,
      })
      const curated = new Set(fresh.docs[0]?.curatedFields ?? [])
      const data: Partial<ContentPiece> = {
        processingStatus: 'pronto',
        step: null,
        error: null,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
      }

      if (transcript && !curated.has('transcript')) data.transcript = transcript
      if (suggestedType && !curated.has('type')) data.type = suggestedType
      if (catalogued.title && !curated.has('title')) data.title = catalogued.title
      if (catalogued.description && !curated.has('description')) {
        data.description = catalogued.description
      }
      if (catalogued.topics && !curated.has('topics')) data.topics = catalogued.topics
      if (catalogued.municipalityId != null && !curated.has('municipality')) {
        data.municipality = catalogued.municipalityId
      }
      if (catalogued.institution && !curated.has('institution')) {
        data.institution = catalogued.institution
      }

      await updateContentPieceSystem(payload, contentPieceId, data, req)
    })
  } catch (error) {
    await failContentPiece(
      payload,
      contentPieceId,
      messageOf(error, FAILURE_FALLBACK),
      currentStep,
    ).catch(() => undefined)
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Lazy reaper: a `processando` row untouched for `CONTENT_PIECE_STALE_MS` was
 * lost to a restart (there is no queue to ask). It becomes `falhou` with the
 * interruption copy, the conditional `where` never clobbers a job that just
 * finished, and the retry reuses the row — intentional admin bypass, like the
 * other system writes above.
 */
export const reapStaleContentPiece = async (
  payload: Payload,
  piece: { id: number; processingStatus: string; updatedAt: string },
): Promise<boolean> => {
  if (piece.processingStatus !== 'processando') return false
  const updatedAt = Date.parse(piece.updatedAt)
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < CONTENT_PIECE_STALE_MS) return false

  const result = await payload.update({
    collection: 'contentPiece',
    where: {
      and: [{ id: { equals: piece.id } }, { processingStatus: { equals: 'processando' } }],
    },
    data: { processingStatus: 'falhou', step: null, error: CONTENT_PIECE_FAILURE_INTERRUPTED },
    // Intentional admin bypass: the reaper repairs a row the system owns.
    overrideAccess: true,
  })
  return result.docs.length > 0
}
