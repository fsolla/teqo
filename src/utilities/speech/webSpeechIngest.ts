import 'server-only'

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import {
  buildRecordingAudioFfmpegArgs,
  mergeChunkTranscriptions,
  RECORDING_AUDIO_CHUNK_SECONDS,
  type RecordingChunkTranscription,
  type RecordingTranscriptSegment,
} from '@/lib/recordingTranscription'
import type { SpeechFacetInput } from '@/lib/speechGazetteer'
import {
  canonicalWebSpeechUrl,
  INTERNET_SPEECH_MEDIA_SLUG,
  isCompleteWebSpeechState,
  requiresDirectMediaUrl,
  webSpeechAtFromPublishedAt,
  webSpeechPlatformLabel,
  webSpeechSourceKey,
  type WebSpeechFinding,
} from '@/lib/webSpeech'
import {
  DEEPINFRA_TRANSCRIBE_COST_PER_MINUTE_USD,
  deepInfraTranscribeSegments,
  type TranscribeSegmentsResult,
} from '@/utilities/ai/deepInfraTranscribe'
import { downloadUrlToFile } from '@/utilities/media/downloadToFile'
import { ffmpegBinary, messageOf, runFfmpeg } from '@/utilities/media/ffmpeg'
import {
  deleteLargeMedia,
  LARGE_MEDIA_THRESHOLD_BYTES,
  uploadLargeMedia,
} from '@/utilities/media/largeS3Upload'
import {
  downloadWithYtDlp,
  readYtDlpMetadata,
  resolveYtDlp,
  YTDLP_INSTALL_HINT,
  type YtDlpMetadata,
} from '@/utilities/media/ytdlp'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { createPrivateMediaFromFile } from '@/utilities/privateMedia/privateMediaUpload'
import {
  classifySpeech,
  type SpeechClassificationResult,
} from '@/utilities/speech/speechClassifier'
import {
  findSpeechImportState,
  upsertSpeechBundle,
  type SpeechImportBundle,
} from '@/utilities/speech/speechImport'

/**
 * C215 — one web speech end to end: acquire the media (yt-dlp or direct HTTP),
 * transcribe with timestamps (the C199 chunk owner), classify (the C153 owner),
 * mirror the artifact in the private collection and upsert idempotently (the
 * Câmara import owner). Every dependency is injectable so the int specs run
 * offline; the CLI is the only caller.
 */

/** Audio extraction has no duration to scale the timeout from; 30 min is ample. */
const FFMPEG_TIMEOUT_MS = 30 * 60_000
const ACQUISITION_FAILURE = 'Não foi possível baixar a mídia da fala.'
const TRANSCRIPTION_FAILURE = 'Não foi possível transcrever a fala.'
const MEDIA_FAILURE = 'Não foi possível guardar a mídia da fala.'
const CLASSIFICATION_FAILURE = 'Não foi possível classificar a fala.'

type WebSpeechIngestStatus = 'created' | 'updated' | 'skipped' | 'failed'
type WebSpeechIngestStage =
  | 'validation'
  | 'acquisition'
  | 'transcription'
  | 'classification'
  | 'media'
  | 'upsert'

export type WebSpeechIngestResult = {
  sourceKey: string
  status: WebSpeechIngestStatus
  stage: WebSpeechIngestStage | null
  error: string | null
  asrSeconds: number
  asrCostUsd: number
  llmCostUsd: number | null
}

type WebSpeechAcquisition = {
  /** Produced file inside the temp dir, extension included. */
  fileName: string
  metadata: YtDlpMetadata | null
}

export type WebSpeechAcquirer = (
  finding: WebSpeechFinding,
  tempDir: string,
) => Promise<WebSpeechAcquisition>

type WebSpeechMediaMirror = (args: {
  payload: Payload
  req: PayloadTransactionRequest
  alt: string
  inputPath: string
}) => Promise<{ id: number; cleanup: () => Promise<void> }>

export type WebSpeechTranscriber = (
  file: Blob,
  options?: { filename?: string },
) => Promise<TranscribeSegmentsResult>

export type WebSpeechClassifier = (input: SpeechFacetInput) => Promise<SpeechClassificationResult>

export type WebSpeechIngestDeps = {
  acquire?: WebSpeechAcquirer
  transcribe?: WebSpeechTranscriber
  classify?: WebSpeechClassifier
  runFfmpeg?: typeof runFfmpeg
  downloadThumbnail?: (url: string, destinationPath: string) => Promise<void>
  mirrorMedia?: WebSpeechMediaMirror
}

class WebSpeechIngestError extends Error {
  readonly stage: WebSpeechIngestStage

  constructor(stage: WebSpeechIngestStage, message: string) {
    super(message)
    this.stage = stage
  }
}

const extensionOf = (url: string, fallback: string): string => {
  try {
    const name = new URL(url).pathname.split('/').pop() ?? ''
    const index = name.lastIndexOf('.')
    const extension = index >= 0 ? name.slice(index).toLowerCase() : ''
    return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : fallback
  } catch {
    return fallback
  }
}

/** yt-dlp for YouTube/Instagram; direct mediaUrl for radio/audio. */
const defaultAcquire: WebSpeechAcquirer = async (finding, tempDir) => {
  if (requiresDirectMediaUrl(finding.platform)) {
    if (!finding.mediaUrl) throw new Error('Achado sem mediaUrl.')
    const fileName = `source${extensionOf(finding.mediaUrl, '.mp3')}`
    await downloadUrlToFile({ url: finding.mediaUrl, destinationPath: join(tempDir, fileName) })
    return { fileName, metadata: null }
  }

  const resolved = await resolveYtDlp()
  if (!resolved.ok) throw new Error(`${resolved.reason}. ${YTDLP_INSTALL_HINT}`)

  const metadata = await readYtDlpMetadata({ bin: resolved.bin, url: finding.url })
  await downloadWithYtDlp({
    bin: resolved.bin,
    url: finding.url,
    outputTemplate: join(tempDir, 'source.%(ext)s'),
    ffmpegLocation: ffmpegBinary(),
  })
  const fileName = (await readdir(tempDir)).find((name) => name.startsWith('source.'))
  if (!fileName) throw new Error('yt-dlp não produziu arquivo.')
  return { fileName, metadata }
}

type BundleMetadata = {
  title?: string | null
  channel?: string | null
  externalId?: string | null
  durationSeconds?: number | null
}

/**
 * The web bundle: Câmara-only fields stay null (no legislature, no VOD, no
 * official transcript) and the web metadata travels only when known —
 * `undefined` preserves the stored value on a metadata refresh.
 */
const baseBundle = (
  finding: WebSpeechFinding,
  sourceKey: string,
  speechAt: string,
  metadata: BundleMetadata,
): SpeechImportBundle => ({
  sourceKey,
  origin: 'web',
  platform: finding.platform,
  externalId: metadata.externalId,
  sourceUrl: canonicalWebSpeechUrl(finding.platform, finding.url),
  title: metadata.title,
  channel: metadata.channel,
  speechAt,
  year: Number(speechAt.slice(0, 4)),
  legislature: null,
  type: null,
  phase: null,
  durationSeconds: metadata.durationSeconds ?? null,
  summary: null,
  officialTranscript: null,
  officialTextUrl: null,
  keywords: [],
  eventId: null,
  eventType: null,
  eventStartAt: null,
  eventEndAt: null,
  youtubeUrl: null,
  presidingOfficer: null,
  audioId: null,
  excerptTMs: null,
  vodPlaybackUrl: null,
  vodDownloadUrl: null,
})

const emptyResult = (
  sourceKey: string,
  status: WebSpeechIngestStatus,
  stage: WebSpeechIngestStage | null,
  error: string | null,
): WebSpeechIngestResult => ({
  sourceKey,
  status,
  stage,
  error,
  asrSeconds: 0,
  asrCostUsd: 0,
  llmCostUsd: null,
})

type ExtractedTranscript = {
  segments: RecordingTranscriptSegment[]
  durationSeconds: number | null
  asrSeconds: number
}

/** Extract → chunk → transcribe → merge (the C199 owners, relative offsets). */
const extractTranscript = async ({
  ffmpeg,
  transcribe,
  inputPath,
  tempDir,
  declaredDuration,
}: {
  ffmpeg: typeof runFfmpeg
  transcribe: WebSpeechTranscriber
  inputPath: string
  tempDir: string
  declaredDuration: number | null
}): Promise<ExtractedTranscript> => {
  const outputPattern = join(tempDir, 'chunk-%03d.mp3')
  await ffmpeg(
    buildRecordingAudioFfmpegArgs({ inputPath, outputPattern }),
    declaredDuration ?? 0,
    TRANSCRIPTION_FAILURE,
    FFMPEG_TIMEOUT_MS,
  )
  const chunkFiles = (await readdir(tempDir)).filter((name) => /^chunk-\d+\.mp3$/.test(name)).sort()
  if (chunkFiles.length === 0) throw new Error(TRANSCRIPTION_FAILURE)

  const chunks: RecordingChunkTranscription[] = []
  let asrSeconds = 0
  let measuredDuration = 0
  for (const [index, chunkFile] of chunkFiles.entries()) {
    const bytes = await readFile(join(tempDir, chunkFile))
    const result = await transcribe(new Blob([bytes], { type: 'audio/mpeg' }), {
      filename: chunkFile,
    })
    if (!result.ok) throw new Error(result.error)
    chunks.push({
      offsetSeconds: index * RECORDING_AUDIO_CHUNK_SECONDS,
      segments: result.segments,
    })
    asrSeconds += result.durationSeconds ?? RECORDING_AUDIO_CHUNK_SECONDS
    if (result.durationSeconds !== null) measuredDuration += result.durationSeconds
  }

  const segments = mergeChunkTranscriptions(chunks)
  if (segments.length === 0) throw new Error(TRANSCRIPTION_FAILURE)

  // Only measured data (or the declared duration / the last segment end) —
  // never the chunk count as a duration.
  const lastSegmentEnd = segments.at(-1)?.endSeconds
  const durationSeconds =
    measuredDuration > 0
      ? Math.round(measuredDuration)
      : (declaredDuration ?? (lastSegmentEnd !== undefined ? Math.round(lastSegmentEnd) : null))

  return { segments, durationSeconds, asrSeconds }
}

type WebSpeechMediaMirrorOptions = {
  thresholdBytes?: number
  uploadLarge?: typeof uploadLargeMedia
  removeLarge?: typeof deleteLargeMedia
}

export const createWebSpeechMediaMirror =
  ({
    thresholdBytes = LARGE_MEDIA_THRESHOLD_BYTES,
    uploadLarge = uploadLargeMedia,
    removeLarge = deleteLargeMedia,
  }: WebSpeechMediaMirrorOptions = {}): WebSpeechMediaMirror =>
  ({ payload, req, alt, inputPath }) =>
    createPrivateMediaFromFile({
      inputPath,
      thresholdBytes,
      uploadLarge,
      removeLarge,
      create: (filePath) =>
        payload.create({
          collection: INTERNET_SPEECH_MEDIA_SLUG,
          data: { alt },
          filePath,
          req,
          // Intentional bypass: the ingestion CLI is a trusted actor with no session.
          overrideAccess: true,
        }),
      update: (id, data) =>
        payload.update({
          collection: INTERNET_SPEECH_MEDIA_SLUG,
          id,
          data,
          req,
          // Intentional bypass: the trusted ingestion CLI finalizes its own media row.
          overrideAccess: true,
        }),
    })

const defaultMirrorMedia = createWebSpeechMediaMirror()

/**
 * The artifact and the speech in ONE transaction (`req` threaded through the
 * upload and the upsert). Throws `WebSpeechIngestError('media')`; the caller
 * owns the best-effort cleanup of a thumbnail created before the failure.
 */
const persistIngestedSpeech = async ({
  payload,
  finding,
  sourceKey,
  speechAt,
  metadata,
  facets,
  segments,
  durationSeconds,
  inputPath,
  thumbnail,
  mirrorMedia,
}: {
  payload: Payload
  finding: WebSpeechFinding
  sourceKey: string
  speechAt: string
  metadata: { title: string | null; channel: string | null; externalId: string | null }
  facets: SpeechClassificationResult['facets']
  segments: RecordingTranscriptSegment[]
  durationSeconds: number | null
  inputPath: string
  thumbnail: number | null
  mirrorMedia: WebSpeechMediaMirror
}): Promise<void> => {
  const alt = `${webSpeechPlatformLabel(finding.platform)} — ${metadata.title ?? speechAt}`
  const cleanupRef: { current?: () => Promise<void> } = {}

  try {
    await withPayloadTransaction(payload, async ({ req }) => {
      const mirrored = await mirrorMedia({ payload, req, alt, inputPath })
      cleanupRef.current = mirrored.cleanup

      await upsertSpeechBundle(
        payload,
        {
          ...baseBundle(finding, sourceKey, speechAt, { ...metadata, durationSeconds }),
          facets,
          segments: segments.map((segment) => ({
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            text: segment.text,
          })),
          mirroredMedia: mirrored.id,
          thumbnail,
        },
        { req },
      )
    })
  } catch (error) {
    await cleanupRef.current?.().catch(() => undefined)
    throw new WebSpeechIngestError('media', messageOf(error, MEDIA_FAILURE))
  }
}

export const ingestWebSpeech = async (
  payload: Payload,
  finding: WebSpeechFinding,
  { reprocess = false, deps = {} }: { reprocess?: boolean; deps?: WebSpeechIngestDeps } = {},
): Promise<WebSpeechIngestResult> => {
  const sourceKey = webSpeechSourceKey(finding)
  const speechAt = webSpeechAtFromPublishedAt(finding.publishedAt)
  if (!speechAt)
    return emptyResult(sourceKey, 'failed', 'validation', 'Data de publicação inválida.')

  const acquire = deps.acquire ?? defaultAcquire
  const transcribe = deps.transcribe ?? deepInfraTranscribeSegments
  const classify = deps.classify ?? classifySpeech
  const ffmpeg = deps.runFfmpeg ?? runFfmpeg
  const downloadThumbnail =
    deps.downloadThumbnail ??
    ((url, destinationPath) => downloadUrlToFile({ url, destinationPath }))
  const mirrorMedia = deps.mirrorMedia ?? defaultMirrorMedia

  let asrSeconds = 0
  let tempDir: string | null = null

  try {
    const state = await findSpeechImportState(payload, sourceKey)

    if (isCompleteWebSpeechState(state) && !reprocess) {
      // Complete row: refresh only the metadata the finding brought (undefined
      // preserves the stored values); never re-download or re-transcribe.
      await upsertSpeechBundle(
        payload,
        baseBundle(finding, sourceKey, speechAt, {
          title: finding.title,
          channel: finding.channel,
          externalId: finding.externalId,
          durationSeconds: finding.durationSeconds ?? state?.durationSeconds ?? undefined,
        }),
      )
      return emptyResult(sourceKey, 'skipped', null, null)
    }

    tempDir = await mkdtemp(join(tmpdir(), 'web-speech-'))
    let acquisition: WebSpeechAcquisition
    try {
      acquisition = await acquire(finding, tempDir)
    } catch (error) {
      throw new WebSpeechIngestError('acquisition', messageOf(error, ACQUISITION_FAILURE))
    }

    const inputPath = join(tempDir, acquisition.fileName)
    const metadata = acquisition.metadata
    const title = finding.title ?? metadata?.title ?? null
    const channel = finding.channel ?? metadata?.channel ?? null
    const externalId = finding.externalId ?? metadata?.externalId ?? null
    const declaredDuration = finding.durationSeconds ?? metadata?.durationSeconds ?? null
    const thumbnailUrl = finding.thumbnailUrl ?? metadata?.thumbnailUrl ?? null

    let extracted: ExtractedTranscript
    try {
      extracted = await extractTranscript({
        ffmpeg,
        transcribe,
        inputPath,
        tempDir,
        declaredDuration,
      })
    } catch (error) {
      throw new WebSpeechIngestError('transcription', messageOf(error, TRANSCRIPTION_FAILURE))
    }
    asrSeconds = extracted.asrSeconds

    let classification: SpeechClassificationResult
    try {
      classification = await classify({
        transcript: extracted.segments.map((segment) => segment.text).join(' '),
        summary: title,
        keywords: [],
      })
    } catch (error) {
      throw new WebSpeechIngestError('classification', messageOf(error, CLASSIFICATION_FAILURE))
    }

    // Thumbnail is best effort and lives OUTSIDE the main transaction: a broken
    // image (or a failed upload) must never lose the speech.
    let thumbnailId: number | null = null
    if (thumbnailUrl) {
      try {
        const destination = join(tempDir, `thumbnail${extensionOf(thumbnailUrl, '.jpg')}`)
        await downloadThumbnail(thumbnailUrl, destination)
        const thumbnail = await payload.create({
          collection: INTERNET_SPEECH_MEDIA_SLUG,
          data: { alt: `Capa — ${title ?? speechAt}` },
          filePath: destination,
          // Intentional bypass: the ingestion CLI is a trusted actor with no session.
          overrideAccess: true,
        })
        thumbnailId = thumbnail.id
      } catch {
        thumbnailId = null
      }
    }

    const previousThumbnail = state?.thumbnail ?? null
    const previousMediaIds = [
      ...(typeof state?.mirroredMedia === 'number' ? [state.mirroredMedia] : []),
      // Only a replaced thumbnail is deleted; keeping it is the fallback when
      // the new download failed.
      ...(thumbnailId !== null && typeof previousThumbnail === 'number' ? [previousThumbnail] : []),
    ]

    try {
      await persistIngestedSpeech({
        payload,
        finding,
        sourceKey,
        speechAt,
        metadata: { title, channel, externalId },
        facets: classification.facets,
        segments: extracted.segments,
        durationSeconds: extracted.durationSeconds,
        inputPath,
        thumbnail: thumbnailId ?? previousThumbnail,
        mirrorMedia,
      })
    } catch (error) {
      if (thumbnailId !== null) {
        await payload
          .delete({
            collection: INTERNET_SPEECH_MEDIA_SLUG,
            id: thumbnailId,
            // Intentional bypass: the pipeline cleans up the file it just created.
            overrideAccess: true,
          })
          .catch(() => undefined)
      }
      throw error
    }

    // Replaced artifacts are removed best effort: an orphan object in the
    // private bucket is harmless, a leaked row is not.
    if (previousMediaIds.length > 0) {
      await payload
        .delete({
          collection: INTERNET_SPEECH_MEDIA_SLUG,
          where: { id: { in: previousMediaIds } },
          // Intentional bypass: the pipeline replaces the files it owns.
          overrideAccess: true,
        })
        .catch(() => undefined)
    }

    return {
      sourceKey,
      status: state ? 'updated' : 'created',
      stage: null,
      error: null,
      asrSeconds,
      asrCostUsd: (asrSeconds * DEEPINFRA_TRANSCRIBE_COST_PER_MINUTE_USD) / 60,
      llmCostUsd: classification.llm.estimatedCostUsd,
    }
  } catch (error) {
    const asrCostUsd = (asrSeconds * DEEPINFRA_TRANSCRIBE_COST_PER_MINUTE_USD) / 60
    if (error instanceof WebSpeechIngestError) {
      return {
        ...emptyResult(sourceKey, 'failed', error.stage, error.message),
        asrSeconds,
        asrCostUsd,
      }
    }
    return {
      ...emptyResult(sourceKey, 'failed', null, messageOf(error, 'Falha na ingestão da fala.')),
      asrSeconds,
      asrCostUsd,
    }
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
