// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// The Media afterChange hook revalidates its document tag, which needs the Next
// runtime — neuter it (the revalidation itself is pinned elsewhere).
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

import { buildSpeechPosterFfmpegArgs, speechPosterFilename } from '@/lib/speechPoster'
import config from '@/payload.config'
import { runFfmpeg } from '@/utilities/media/ffmpeg'
import type { SpeechImportBundle } from '@/utilities/speech/speechImport'
import { upsertSpeechBundle } from '@/utilities/speech/speechImport'
import { ensureSpeechPoster, findSpeechPosterMedia } from '@/utilities/speech/speechPosterJob'

import { camaraVodStub, PLAYBACK_URL } from '../helpers/camaraVodStub'
import { speechBundleFixture } from '../helpers/speechBundleFixture'

const FAKE_FFMPEG = fileURLToPath(new URL('../fixtures/fake-ffmpeg.mjs', import.meta.url))

const hasBinary = (name: string): boolean => spawnSync(name, ['-version']).status === 0
const hasFfmpeg = hasBinary('ffmpeg') && hasBinary('ffprobe')

let payload: Payload
const createdSourceKeys = new Set<string>()
const createdMediaIds = new Set<number>()

const withEnv = (key: string, value: string | undefined): (() => void) => {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  return () => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

/** Stub that records every URL it answered, so cache hits are observable. */
const countingCamaraStub = (options?: Parameters<typeof camaraVodStub>[0]) => {
  const answered: string[] = []
  const base = camaraVodStub(options)
  const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    answered.push(String(input))
    return base(input as RequestInfo, init)
  }) as typeof fetch
  return { stub, answered }
}

const createSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
  const bundle = speechBundleFixture(overrides)
  createdSourceKeys.add(bundle.sourceKey)
  await upsertSpeechBundle(payload, bundle)
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: bundle.sourceKey } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const speech = found.docs[0]
  if (!speech) throw new Error('fixture speech was not created')
  return speech.id
}

describe('speech poster cache (C182)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    for (const mediaId of createdMediaIds) {
      await payload
        .delete({ collection: 'media', id: mediaId, overrideAccess: true })
        .catch(() => undefined)
    }
    for (const sourceKey of createdSourceKeys) {
      const found = await payload.find({
        collection: 'speech',
        where: { sourceKey: { equals: sourceKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      const speech = found.docs[0]
      if (speech) {
        await payload
          .delete({ collection: 'speech', id: speech.id, depth: 0, overrideAccess: true })
          .catch(() => undefined)
      }
    }
  })

  it('generates the frame once, caches it in media and reuses it', async () => {
    const restoreFfmpeg = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    const { stub, answered } = countingCamaraStub()
    vi.stubGlobal('fetch', stub)

    try {
      const speechId = await createSpeech({ durationSeconds: 252 })

      const media = await ensureSpeechPoster(payload, speechId)
      expect(media?.filename).toBe(speechPosterFilename(speechId))
      expect(media?.alt).toContain('meio da fala')
      if (!media) throw new Error('poster was not generated')
      createdMediaIds.add(media.id)

      // The stored file is the fake ffmpeg's copy of the downloaded source.
      expect(readFileSync(resolve(process.cwd(), 'media', media.filename as string))).toEqual(
        Buffer.from('camara-mp4-bytes'),
      )
      const sourceRequests = answered.filter((url) => url === PLAYBACK_URL)
      expect(sourceRequests.length).toBeGreaterThan(0)

      answered.length = 0
      const again = await ensureSpeechPoster(payload, speechId)
      expect(again?.id).toBe(media.id)
      expect(answered).toEqual([])

      const cached = await findSpeechPosterMedia(payload, speechId)
      expect(cached?.id).toBe(media.id)
    } finally {
      restoreFfmpeg()
    }
  })

  it('shares one generation between concurrent requests (single flight)', async () => {
    const restoreFfmpeg = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    const { stub, answered } = countingCamaraStub()
    vi.stubGlobal('fetch', stub)

    try {
      const speechId = await createSpeech({ durationSeconds: 252 })
      const [first, second] = await Promise.all([
        ensureSpeechPoster(payload, speechId),
        ensureSpeechPoster(payload, speechId),
      ])
      if (!first) throw new Error('poster was not generated')
      createdMediaIds.add(first.id)

      // Single flight: both callers share the one resolution of the excerpt
      // (without it the Câmara API would be asked twice).
      expect(second?.id).toBe(first.id)
      expect(answered.filter((url) => url.includes('video-sob-demanda'))).toHaveLength(1)
      const rows = await payload.find({
        collection: 'media',
        where: { filename: { equals: speechPosterFilename(speechId) } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(rows.docs).toHaveLength(1)
    } finally {
      restoreFfmpeg()
    }
  })

  it('memoizes an unresolvable excerpt instead of asking the Câmara on every view', async () => {
    const restoreFfmpeg = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    const { stub, answered } = countingCamaraStub({ apiState: 'INDISPONIVEL' })
    vi.stubGlobal('fetch', stub)

    try {
      const speechId = await createSpeech({ durationSeconds: 252 })

      expect(await ensureSpeechPoster(payload, speechId)).toBeNull()
      expect(answered.length).toBeGreaterThan(0)

      answered.length = 0
      expect(await ensureSpeechPoster(payload, speechId)).toBeNull()
      expect(answered).toEqual([])
    } finally {
      restoreFfmpeg()
    }
  })

  it('returns null when the Câmara cannot resolve the excerpt or has no coordinates', async () => {
    const restoreFfmpeg = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    vi.stubGlobal('fetch', camaraVodStub({ apiState: 'INDISPONIVEL' }))

    try {
      const unavailable = await createSpeech({ durationSeconds: 252 })
      expect(await ensureSpeechPoster(payload, unavailable)).toBeNull()
      expect(await findSpeechPosterMedia(payload, unavailable)).toBeNull()

      vi.stubGlobal('fetch', camaraVodStub())
      const noCoordinates = await createSpeech({
        eventId: null,
        audioId: null,
        excerptTMs: null,
      })
      expect(await ensureSpeechPoster(payload, noCoordinates)).toBeNull()
    } finally {
      restoreFfmpeg()
    }
  })

  it('never caches a frame for an unknown speech id', async () => {
    vi.stubGlobal('fetch', camaraVodStub())
    expect(await ensureSpeechPoster(payload, -1)).toBeNull()
    expect(await ensureSpeechPoster(payload, Number.NaN)).toBeNull()
  })

  it.skipIf(!hasFfmpeg)('extracts a real JPEG with ffmpeg at the speech midpoint', async () => {
    const dir = resolve(process.cwd(), 'tests', '.tmp-poster')
    const restoreFfmpeg = withEnv('FFMPEG_PATH', undefined)
    try {
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(dir, { recursive: true })
      const source = join(dir, 'source.mp4')
      const output = join(dir, 'poster.jpg')
      const generated = spawnSync(
        'ffmpeg',
        [
          '-nostdin',
          '-hide_banner',
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=320x240:rate=10:duration=4',
          source,
        ],
        { encoding: 'utf8' },
      )
      expect(generated.status).toBe(0)

      await runFfmpeg(
        buildSpeechPosterFfmpegArgs({ inputPath: source, outputPath: output, atSeconds: 2 }),
        4,
      )

      const bytes = readFileSync(output)
      expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
    } finally {
      restoreFfmpeg()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
