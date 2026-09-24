import 'server-only'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { SPEECH_VOD_INELIGIBLE_MESSAGE } from '@/lib/schemas/speechVod'
import { formatSpeechDate } from '@/lib/speechClock'
import {
  buildSpeechCutAudioFfmpegArgs,
  buildSpeechCutFallbackMetadata,
  buildSpeechCutFfmpegArgs,
  SPEECH_CUT_FAILURE_GENERATING,
  SPEECH_CUT_FAILURE_INTERRUPTED,
  SPEECH_CUT_FAILURE_MIRROR_MISSING,
  SPEECH_CUT_FAILURE_SPEECH_GONE,
  SPEECH_CUT_FAILURE_UNAVAILABLE,
  SPEECH_CUT_FAILURE_UNPLAYABLE,
  speechCutOriginKind,
  speechCutSourceKind,
  type SpeechCutStep,
} from '@/lib/speechCut'
import { speechVodCoordinates } from '@/lib/speechVod'
import { INTERNET_SPEECH_MEDIA_SLUG, webSpeechMediaKind } from '@/lib/webSpeech'
import type { InternetSpeechMedia, SpeechCut } from '@/payload-types'
import { messageOf, runFfmpeg } from '@/utilities/media/ffmpeg'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import {
  downloadPrivateMediaToFile,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'
import { downloadSource } from '@/utilities/speech/speechMediaPipeline'
import { resolveSpeechVod, SPEECH_VOD_CUT_POLICY } from '@/utilities/speech/speechVodResolver'

/**
 * C167 — the cut job: resolve the Câmara VOD, cut the exact [start, end] with
 * ffmpeg, store the MP4 as `media` and publish the `speechCut` row. Runs after
 * the create response (`speechCutScheduler`) so no request waits on ffmpeg;
 * every failure leaves the row `failed` and nothing published.
 *
 * C217 — a web speech has no VOD: the job reads the private mirrored file the
 * ingestion stored (`downloadPrivateMediaToFile`) and cuts the same exact
 * window (audio-only mirrors get the audio ffmpeg variant). The Câmara path is
 * unchanged.
 */

/** A cut stopped mid-flight (deploy/restart) is reaped to `failed` after this. */
export const SPEECH_CUT_STALE_MS = 15 * 60_000

const FAILURE_FALLBACK = 'Falha ao processar o corte.'

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

/**
 * C217 — the private mirror of a web speech. The cut's depth-1 speech keeps
 * `mirroredMedia` as an id (the upload lives at depth 2), so the job reads the
 * row itself — intentional admin bypass, like the other system reads above.
 * `disableErrors` turns a row deleted mid-flight into `null`, which the job
 * maps to its honest "mirror gone" failure instead of a raw not-found error.
 */
const loadMirrorMedia = async (
  payload: Payload,
  mirroredMedia: number | { id: number } | null | undefined,
): Promise<InternetSpeechMedia | null> => {
  const mediaId = relationshipId(mirroredMedia)
  if (mediaId === null) return null
  return payload.findByID({
    collection: INTERNET_SPEECH_MEDIA_SLUG,
    id: mediaId,
    depth: 0,
    disableErrors: true,
    // Intentional admin bypass: the job reads the private file it owns.
    overrideAccess: true,
  })
}

/** Temp input extension from the stored name (sanitized; ffmpeg probes anyway). */
const inputExtensionOf = (filename: string | null | undefined): string => {
  const extension = extname(filename ?? '').toLowerCase()
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : '.mp4'
}

/**
 * Fails the row and keeps the step it died on (the first stage is `resolving`
 * by default): the dialog maps the step and the known literals into the honest
 * message, while `error` keeps the raw detail for the admin.
 */
const failCut = (
  payload: Payload,
  cutId: number,
  message: string,
  step: SpeechCutStep | null = 'resolving',
): Promise<unknown> => updateCutSystem(payload, cutId, { status: 'failed', step, error: message })

const updateStep = (payload: Payload, cutId: number, step: SpeechCutStep): Promise<unknown> =>
  updateCutSystem(payload, cutId, { step })

/**
 * The whole pipeline of one cut. Never throws: an orphan job (server restart)
 * is covered by the lazy reaper, and any error marks the row `failed` so the
 * retry reuses it.
 */
export const runSpeechCutJob = async (payload: Payload, cutId: number): Promise<void> => {
  let tempDir: string | null = null
  // The step the row would be showing if the job died right now: the catch
  // records it so the failure message separates cortar from guardar.
  let currentStep: SpeechCutStep = 'resolving'
  const markStep = async (step: SpeechCutStep): Promise<void> => {
    currentStep = step
    await updateStep(payload, cutId, step)
  }

  try {
    const cut = await loadCutSystem(payload, cutId)
    if (cut.status !== 'processing') return

    await markStep('resolving')
    const speech = typeof cut.speech === 'object' && cut.speech !== null ? cut.speech : null
    if (!speech) {
      await failCut(payload, cutId, SPEECH_CUT_FAILURE_SPEECH_GONE)
      return
    }

    const sourceKind = speechCutSourceKind(speech)
    if (!sourceKind) {
      await failCut(
        payload,
        cutId,
        speechCutOriginKind(speech) === 'web'
          ? SPEECH_CUT_FAILURE_MIRROR_MISSING
          : SPEECH_VOD_INELIGIBLE_MESSAGE,
      )
      return
    }

    // C217 — the web branch reads the private mirror; the Câmara branch keeps
    // the C167 resolution (stored links are its own cache, probed like the API).
    let mirror: InternetSpeechMedia | null = null
    let sourceUrl: string | null = null
    if (sourceKind === 'web') {
      mirror = await loadMirrorMedia(payload, speech.mirroredMedia)
      if (!mirror) {
        await failCut(payload, cutId, SPEECH_CUT_FAILURE_MIRROR_MISSING)
        return
      }
    } else {
      const coordinates = speechVodCoordinates(speech)
      if (!coordinates) {
        await failCut(payload, cutId, SPEECH_VOD_INELIGIBLE_MESSAGE)
        return
      }

      const resolution = await resolveSpeechVod(coordinates, {
        policy: SPEECH_VOD_CUT_POLICY,
        // The stored links are the Câmara's own cache: tried only when the API
        // left no verified URL, and probed exactly like the API links.
        cachedUrls: { playbackUrl: speech.vodPlaybackUrl, downloadUrl: speech.vodDownloadUrl },
      })
      if (resolution.state === 'gerando') {
        await failCut(payload, cutId, SPEECH_CUT_FAILURE_GENERATING)
        return
      }
      if (resolution.state !== 'pronto') {
        await failCut(payload, cutId, SPEECH_CUT_FAILURE_UNAVAILABLE)
        return
      }
      sourceUrl = resolution.playbackUrl ?? resolution.downloadUrl
      if (!sourceUrl) {
        await failCut(payload, cutId, SPEECH_CUT_FAILURE_UNPLAYABLE)
        return
      }
    }

    await markStep('cutting')
    tempDir = await mkdtemp(join(tmpdir(), 'speech-cut-'))
    const inputPath = join(tempDir, `source${mirror ? inputExtensionOf(mirror.filename) : '.mp4'}`)
    const outputName = `corte-${cut.id}-${Math.round(cut.startSeconds)}-${Math.round(cut.endSeconds)}.mp4`
    const outputPath = join(tempDir, outputName)
    const durationSeconds = Math.max(0, Math.round(cut.endSeconds) - Math.round(cut.startSeconds))

    if (mirror) {
      try {
        await downloadPrivateMediaToFile({
          media: mirror,
          staticDir: resolvePrivateMediaStaticDir(payload, INTERNET_SPEECH_MEDIA_SLUG),
          destinationPath: inputPath,
        })
      } catch {
        // The row exists but the stored object does not (+ any read failure):
        // nothing to cut, and the retry can find the file again if it returns.
        await failCut(payload, cutId, SPEECH_CUT_FAILURE_MIRROR_MISSING, 'cutting')
        return
      }
    } else if (sourceUrl) {
      await downloadSource(sourceUrl, inputPath)
    }

    // C217 — an audio-only mirror has no video stream to map.
    const audioOnly = mirror !== null && webSpeechMediaKind(mirror.mimeType) === 'audio'
    await runFfmpeg(
      (audioOnly ? buildSpeechCutAudioFfmpegArgs : buildSpeechCutFfmpegArgs)({
        inputPath,
        outputPath,
        startSeconds: cut.startSeconds,
        endSeconds: cut.endSeconds,
      }),
      durationSeconds,
      FAILURE_FALLBACK,
    )

    await markStep('metadata')
    const fallback = buildSpeechCutFallbackMetadata({
      speechType: speech.type ?? null,
      dateLabel: formatSpeechDate(speech.speechAt),
      summary: speech.summary ?? null,
      source: sourceKind,
    })
    const title = cut.title?.trim() || fallback.title
    const description = cut.description?.trim() || fallback.description
    if (title !== cut.title || description !== cut.description) {
      await updateCutSystem(payload, cutId, { title, description })
    }

    await markStep('publishing')
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
    await failCut(payload, cutId, messageOf(error, FAILURE_FALLBACK), currentStep).catch(
      () => undefined,
    )
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
    data: { status: 'failed', step: null, error: SPEECH_CUT_FAILURE_INTERRUPTED },
    // Intentional admin bypass: the reaper repairs a row the system owns.
    overrideAccess: true,
  })
  return result.docs.length > 0
}
