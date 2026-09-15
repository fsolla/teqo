// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/utilities/speech/speechCutScheduler', () => ({
  startSpeechCutJobInBackground: vi.fn(),
}))

// The SpeechCut afterChange hook revalidates its document tag, which needs the
// Next runtime — neuter it (the revalidation itself is pinned elsewhere).
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

vi.mock('@/utilities/campaignActionContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/campaignActionContext')>()
  return { ...original, getCampaignActionContext: vi.fn() }
})

import {
  getSpeechCutStatusForActor,
  saveSpeechCutForActor,
  suggestSpeechCutMetadataForActor,
} from '@/app/(campaign)/campanha/actions/speech'
import { SPEECH_CUT_FORBIDDEN_MESSAGE } from '@/lib/schemas/speechCut'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  reapStaleSpeechCut,
  runSpeechCutJob,
  SPEECH_CUT_STALE_MS,
} from '@/utilities/speech/speechCutJob'
import { startSpeechCutJobInBackground } from '@/utilities/speech/speechCutScheduler'
import { upsertSpeechBundle, type SpeechImportBundle } from '@/utilities/speech/speechImport'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { speechBundleFixture } from '../helpers/speechBundleFixture'

const FAKE_FFMPEG = fileURLToPath(new URL('../fixtures/fake-ffmpeg.mjs', import.meta.url))
const PLAYBACK_URL = 'https://cdn.camara.leg.br/trecho.mp4'
const DOWNLOAD_URL = 'https://cdn.camara.leg.br/trecho-download.mp4'
const MP4_BYTES = Buffer.from('camara-mp4-bytes')

const hasBinary = (name: string): boolean => spawnSync(name, ['-version']).status === 0
const hasFfmpeg = hasBinary('ffmpeg') && hasBinary('ffprobe')

let payload: Payload
const createdSourceKeys = new Set<string>()
const createdCutIds = new Set<number>()
const createdMediaIds = new Set<number>()
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const mockedGetContext = vi.mocked(getCampaignActionContext)
const mockedStartJob = vi.mocked(startSpeechCutJobInBackground)

const camaraFetchStub = (bytes: Buffer): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('video-sob-demanda')) {
      return new Response(
        JSON.stringify({
          estado: 'PRONTO',
          video: { linkParaReproducao: PLAYBACK_URL, linkParaDownload: DOWNLOAD_URL },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (url === PLAYBACK_URL || url === DOWNLOAD_URL) {
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) },
      })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  }) as typeof fetch

const createSpeech = async (overrides: Partial<SpeechImportBundle> = {}): Promise<number> => {
  const bundle = speechBundleFixture({
    vodPlaybackUrl: PLAYBACK_URL,
    vodDownloadUrl: DOWNLOAD_URL,
    ...overrides,
  })
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

const createCut = async (data: {
  speech: number
  startSeconds: number
  endSeconds: number
  status?: 'processing' | 'published' | 'unpublished' | 'failed'
  createdBy?: number
}): Promise<number> => {
  const cut = await payload.create({
    collection: 'speechCut',
    data: {
      speech: data.speech,
      startSeconds: data.startSeconds,
      endSeconds: data.endSeconds,
      durationSeconds: data.endSeconds - data.startSeconds,
      title: `Corte ${randomUUID().slice(0, 8)}`,
      description: 'Descrição do corte',
      status: data.status ?? 'processing',
      ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    },
    depth: 0,
    overrideAccess: true,
  })
  createdCutIds.add(cut.id)
  return cut.id
}

const createUsers = async () => {
  const fixtures = campaignFixtures()
  const [communicator, coordinator, candidate, advisor, leader] = await Promise.all([
    fixtures.createCampaignUser('communicator'),
    fixtures.createCampaignUser('coordinator'),
    fixtures.createCampaignUser('candidate'),
    fixtures.createCampaignUser('advisor'),
    fixtures.createCampaignUser('leader'),
  ])
  return { communicator, coordinator, candidate, advisor, leader }
}

const findCutsAs = (user: CampaignUser | undefined, ids: readonly number[]) =>
  payload.find({
    collection: 'speechCut',
    where: { id: { in: [...ids] } },
    depth: 0,
    limit: 0,
    pagination: false,
    ...(user ? { user } : {}),
    overrideAccess: false,
  })

const asActor = (actor: CampaignUser) => mockedGetContext.mockResolvedValue({ payload, actor })

const withFfmpegPath = (value: string | undefined): (() => void) => {
  const previous = process.env.FFMPEG_PATH
  if (value === undefined) delete process.env.FFMPEG_PATH
  else process.env.FFMPEG_PATH = value
  return () => {
    if (previous === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = previous
  }
}

describe('speech cuts (C167)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    mockedGetContext.mockReset()
    mockedStartJob.mockReset()
  })

  afterAll(async () => {
    for (const mediaId of createdMediaIds) {
      await payload
        .delete({ collection: 'media', id: mediaId, overrideAccess: true })
        .catch(() => undefined)
    }
    for (const cutId of createdCutIds) {
      await payload
        .delete({ collection: 'speechCut', id: cutId, overrideAccess: true })
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

  it('exposes published cuts to anonymous readers and every status to the acervo gate', async () => {
    const speech = await createSpeech()
    const published = await createCut({
      speech,
      startSeconds: 0,
      endSeconds: 20,
      status: 'published',
    })
    const unpublished = await createCut({
      speech,
      startSeconds: 30,
      endSeconds: 50,
      status: 'unpublished',
    })
    const failed = await createCut({ speech, startSeconds: 60, endSeconds: 80, status: 'failed' })
    const ids = [published, unpublished, failed]
    const { communicator, advisor, leader } = await createUsers()

    const anonymous = await findCutsAs(undefined, ids)
    expect(anonymous.docs.map((doc) => doc.id)).toEqual([published])

    const asAdvisor = await findCutsAs(advisor, ids)
    expect(asAdvisor.docs.map((doc) => doc.id)).toEqual([published])

    const asLeader = await findCutsAs(leader, ids)
    expect(asLeader.docs.map((doc) => doc.id)).toEqual([published])

    const asCommunicator = await findCutsAs(communicator, ids)
    expect(asCommunicator.docs).toHaveLength(3)
  })

  it('creates the cut, normalizes the range and dedupes a double submit', async () => {
    const speech = await createSpeech()
    const { communicator } = await createUsers()
    asActor(communicator)

    const first = await saveSpeechCutForActor({
      speechId: speech,
      startSeconds: 43,
      endSeconds: 118,
      title: 'Acesso a medicamentos',
      description: 'Trecho do pronunciamento',
    })

    expect(first.status).toBe('processing')
    expect(first.step).toBe('resolving')
    expect(first.publicPath).toBe(`/corte/${first.id}`)
    expect(first.durationSeconds).toBe(75)
    createdCutIds.add(first.id)
    expect(mockedStartJob).toHaveBeenCalledTimes(1)

    const second = await saveSpeechCutForActor({
      speechId: speech,
      startSeconds: 43,
      endSeconds: 118,
      title: 'Outro título',
      description: 'Outra descrição',
    })
    expect(second.id).toBe(first.id)
    expect(mockedStartJob).toHaveBeenCalledTimes(1)
  })

  it('rejects a selection on a speech too short and denies advisor/leader fail-closed', async () => {
    const shortSpeech = await createSpeech({ durationSeconds: 3 })
    const speech = await createSpeech()
    const { communicator, advisor, leader } = await createUsers()

    asActor(communicator)
    await expect(
      saveSpeechCutForActor({
        speechId: shortSpeech,
        startSeconds: 0,
        endSeconds: 5,
        title: 't',
        description: 'd',
      }),
    ).rejects.toThrow(/5 a 180/)

    for (const denied of [advisor, leader]) {
      asActor(denied)
      await expect(
        saveSpeechCutForActor({
          speechId: speech,
          startSeconds: 0,
          endSeconds: 30,
          title: 't',
          description: 'd',
        }),
      ).rejects.toThrow(SPEECH_CUT_FORBIDDEN_MESSAGE)
    }
  })

  it('retries only a failed row, reusing the same id', async () => {
    const speech = await createSpeech()
    const { communicator } = await createUsers()
    const failed = await createCut({
      speech,
      startSeconds: 10,
      endSeconds: 40,
      status: 'failed',
      createdBy: communicator.id,
    })
    const published = await createCut({
      speech,
      startSeconds: 60,
      endSeconds: 90,
      status: 'published',
    })
    asActor(communicator)

    const retried = await saveSpeechCutForActor({ retryOf: failed })
    expect(retried.id).toBe(failed)
    expect(retried.status).toBe('processing')
    expect(retried.step).toBe('resolving')
    expect(mockedStartJob).toHaveBeenCalledTimes(1)

    await expect(saveSpeechCutForActor({ retryOf: published })).rejects.toThrow(/corte que falhou/)
  })

  it('reports the status through the poll and reaps a stale processing row', async () => {
    const speech = await createSpeech()
    const { communicator } = await createUsers()
    const cutId = await createCut({ speech, startSeconds: 0, endSeconds: 30 })
    asActor(communicator)

    const current = await getSpeechCutStatusForActor({ cutId })
    expect(current.status).toBe('processing')

    const reaped = await reapStaleSpeechCut(payload, {
      id: cutId,
      status: 'processing',
      updatedAt: new Date(Date.now() - SPEECH_CUT_STALE_MS - 60_000).toISOString(),
    })
    expect(reaped).toBe(true)

    const after = await getSpeechCutStatusForActor({ cutId })
    expect(after.status).toBe('failed')
  })

  it('suggests the deterministic fallback when the AI is unavailable', async () => {
    const speech = await createSpeech()
    const { communicator } = await createUsers()
    asActor(communicator)
    const previousKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    try {
      const suggestion = await suggestSpeechCutMetadataForActor({
        speechId: speech,
        startSeconds: 0,
        endSeconds: 30,
      })
      expect(suggestion.source).toBe('fallback')
      expect(suggestion.title).toBe('Trecho de BREVES COMUNICAÇÕES — 07/02/2023')
      expect(suggestion.description).toBe('Saúde e educação em Feira de Santana.')
    } finally {
      if (previousKey !== undefined) process.env.DEEPSEEK_API_KEY = previousKey
    }
  })

  it('publishes the cut with a fake ffmpeg: media stored, same title, same file', async () => {
    const speech = await createSpeech()
    const cutId = await createCut({ speech, startSeconds: 43, endSeconds: 118 })
    vi.stubGlobal('fetch', camaraFetchStub(MP4_BYTES))
    const restoreFfmpeg = withFfmpegPath(FAKE_FFMPEG)

    try {
      await runSpeechCutJob(payload, cutId)

      const cut = await payload.findByID({
        collection: 'speechCut',
        id: cutId,
        depth: 1,
        overrideAccess: true,
      })
      expect(cut.status).toBe('published')
      expect(cut.step).toBeNull()
      expect(cut.publishedAt).toBeTruthy()
      const media = typeof cut.media === 'object' && cut.media !== null ? cut.media : null
      expect(media).toBeTruthy()
      if (!media) throw new Error('media was not attached')
      createdMediaIds.add(media.id)
      expect(media.filename).toBe(`corte-${cutId}-43-118.mp4`)
      expect(media.alt).toBe(cut.title)
      expect(readFileSync(resolve(process.cwd(), 'media', media.filename as string))).toEqual(
        MP4_BYTES,
      )
    } finally {
      restoreFfmpeg()
      vi.unstubAllGlobals()
    }
  })

  it('fails closed when ffmpeg fails: nothing published, no media', async () => {
    const speech = await createSpeech()
    const cutId = await createCut({ speech, startSeconds: 0, endSeconds: 30 })
    vi.stubGlobal('fetch', camaraFetchStub(MP4_BYTES))
    const restoreFfmpeg = withFfmpegPath(FAKE_FFMPEG)
    const previousFail = process.env.FAKE_FFMPEG_FAIL
    process.env.FAKE_FFMPEG_FAIL = '1'

    try {
      await runSpeechCutJob(payload, cutId)

      const cut = await payload.findByID({
        collection: 'speechCut',
        id: cutId,
        depth: 1,
        overrideAccess: true,
      })
      expect(cut.status).toBe('failed')
      expect(cut.media ?? null).toBeNull()
      expect(cut.publishedAt ?? null).toBeNull()
      expect(cut.error).toBeTruthy()
    } finally {
      if (previousFail === undefined) delete process.env.FAKE_FFMPEG_FAIL
      else process.env.FAKE_FFMPEG_FAIL = previousFail
      restoreFfmpeg()
      vi.unstubAllGlobals()
    }
  })

  describe.skipIf(!hasFfmpeg)('with the real ffmpeg (CI)', () => {
    it('cuts exactly the picked [start, end] window', async () => {
      const workdir = mkdtempSync(join(tmpdir(), 'speech-cut-real-'))
      const source = join(workdir, 'source.mp4')
      const generated = spawnSync(
        'ffmpeg',
        [
          '-nostdin',
          '-hide_banner',
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=30:size=128x72:rate=10',
          '-pix_fmt',
          'yuv420p',
          source,
        ],
        { encoding: 'utf8' },
      )
      expect(generated.status).toBe(0)

      const speech = await createSpeech()
      const cutId = await createCut({ speech, startSeconds: 10, endSeconds: 16 })
      vi.stubGlobal('fetch', camaraFetchStub(readFileSync(source)))
      const restoreFfmpeg = withFfmpegPath(undefined)

      try {
        await runSpeechCutJob(payload, cutId)

        const cut = await payload.findByID({
          collection: 'speechCut',
          id: cutId,
          depth: 1,
          overrideAccess: true,
        })
        expect(cut.status).toBe('published')
        const media = typeof cut.media === 'object' && cut.media !== null ? cut.media : null
        if (!media) throw new Error('media was not attached')
        createdMediaIds.add(media.id)
        expect(media.mimeType).toBe('video/mp4')

        const probe = spawnSync(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            resolve(process.cwd(), 'media', media.filename as string),
          ],
          { encoding: 'utf8' },
        )
        expect(probe.status).toBe(0)
        expect(Number(probe.stdout.trim())).toBeCloseTo(6, 1)
      } finally {
        restoreFfmpeg()
        vi.unstubAllGlobals()
        rmSync(workdir, { recursive: true, force: true })
      }
    })
  })
})
