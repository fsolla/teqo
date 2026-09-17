import 'server-only'

import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { formatSpeechDate } from '@/lib/speechClock'
import {
  buildSpeechPosterFfmpegArgs,
  speechPosterFilename,
  speechPosterTarget,
} from '@/lib/speechPoster'
import type { Media } from '@/payload-types'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { downloadSource, messageOf, runFfmpeg } from '@/utilities/speech/speechMediaPipeline'
import { resolveSpeechVod, SPEECH_VOD_PLAYER_POLICY } from '@/utilities/speech/speechVodResolver'

/**
 * C182 — the acervo frame cache: build the middle-of-the-speech still of one
 * speech once and store it as `media` under a deterministic filename. The route
 * calls `ensureSpeechPoster` on a cache miss; the list thumbnail then resolves
 * through the media proxy. The VOD download + ffmpeg stay out of any request's
 * critical path (the route only waits a short budget) and out of the DB
 * transaction (the advisory lock guards just the cache write).
 */

/** Budget a list image request may wait before answering with the fallback. */
export const SPEECH_POSTER_WAIT_MS = 20_000

/** Concurrent generations per process: one scan asks for several images at once. */
const MAX_CONCURRENT_GENERATIONS = 2

/** A failure (or an unresolvable excerpt) is not retried on every view. */
const FAILURE_TTL_MS = 5 * 60_000

const FAILURE_FALLBACK = 'Falha ao gerar o quadro da fala.'

/** The cached frame of a speech, or null when it was never generated. */
export const findSpeechPosterMedia = async (
  payload: Payload,
  speechId: number,
  req?: PayloadTransactionRequest,
): Promise<Media | null> => {
  const result = await payload.find({
    collection: 'media',
    where: { filename: { equals: speechPosterFilename(speechId) } },
    limit: 1,
    depth: 0,
    // Intentional admin bypass: the lookup is the cache probe of a derived file.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  return result.docs[0] ?? null
}

// Process-wide state: one Node server owns the cache, so an in-memory slot gate
// and a short failure memo are enough to keep a scan from stampeding the Câmara.
let activeGenerations = 0
const waiting: Array<() => void> = []
const inFlight = new Map<number, Promise<Media | null>>()
const failures = new Map<number, number>()

const rememberFailure = (speechId: number): void => {
  const now = Date.now()
  for (const [id, at] of failures) {
    if (now - at >= FAILURE_TTL_MS) failures.delete(id)
  }
  failures.set(speechId, now)
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

const generateSpeechPoster = async (payload: Payload, speechId: number): Promise<Media | null> => {
  const speech = await payload.findByID({
    collection: 'speech',
    id: speechId,
    depth: 0,
    // Intentional admin bypass: the frame is derived from a speech the actor
    // already opened behind the acervo gate.
    overrideAccess: true,
  })

  const target = speechPosterTarget(speech)
  if (!target) return null

  const release = await acquireGenerationSlot()
  let tempDir: string | null = null
  try {
    const resolution = await resolveSpeechVod(
      { eventId: target.eventId, audioId: target.audioId, excerptTms: target.excerptTms },
      {
        policy: SPEECH_VOD_PLAYER_POLICY,
        cachedUrls: { playbackUrl: speech.vodPlaybackUrl, downloadUrl: speech.vodDownloadUrl },
      },
    )
    if (resolution.state !== 'pronto') return null
    const sourceUrl = resolution.playbackUrl ?? resolution.downloadUrl
    if (!sourceUrl) return null

    tempDir = await mkdtemp(join(tmpdir(), 'speech-poster-'))
    const inputPath = join(tempDir, 'source.mp4')
    const outputPath = join(tempDir, speechPosterFilename(speechId))

    await downloadSource(sourceUrl, inputPath)
    await runFfmpeg(
      buildSpeechPosterFfmpegArgs({ inputPath, outputPath, atSeconds: target.offsetSeconds }),
      speech.durationSeconds ?? 0,
    )
    // A seek past the end leaves no file: that is a failure, never a broken row.
    await stat(outputPath)

    return await withPayloadTransaction(payload, async ({ req }) => {
      await acquireTextAdvisoryLocks(payload, req, [`speech-poster:${speechId}`])
      const existing = await findSpeechPosterMedia(payload, speechId, req)
      if (existing) return existing

      return await payload.create({
        collection: 'media',
        data: { alt: `Quadro do meio da fala de ${formatSpeechDate(speech.speechAt)}` },
        filePath: outputPath,
        // Intentional admin bypass: the stored file is the speech's cache entry.
        overrideAccess: true,
        req,
      })
    })
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    release()
  }
}

/**
 * Returns the cached frame of a speech, generating it on the first miss. Never
 * throws: a failure (or an excerpt the Câmara cannot resolve right now)
 * degrades to the YouTube cover (the caller's fallback) and is memoized for a
 * short while so one bad speech cannot retry on every view.
 */
export const ensureSpeechPoster = async (
  payload: Payload,
  speechId: number,
): Promise<Media | null> => {
  if (!Number.isInteger(speechId) || speechId <= 0) return null

  const failedAt = failures.get(speechId)
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_TTL_MS) return null

  const cached = await findSpeechPosterMedia(payload, speechId)
  if (cached) return cached

  const running = inFlight.get(speechId)
  if (running) return running

  const generation = generateSpeechPoster(payload, speechId)
    .then((media) => {
      if (!media) rememberFailure(speechId)
      return media
    })
    .catch((error: unknown) => {
      rememberFailure(speechId)
      console.warn(`[speech-poster] fala ${speechId}: ${messageOf(error, FAILURE_FALLBACK)}`)
      return null
    })
    .finally(() => {
      inFlight.delete(speechId)
    })

  inFlight.set(speechId, generation)
  return generation
}
