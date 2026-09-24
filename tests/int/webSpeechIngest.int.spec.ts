// @vitest-environment node

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import { INTERNET_SPEECH_MEDIA_SLUG, type WebSpeechFinding } from '@/lib/webSpeech'
import type { Speech } from '@/payload-types'
import config from '@/payload.config'
import {
  ingestWebSpeech,
  type WebSpeechAcquirer,
  type WebSpeechClassifier,
  type WebSpeechIngestDeps,
  type WebSpeechTranscriber,
} from '@/utilities/speech/webSpeechIngest'

import {
  WEB_SPEECH_JPEG_BYTES as JPEG_BYTES,
  WEB_SPEECH_MP3_BYTES as MP3_BYTES,
  WEB_SPEECH_MP4_BYTES as MP4_BYTES,
} from '../helpers/webSpeechMediaFixture'

// C215 — the ingestion pipeline with injected seams: acquire → transcribe →
// classify → mirror → upsert. The fakes keep it offline; the assertions pin
// idempotency (second run only refreshes metadata), --reprocess, the mirrored
// private file and the honest failure stages.

let payload: Payload
const acquireCalls: string[] = []

// Every key these specs may touch, in both the external-id and the URL form:
// a failed attempt must never leak a row into the retry.
const TEST_SOURCE_KEYS = [
  'web:youtube:abc123',
  'web:youtube:https://www.youtube.com/watch?v=abc123',
  'web:youtube:reproc',
  'web:youtube:https://www.youtube.com/watch?v=reproc',
  'web:youtube:thumb',
  'web:youtube:https://www.youtube.com/watch?v=thumb',
  'web:youtube:thumb-keep',
  'web:youtube:https://www.youtube.com/watch?v=thumb-keep',
  'web:youtube:broken',
  'web:youtube:https://www.youtube.com/watch?v=broken',
  'web:youtube:semvoz',
  'web:youtube:https://www.youtube.com/watch?v=semvoz',
  'web:radio:https://radio.example/entrevista',
]

const cleanup = async (): Promise<void> => {
  await payload.delete({
    collection: 'speech',
    where: { sourceKey: { in: TEST_SOURCE_KEYS } },
    overrideAccess: true,
  })
}

const finding = (overrides: Partial<WebSpeechFinding> = {}): WebSpeechFinding => ({
  platform: 'youtube',
  url: 'https://www.youtube.com/watch?v=abc123',
  publishedAt: '2026-09-20',
  ...overrides,
})

const acquire: WebSpeechAcquirer = async (current, tempDir) => {
  acquireCalls.push(current.url)
  const fileName = 'source.mp4'
  await writeFile(join(tempDir, fileName), MP4_BYTES)
  return {
    fileName,
    metadata: {
      externalId: 'abc123',
      title: 'Título do yt-dlp',
      channel: 'Canal do yt-dlp',
      durationSeconds: 12,
      thumbnailUrl: null,
    },
  }
}

const transcribe: WebSpeechTranscriber = async () => ({
  ok: true,
  segments: [{ start: 0, end: 2.5, text: 'A saúde pública em Feira de Santana' }],
  durationSeconds: 2.5,
})

const classify: WebSpeechClassifier = async () => ({
  facets: {
    topics: ['saude'],
    scopes: ['bahia'],
    municipalities: matchMunicipalityMentions('Feira de Santana'),
    people: [],
    programs: [],
    projects: [],
    classifiedBy: 'gazetteer',
  },
  llm: { used: false, totalTokens: null, estimatedCostUsd: null, error: null },
})

const fakeFfmpeg: WebSpeechIngestDeps['runFfmpeg'] = async (args) => {
  const outputPattern = args.at(-1) ?? ''
  if (!outputPattern.includes('%03d')) throw new Error('fake ffmpeg sem outputPattern')
  await writeFile(outputPattern.replace('%03d', '000'), MP3_BYTES)
}

const deps = (overrides: WebSpeechIngestDeps = {}): WebSpeechIngestDeps => ({
  acquire,
  transcribe,
  classify,
  runFfmpeg: fakeFfmpeg,
  ...overrides,
})

const findBySourceKey = async (sourceKey: string): Promise<Speech | null> => {
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: sourceKey } },
    depth: 1,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

const countSegments = async (speechId: number): Promise<number> =>
  (
    await payload.count({
      collection: 'speechSegment',
      where: { speech: { equals: speechId } },
      overrideAccess: true,
    })
  ).totalDocs

describe('ingestWebSpeech (C215)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  it('ingests one finding end to end and re-running only refreshes metadata', async () => {
    acquireCalls.length = 0
    const current = finding({ externalId: 'abc123', title: 'Título do lote' })
    const sourceKey = 'web:youtube:abc123'

    const first = await ingestWebSpeech(payload, current, { deps: deps() })
    expect(first).toMatchObject({
      sourceKey,
      status: 'created',
      stage: null,
      error: null,
    })
    expect(first.asrSeconds).toBe(2.5)
    expect(first.asrCostUsd).toBeGreaterThan(0)

    const speech = await findBySourceKey(sourceKey)
    expect(speech).toMatchObject({
      origin: 'web',
      platform: 'youtube',
      externalId: 'abc123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      title: 'Título do lote',
      channel: 'Canal do yt-dlp',
      speechAt: '2026-09-20T00:00',
      year: 2026,
      durationSeconds: 3,
      classifiedBy: 'gazetteer',
      topics: ['saude'],
    })
    expect(speech?.searchText).toBe('a saude publica em feira de santana')
    expect(speech?.mentionedMunicipalities?.[0]).toMatchObject({ slug: 'feira-de-santana' })
    const media = typeof speech?.mirroredMedia === 'object' ? speech.mirroredMedia : null
    expect(media?.mimeType).toBe('video/mp4')
    expect(await countSegments(speech?.id ?? 0)).toBe(1)
    expect(acquireCalls).toHaveLength(1)

    const second = await ingestWebSpeech(payload, current, { deps: deps() })
    expect(second.status).toBe('skipped')
    expect(acquireCalls).toHaveLength(1)
    const again = await findBySourceKey(sourceKey)
    expect(again?.id).toBe(speech?.id)
    expect(again?.title).toBe('Título do lote')
    // The metadata-only refresh must never wipe the stored duration/media.
    expect(again?.durationSeconds).toBe(3)
    expect(await countSegments(again?.id ?? 0)).toBe(1)
  })

  it('reprocesses on demand and removes the replaced artifact', async () => {
    acquireCalls.length = 0
    const current = finding({
      externalId: 'reproc',
      url: 'https://www.youtube.com/watch?v=reproc',
    })
    const sourceKey = 'web:youtube:reproc'

    await ingestWebSpeech(payload, current, { deps: deps() })
    const before = await findBySourceKey(sourceKey)
    const previousMediaId =
      typeof before?.mirroredMedia === 'object' ? before.mirroredMedia?.id : null
    expect(previousMediaId).not.toBeNull()

    const result = await ingestWebSpeech(payload, current, { deps: deps(), reprocess: true })
    expect(result.status).toBe('updated')
    expect(acquireCalls).toHaveLength(2)

    const after = await findBySourceKey(sourceKey)
    const nextMediaId = typeof after?.mirroredMedia === 'object' ? after.mirroredMedia?.id : null
    expect(nextMediaId).not.toBe(previousMediaId)

    const previous = await payload
      .findByID({
        collection: INTERNET_SPEECH_MEDIA_SLUG,
        id: previousMediaId ?? 0,
        overrideAccess: true,
      })
      .catch(() => null)
    expect(previous).toBeNull()
  })

  it('mirrors the origin thumbnail when the finding brings one', async () => {
    const current = finding({
      externalId: 'thumb',
      url: 'https://www.youtube.com/watch?v=thumb',
      thumbnailUrl: 'https://i.ytimg.com/vi/thumb/hq.jpg',
    })
    const sourceKey = 'web:youtube:thumb'

    const result = await ingestWebSpeech(payload, current, {
      deps: deps({
        downloadThumbnail: async (_url, destinationPath) => {
          await writeFile(destinationPath, JPEG_BYTES)
        },
      }),
    })
    expect(result.status).toBe('created')

    const speech = await findBySourceKey(sourceKey)
    const thumbnail = typeof speech?.thumbnail === 'object' ? speech.thumbnail : null
    expect(thumbnail?.mimeType).toBe('image/jpeg')
  })

  it('keeps the stored thumbnail when a reprocess cannot fetch a new one', async () => {
    const current = finding({
      externalId: 'thumb-keep',
      url: 'https://www.youtube.com/watch?v=thumb-keep',
      thumbnailUrl: 'https://i.ytimg.com/vi/thumb-keep/hq.jpg',
    })
    const sourceKey = 'web:youtube:thumb-keep'

    await ingestWebSpeech(payload, current, {
      deps: deps({
        downloadThumbnail: async (_url, destinationPath) => {
          await writeFile(destinationPath, JPEG_BYTES)
        },
      }),
    })
    const before = await findBySourceKey(sourceKey)
    const beforeThumbnail = typeof before?.thumbnail === 'object' ? before.thumbnail?.id : null
    expect(beforeThumbnail).not.toBeNull()

    const result = await ingestWebSpeech(payload, current, {
      deps: deps({
        downloadThumbnail: async () => {
          throw new Error('capa indisponível')
        },
      }),
      reprocess: true,
    })
    expect(result.status).toBe('updated')

    const after = await findBySourceKey(sourceKey)
    const afterThumbnail = typeof after?.thumbnail === 'object' ? after.thumbnail?.id : null
    expect(afterThumbnail).toBe(beforeThumbnail)
  })

  it('fails honestly when the acquisition fails, without a ghost row', async () => {
    const current = finding({
      externalId: 'broken',
      url: 'https://www.youtube.com/watch?v=broken',
    })
    const sourceKey = 'web:youtube:broken'

    const result = await ingestWebSpeech(payload, current, {
      deps: deps({
        acquire: async () => {
          throw new Error('yt-dlp falhou no download')
        },
      }),
    })
    expect(result).toMatchObject({ status: 'failed', stage: 'acquisition' })
    expect(result.error).toContain('yt-dlp falhou no download')
    expect(await findBySourceKey(sourceKey)).toBeNull()
  })

  it('fails honestly when the transcription fails', async () => {
    const current = finding({
      externalId: 'semvoz',
      url: 'https://www.youtube.com/watch?v=semvoz',
    })
    const sourceKey = 'web:youtube:semvoz'

    const result = await ingestWebSpeech(payload, current, {
      deps: deps({
        transcribe: async () => ({ ok: false, error: 'Transcrição vazia.', status: 502 }),
      }),
    })
    expect(result).toMatchObject({ status: 'failed', stage: 'transcription' })
    expect(result.error).toContain('Transcrição vazia')
    expect(await findBySourceKey(sourceKey)).toBeNull()
  })

  it('accepts a radio finding with a direct mediaUrl', async () => {
    const current = finding({
      platform: 'radio',
      url: 'https://radio.example/entrevista',
      mediaUrl: 'https://radio.example/entrevista.mp3',
      publishedAt: '2026-09-21',
    })
    const sourceKey = 'web:radio:https://radio.example/entrevista'

    const downloaded: string[] = []
    const result = await ingestWebSpeech(payload, current, {
      deps: deps({
        acquire: async (currentFinding, tempDir) => {
          downloaded.push(currentFinding.mediaUrl ?? '')
          const fileName = 'source.mp3'
          await writeFile(join(tempDir, fileName), MP3_BYTES)
          return { fileName, metadata: null }
        },
      }),
    })
    expect(result.status).toBe('created')
    expect(downloaded).toEqual(['https://radio.example/entrevista.mp3'])

    const speech = await findBySourceKey(sourceKey)
    expect(speech).toMatchObject({
      origin: 'web',
      platform: 'radio',
      sourceUrl: 'https://radio.example/entrevista',
      channel: null,
    })
    const media = typeof speech?.mirroredMedia === 'object' ? speech.mirroredMedia : null
    expect(media?.mimeType).toBe('audio/mpeg')
  })
})
