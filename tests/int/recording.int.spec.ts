// @vitest-environment node

import { fileURLToPath } from 'node:url'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  // The actions start the job with `after()`, which requires a request scope;
  // the job itself is exercised directly below.
  return { ...actual, after: () => undefined }
})

const { getCampaignUserMock } = vi.hoisted(() => ({ getCampaignUserMock: vi.fn() }))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: getCampaignUserMock,
}))

import { GET } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/[id]/arquivo/route'
import {
  DELETE as abortUploadRoute,
  POST as receiveChunkRoute,
} from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/enviar/[id]/route'
import { POST as startUploadRoute } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/enviar/route'
import {
  deleteRecordingForActor,
  getRecordingStatusesForActor,
  labelRecordingSpeakerForActor,
  retryRecordingForActor,
} from '@/app/(campaign)/campanha/actions/recording'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE,
  RECORDING_CHUNK_TOO_LARGE_MESSAGE,
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_SPEAKER_UNKNOWN_MESSAGE,
  RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE,
} from '@/lib/schemas/recording'
import { normalizeForSearch } from '@/lib/speechSearch'
import type { CampaignUser, RecordingMedia } from '@/payload-types'
import config from '@/payload.config'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { classifyRecordingFacets } from '@/utilities/recordings/recordingClassification'
import {
  reapStaleRecording,
  RECORDING_STALE_MS,
  runRecordingJob,
} from '@/utilities/recordings/recordingJob'
import {
  loadRecordingFilterOptions,
  loadRecordingsPageData,
} from '@/utilities/recordings/recordingPageData'
import { receiveRecordingChunk, startRecordingUpload } from '@/utilities/recordings/recordingUpload'
import {
  createRecordingUploadSession,
  readRecordingUploadSession,
} from '@/utilities/recordings/recordingUploadSession'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const FAKE_FFMPEG = fileURLToPath(new URL('../fixtures/fake-ffmpeg.mjs', import.meta.url))

const VIDEO_BYTES = Buffer.from('fixture-recording-bytes')

let payload: Payload
const createdRecordingIds = new Set<number>()
const createdMediaIds = new Set<number>()

const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const withEnv = (key: string, value: string | undefined): (() => void) => {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  return () => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

const createMedia = async (
  name: string,
  data: Buffer = VIDEO_BYTES,
  mimetype = 'video/mp4',
): Promise<RecordingMedia> => {
  const media = await payload.create({
    collection: 'recordingMedia',
    data: { alt: `Arquivo ${name}` },
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media
}

const createRecording = async ({
  status = 'ready',
  title = 'Plenária da Comissão',
  segments = [],
  speakerLabels,
  withMedia = true,
  recordedAt,
  durationSeconds,
  topics,
  scopes,
  classifiedBy,
  mentionedMunicipalities,
}: {
  status?: 'uploading' | 'processing' | 'ready' | 'failed'
  title?: string
  segments?: {
    startSeconds: number
    endSeconds: number
    text: string
    speakerKey?: string | null
  }[]
  speakerLabels?: { speakerKey: string; label: string }[]
  withMedia?: boolean
  recordedAt?: string
  durationSeconds?: number
  topics?: ('saude' | 'cultura' | 'educacao')[]
  scopes?: ('bahia' | 'brasil' | 'internacional')[]
  classifiedBy?: 'gazetteer' | 'llm' | 'manual'
  mentionedMunicipalities?: number[]
} = {}) => {
  const media = withMedia ? await createMedia(`${title}.mp4`) : null
  const recording = await payload.create({
    collection: 'recording',
    data: {
      title,
      status,
      ...(media ? { media: media.id } : {}),
      ...(speakerLabels ? { speakerLabels } : {}),
      ...(recordedAt ? { recordedAt } : {}),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      ...(topics ? { topics } : {}),
      ...(scopes ? { scopes } : {}),
      ...(classifiedBy ? { classifiedBy } : {}),
      ...(mentionedMunicipalities ? { mentionedMunicipalities } : {}),
    },
    overrideAccess: true,
  })
  createdRecordingIds.add(recording.id)

  for (const [index, segment] of segments.entries()) {
    await payload.create({
      collection: 'recordingSegment',
      data: hookFilledCreateData<'recordingSegment'>({
        recording: recording.id,
        order: index + 1,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        text: segment.text,
        speakerKey: segment.speakerKey ?? null,
      }),
      overrideAccess: true,
    })
  }
  if (segments.length > 0) {
    await payload.update({
      collection: 'recording',
      id: recording.id,
      data: { searchText: normalizeForSearch(segments.map((segment) => segment.text).join(' ')) },
      overrideAccess: true,
    })
  }

  return { recording, media }
}

const callFileRoute = async ({
  recordingId,
  user,
  range,
  download,
}: {
  recordingId: number
  user?: CampaignUser | null
  range?: string
  download?: boolean
}): Promise<Response> => {
  getCampaignUserMock.mockResolvedValue(user ?? null)
  const request = new Request(
    `http://localhost/campanha/comunicacao/acervo/gravacoes/${recordingId}/arquivo${download ? '?download=1' : ''}`,
    { headers: range ? { range } : undefined },
  )
  return GET(request, { params: Promise.resolve({ id: String(recordingId) }) })
}

describe('uploaded recordings (C199)', () => {
  let communicator: CampaignUser
  let coordinator: CampaignUser
  let candidate: CampaignUser
  let advisor: CampaignUser
  let leader: CampaignUser

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(async () => {
    const fixtures = campaignFixtures()
    ;[communicator, coordinator, candidate, advisor, leader] = await Promise.all([
      fixtures.createCampaignUser('communicator'),
      fixtures.createCampaignUser('coordinator'),
      fixtures.createCampaignUser('candidate'),
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('leader'),
    ])
    getCampaignUserMock.mockReset()
  })

  afterAll(async () => {
    for (const id of createdRecordingIds) {
      await payload
        .delete({ collection: 'recording', id, overrideAccess: true })
        .catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload
        .delete({ collection: 'recordingMedia', id, overrideAccess: true })
        .catch(() => undefined)
    }
  })

  it('reads recordings only with the communication roles', async () => {
    const { recording } = await createRecording()

    const readAs = (user?: CampaignUser) =>
      payload.find({
        collection: 'recording',
        where: { id: { equals: recording.id } },
        depth: 0,
        limit: 1,
        ...(user ? { user } : {}),
        overrideAccess: false,
      })

    await expect(readAs()).rejects.toThrow()
    await expect(readAs(advisor)).rejects.toThrow()
    await expect(readAs(leader)).rejects.toThrow()
    expect((await readAs(communicator)).docs).toHaveLength(1)
    expect((await readAs(coordinator)).docs).toHaveLength(1)
    expect((await readAs(candidate)).docs).toHaveLength(1)
  })

  it('stamps the actor on the create path', async () => {
    const recording = await payload.create({
      collection: 'recording',
      data: { title: 'Plenária com carimbo', status: 'uploading' },
      depth: 0,
      user: communicator,
      overrideAccess: false,
    })
    createdRecordingIds.add(recording.id)

    expect(recording.createdBy).toBe(communicator.id)
  })

  it('serves the file once the upload finished and hides it while uploading', async () => {
    const ready = await createRecording({ status: 'ready' })
    const processing = await createRecording({ status: 'processing' })
    const failed = await createRecording({ status: 'failed' })
    const uploading = await createRecording({ status: 'uploading', withMedia: false })

    for (const recording of [ready.recording, processing.recording, failed.recording]) {
      const response = await callFileRoute({ recordingId: recording.id, user: communicator })
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('video/mp4')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES)
    }

    expect(
      (await callFileRoute({ recordingId: uploading.recording.id, user: communicator })).status,
    ).toBe(404)
  })

  it('answers a byte range with 206 and forces download with ?download=1', async () => {
    const { recording } = await createRecording()

    const partial = await callFileRoute({
      recordingId: recording.id,
      user: coordinator,
      range: 'bytes=0-3',
    })
    expect(partial.status).toBe(206)
    expect(partial.headers.get('Content-Range')).toBe(`bytes 0-3/${VIDEO_BYTES.length}`)
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(VIDEO_BYTES.subarray(0, 4))

    const download = await callFileRoute({
      recordingId: recording.id,
      user: coordinator,
      download: true,
    })
    expect(download.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('denies anonymous, advisor and leader with a silent 404', async () => {
    const { recording } = await createRecording()

    for (const user of [undefined, advisor, leader]) {
      expect((await callFileRoute({ recordingId: recording.id, user })).status).toBe(404)
    }
  })

  it('deletes the transcript in cascade with the recording', async () => {
    const { recording } = await createRecording({
      segments: [{ startSeconds: 0, endSeconds: 4, text: 'Primeiro trecho' }],
    })

    await payload.delete({ collection: 'recording', id: recording.id, overrideAccess: true })
    createdRecordingIds.delete(recording.id)

    const segments = await payload.find({
      collection: 'recordingSegment',
      where: { recording: { equals: recording.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(segments.docs).toHaveLength(0)
  })

  const streamOf = (bytes: Buffer): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })

  it('receives a recording in ordered parts and hands the row to the job on the last one', async () => {
    const chunks = [Buffer.from('part-'), Buffer.from('by-pa'), Buffer.from('rt')]
    const bytes = Buffer.concat(chunks)
    const scheduled: number[] = []

    const { id } = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Giro pelo interior',
        filename: 'giro interior.m4v',
        recordedAt: undefined,
        size: bytes.length,
      },
    })
    createdRecordingIds.add(id)

    // The row is visible as `uploading` right after the start, before any part.
    const started = await payload.findByID({
      collection: 'recording',
      id,
      depth: 0,
      overrideAccess: true,
    })
    expect(started.status).toBe('uploading')
    expect(started.title).toBe('Giro pelo interior')

    const receive = (index: number, body: Buffer) =>
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: id,
        index,
        body: streamOf(body),
        chunkSize: chunks[0].length,
        startJob: (recordingId) => scheduled.push(recordingId),
      })

    await expect(receive(0, chunks[0])).resolves.toEqual({ done: false })
    await expect(receive(1, chunks[1])).resolves.toEqual({ done: false })
    await expect(receive(2, chunks[2])).resolves.toEqual({ done: true })

    const recording = await payload.findByID({
      collection: 'recording',
      id,
      depth: 1,
      overrideAccess: true,
    })
    expect(recording.status).toBe('processing')
    expect(recording.step).toBe('extracting')
    const createdBy =
      typeof recording.createdBy === 'number' ? recording.createdBy : recording.createdBy?.id
    expect(createdBy).toBe(communicator.id)
    expect(scheduled).toEqual([id])

    const media = recording.media
    expect(media && typeof media === 'object').toBe(true)
    if (media && typeof media === 'object') {
      createdMediaIds.add(media.id)
      expect(media.filename).toContain('giro_interior')
      expect(media.filesize).toBe(bytes.length)
    }

    // The temp session is gone once the upload was committed.
    await expect(readRecordingUploadSession(id)).resolves.toBeNull()

    const response = await callFileRoute({ recordingId: id, user: communicator })
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  })

  it('serves the chunked upload wire contract through the two routes', async () => {
    const bytes = Buffer.from('rota-fatiada')
    getCampaignUserMock.mockResolvedValue(communicator)

    const params = new URLSearchParams({
      title: 'Via rota',
      filename: 'via rota.mp4',
      size: String(bytes.length),
    })
    const startResponse = await startUploadRoute(
      new Request(
        `http://localhost/campanha/comunicacao/acervo/gravacoes/enviar?${params.toString()}`,
        { method: 'POST' },
      ),
    )
    expect(startResponse.status).toBe(200)
    const started = (await startResponse.json()) as {
      status: string
      recording: { id: number; status: string }
      chunkSize: number
    }
    expect(started.status).toBe('success')
    expect(started.recording.status).toBe('uploading')
    expect(started.chunkSize).toBeGreaterThan(0)
    createdRecordingIds.add(started.recording.id)

    const chunkResponse = await receiveChunkRoute(
      new Request(
        `http://localhost/campanha/comunicacao/acervo/gravacoes/enviar/${started.recording.id}?index=0`,
        { method: 'POST', body: bytes },
      ),
      { params: Promise.resolve({ id: String(started.recording.id) }) },
    )
    expect(chunkResponse.status).toBe(200)
    const done = (await chunkResponse.json()) as {
      status: string
      done: boolean
      recording: { id: number; status: string }
    }
    expect(done.status).toBe('success')
    expect(done.done).toBe(true)
    expect(done.recording.status).toBe('processing')

    const recording = await payload.findByID({
      collection: 'recording',
      id: started.recording.id,
      depth: 1,
      overrideAccess: true,
    })
    if (recording.media && typeof recording.media === 'object') {
      createdMediaIds.add(recording.media.id)
    }
  })

  it('aborts an in-flight upload and never touches a finalized recording', async () => {
    const bytes = Buffer.from('abortar')
    getCampaignUserMock.mockResolvedValue(communicator)

    const aborted = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Abortada',
        filename: 'abortada.mp4',
        recordedAt: undefined,
        size: bytes.length,
      },
    })
    createdRecordingIds.add(aborted.id)

    const abortResponse = await abortUploadRoute(
      new Request(`http://localhost/campanha/comunicacao/acervo/gravacoes/enviar/${aborted.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: String(aborted.id) }) },
    )
    expect(abortResponse.status).toBe(200)
    expect(await abortResponse.json()).toEqual({ status: 'success', aborted: true })

    const rows = await payload.find({
      collection: 'recording',
      where: { id: { equals: aborted.id } },
      overrideAccess: true,
    })
    expect(rows.docs).toHaveLength(0)
    await expect(readRecordingUploadSession(aborted.id)).resolves.toBeNull()

    // A finalized recording survives a stray abort (e.g. the dialog losing the
    // response of the part that completed the upload).
    const kept = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Mantida',
        filename: 'mantida.mp4',
        recordedAt: undefined,
        size: bytes.length,
      },
    })
    createdRecordingIds.add(kept.id)
    await receiveRecordingChunk({
      payload,
      actor: communicator,
      recordingId: kept.id,
      index: 0,
      body: streamOf(bytes),
      chunkSize: bytes.length,
      startJob: () => undefined,
    })

    const stray = await abortUploadRoute(
      new Request(`http://localhost/campanha/comunicacao/acervo/gravacoes/enviar/${kept.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: String(kept.id) }) },
    )
    expect(stray.status).toBe(200)
    const keptRow = await payload.findByID({
      collection: 'recording',
      id: kept.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(keptRow.status).toBe('processing')
    if (keptRow.media && typeof keptRow.media === 'object') {
      createdMediaIds.add(keptRow.media.id)
    }
  })

  it('refuses a part out of order and discards the session', async () => {
    const { id } = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: { title: 'Fora de ordem', filename: 'ordem.mp4', recordedAt: undefined, size: 10 },
    })
    createdRecordingIds.add(id)

    await expect(
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: id,
        index: 3,
        body: streamOf(Buffer.from('xxxxx')),
        chunkSize: 5,
      }),
    ).rejects.toThrow(RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE)

    // A refused part aborts the whole session: no phantom "Enviando" row and
    // no temp file left behind.
    const rows = await payload.find({
      collection: 'recording',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(rows.docs).toHaveLength(0)
    await expect(readRecordingUploadSession(id)).resolves.toBeNull()
  })

  it('refuses a part bigger than the agreed part size or beyond the declared size', async () => {
    const { id } = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: { title: 'Além do teto', filename: 'alem.mp4', recordedAt: undefined, size: 8 },
    })
    createdRecordingIds.add(id)

    await expect(
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: id,
        index: 0,
        body: streamOf(Buffer.alloc(6)),
        chunkSize: 5,
      }),
    ).rejects.toThrow(RECORDING_CHUNK_TOO_LARGE_MESSAGE)

    const restarted = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Além do declarado',
        filename: 'declarado.mp4',
        recordedAt: undefined,
        size: 8,
      },
    })
    createdRecordingIds.add(restarted.id)

    await expect(
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: restarted.id,
        index: 0,
        body: streamOf(Buffer.from('12345')),
        chunkSize: 5,
      }),
    ).resolves.toEqual({ done: false })
    await expect(
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: restarted.id,
        index: 1,
        body: streamOf(Buffer.from('67890')),
        chunkSize: 5,
      }),
    ).rejects.toThrow(RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE)
  })

  it('accepts a recording above the payload buffer boundary through the multipart seam', async () => {
    const bytes = Buffer.from('plenaria-de-horas')
    const scheduled: number[] = []
    const uploaded: { filename?: string; filesize: number }[] = []
    const removed: string[] = []

    const { id } = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Sessão longa',
        filename: 'sessao longa.MP4',
        recordedAt: undefined,
        size: bytes.length,
      },
    })
    createdRecordingIds.add(id)

    const { done } = await receiveRecordingChunk({
      payload,
      actor: communicator,
      recordingId: id,
      index: 0,
      body: streamOf(bytes),
      largeThresholdBytes: 0,
      startJob: (recordingId) => scheduled.push(recordingId),
      uploadLarge: async ({ filename }) => {
        uploaded.push({ filename, filesize: bytes.length })
        return {
          filename: filename ?? 'sessao_longa.MP4',
          mimeType: 'video/mp4',
          filesize: bytes.length,
          url: 'http://127.0.0.1:3900/teqo-media/sessao_longa.MP4',
        }
      },
      removeLarge: async ({ filename }) => {
        removed.push(filename)
      },
    })
    expect(done).toBe(true)

    const recording = await payload.findByID({
      collection: 'recording',
      id,
      depth: 1,
      overrideAccess: true,
    })
    expect(recording.status).toBe('processing')
    expect(recording.step).toBe('extracting')
    expect(scheduled).toEqual([id])

    const media = recording.media
    expect(media && typeof media === 'object').toBe(true)
    if (media && typeof media === 'object') {
      createdMediaIds.add(media.id)
      // The original file name survives the placeholder (never the placeholder name).
      expect(media.filename).toContain('sessao_longa')
      expect(media.filesize).toBe(bytes.length)
      expect(media.mimeType).toBe('video/mp4')
      expect(uploaded).toEqual([{ filename: media.filename, filesize: bytes.length }])
    }
    expect(removed).toEqual([])
  })

  it('removes the multipart object and leaves no phantom row when the large upload fails', async () => {
    const removed: string[] = []
    const { id } = await startRecordingUpload({
      payload,
      actor: communicator,
      metadata: {
        title: 'Grande que falha',
        filename: 'falha.mp4',
        recordedAt: undefined,
        size: 12,
      },
    })
    createdRecordingIds.add(id)

    await expect(
      receiveRecordingChunk({
        payload,
        actor: communicator,
        recordingId: id,
        index: 0,
        body: streamOf(Buffer.from('falha-grande')),
        largeThresholdBytes: 0,
        startJob: () => undefined,
        uploadLarge: async () => {
          throw new Error('S3 indisponível.')
        },
        removeLarge: async ({ filename }) => {
          removed.push(filename)
        },
      }),
    ).rejects.toThrow('S3 indisponível.')

    const rows = await payload.find({
      collection: 'recording',
      where: { title: { equals: 'Grande que falha' } },
      overrideAccess: true,
    })
    expect(rows.docs).toHaveLength(0)
    expect(removed).toHaveLength(1)
    expect(removed[0]).toContain('falha')
    await expect(readRecordingUploadSession(id)).resolves.toBeNull()
  })

  it('preserves a long recording transcript and its search text', async () => {
    const longText = 'texto da gravação '.repeat(3_000)
    const { recording } = await createRecording({
      segments: [{ startSeconds: 0, endSeconds: 120, text: longText }],
    })

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    const segments = await payload.find({
      collection: 'recordingSegment',
      where: { recording: { equals: recording.id } },
      depth: 0,
      overrideAccess: true,
    })

    expect(updated.searchText).toBe(normalizeForSearch(longText))
    expect(segments.docs[0]?.text).toBe(longText)
    expect(segments.docs[0]?.searchText).toBe(normalizeForSearch(longText))
  })

  it('runs the transcription job end to end with merged timestamps', async () => {
    const { recording } = await createRecording({
      status: 'processing',
      title: 'Plenária de horas',
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(payload, recording.id, async () => ({
        ok: true,
        segments: [
          { start: 1, end: 4, text: 'Bom dia a todas' },
          { start: 5, end: 9, text: 'e a todos' },
        ],
        durationSeconds: 1_200,
      }))
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    expect(updated.step).toBeNull()
    expect(updated.error).toBeNull()
    // The fake ffmpeg writes two chunks and the injected transcriber answers the
    // same segments for both, so the transcript carries them twice (chunk 2 at
    // the 20-minute offset).
    expect(updated.durationSeconds).toBe(2_400)
    expect(updated.searchText).toBe('bom dia a todas e a todos bom dia a todas e a todos')

    const segments = await payload.find({
      collection: 'recordingSegment',
      where: { recording: { equals: recording.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'order',
      overrideAccess: true,
    })
    expect(segments.docs).toHaveLength(4)
    expect(segments.docs.map((segment) => segment.startSeconds)).toEqual([1, 5, 1201, 1205])
    expect(segments.docs[0]?.searchText).toBe('bom dia a todas')
  })

  it('classifies the transcript with the injected classifier and derives the year', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const catalogEntry = getMunicipalityCatalogEntry(municipality.slug)
    expect(catalogEntry).toBeDefined()

    const { recording } = await createRecording({
      status: 'processing',
      title: 'Plenária sobre saúde',
    })
    await payload.update({
      collection: 'recording',
      id: recording.id,
      data: { recordedAt: '2024-03-10T12:00:00.000Z' },
      overrideAccess: true,
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(
        payload,
        recording.id,
        async () => ({
          ok: true,
          segments: [{ start: 1, end: 4, text: 'Falamos sobre a saúde no município' }],
          durationSeconds: 120,
        }),
        null,
        async (input) => {
          expect(input.transcript).toContain('saúde no município')
          return {
            facets: {
              topics: ['saude'],
              scopes: ['bahia'],
              municipalities: [catalogEntry!],
              people: [],
              programs: [],
              projects: [],
              classifiedBy: 'llm',
            },
            llm: { used: true, totalTokens: 42, estimatedCostUsd: 0.001, error: null },
          }
        },
      )
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    expect(updated.year).toBe(2024)
    expect(updated.topics).toEqual(['saude'])
    expect(updated.scopes).toEqual(['bahia'])
    expect(updated.classifiedBy).toBe('llm')
    expect(updated.mentionedMunicipalities).toEqual([municipality.id])
  })

  it('never overwrites a manual facet curation with the job result', async () => {
    const { recording } = await createRecording({
      status: 'processing',
      title: 'Curadoria manual',
    })
    await payload.update({
      collection: 'recording',
      id: recording.id,
      data: { topics: ['cultura'], scopes: ['brasil'], classifiedBy: 'manual' },
      overrideAccess: true,
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(
        payload,
        recording.id,
        async () => ({
          ok: true,
          segments: [{ start: 1, end: 4, text: 'Falamos sobre saúde' }],
          durationSeconds: 120,
        }),
        null,
        async () => ({
          facets: {
            topics: ['saude'],
            scopes: ['bahia'],
            municipalities: [],
            people: [],
            programs: [],
            projects: [],
            classifiedBy: 'llm',
          },
          llm: { used: true, totalTokens: 10, estimatedCostUsd: 0, error: null },
        }),
      )
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    expect(updated.topics).toEqual(['cultura'])
    expect(updated.scopes).toEqual(['brasil'])
    expect(updated.classifiedBy).toBe('manual')
  })

  it('lets an authenticated actor overwrite a manual curation (the escape hatch)', async () => {
    const { recording } = await createRecording({
      status: 'ready',
      title: 'Curadoria corrigida no admin',
      topics: ['cultura'],
      scopes: ['brasil'],
      classifiedBy: 'manual',
    })

    const updated = await payload.update({
      collection: 'recording',
      id: recording.id,
      data: { topics: ['saude'], scopes: ['bahia'], classifiedBy: 'llm' },
      user: communicator,
      overrideAccess: false,
    })

    expect(updated.topics).toEqual(['saude'])
    expect(updated.scopes).toEqual(['bahia'])
    expect(updated.classifiedBy).toBe('llm')
  })

  it('keeps the transcript and claims no provenance when the classifier throws', async () => {
    const { recording } = await createRecording({
      status: 'processing',
      title: 'Classificador fora do ar',
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(
        payload,
        recording.id,
        async () => ({
          ok: true,
          segments: [{ start: 1, end: 4, text: 'Bom dia a todas' }],
          durationSeconds: 120,
        }),
        null,
        async () => {
          throw new Error('classificador fora do ar')
        },
      )
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    // The fake ffmpeg emits two chunks and the injected transcriber repeats the
    // answer for both, exactly like the end-to-end job test above.
    expect(updated.searchText).toBe('bom dia a todas bom dia a todas')
    expect(updated.classifiedBy).toBeNull()
    expect(updated.topics ?? []).toEqual([])
  })

  it('resolves the gazetteer municipality without the LLM key (degraded provenance)', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const catalogEntry = getMunicipalityCatalogEntry(municipality.slug)
    expect(catalogEntry).toBeDefined()

    const restore = withEnv('DEEPINFRA_API_KEY', undefined)
    try {
      const classification = await classifyRecordingFacets({
        payload,
        transcript: `Falamos em ${catalogEntry!.city} sobre saúde e educação`,
      })
      expect(classification?.classifiedBy).toBe('gazetteer')
      expect(classification?.topics).toEqual(expect.arrayContaining(['saude', 'educacao']))
      expect(classification?.mentionedMunicipalities).toContain(municipality.id)
    } finally {
      restore()
    }
  })

  it('marks a provider failure as failed, preserves the file and retries', async () => {
    const { recording } = await createRecording({ status: 'processing', title: 'Debate' })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(payload, recording.id, async () => ({
        ok: false,
        error: 'Não foi possível transcrever a gravação.',
        status: 502,
      }))
    } finally {
      restore()
    }

    const failed = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(failed.status).toBe('failed')
    expect(failed.step).toBe('transcribing')
    expect(failed.error).toBe('Não foi possível transcrever a gravação.')
    expect(failed.media && typeof failed.media === 'object').toBe(true)

    getCampaignUserMock.mockResolvedValue(communicator)
    const retried = await retryRecordingForActor({ recordingId: recording.id })
    expect(retried.status).toBe('processing')

    await expect(
      retryRecordingForActor({ recordingId: (await createRecording()).recording.id }),
    ).rejects.toThrow('Só é possível reprocessar uma gravação que falhou.')
  })

  it('reaps a processing row abandoned by a restart', async () => {
    const { recording } = await createRecording({ status: 'processing', title: 'Abandonada' })

    const reaped = await reapStaleRecording(payload, {
      id: recording.id,
      status: 'processing',
      updatedAt: new Date(Date.now() - RECORDING_STALE_MS - 60_000).toISOString(),
    })
    expect(reaped).toBe(true)

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('failed')
    expect(updated.error).toBe('O processamento foi interrompido antes de terminar.')

    // A fresh row is never reaped.
    const fresh = await createRecording({ status: 'processing' })
    expect(
      await reapStaleRecording(payload, {
        id: fresh.recording.id,
        status: 'processing',
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(false)

    // An `uploading` row abandoned mid-stream has no usable file: reaped away,
    // and its chunked-upload session dir goes with it.
    const orphan = await createRecording({
      status: 'uploading',
      title: 'Upload interrompido',
      withMedia: false,
    })
    await createRecordingUploadSession(orphan.recording.id, {
      uploadName: 'interrompido.mp4',
      expectedBytes: 1024,
    })
    expect(await readRecordingUploadSession(orphan.recording.id)).not.toBeNull()
    expect(
      await reapStaleRecording(payload, {
        id: orphan.recording.id,
        status: 'uploading',
        updatedAt: new Date(Date.now() - RECORDING_STALE_MS - 60_000).toISOString(),
      }),
    ).toBe(true)
    createdRecordingIds.delete(orphan.recording.id)
    await expect(
      payload.findByID({ collection: 'recording', id: orphan.recording.id, overrideAccess: true }),
    ).rejects.toThrow()
    await expect(readRecordingUploadSession(orphan.recording.id)).resolves.toBeNull()
  })

  it('polls the visible statuses and deletes a recording with its media', async () => {
    const { recording, media } = await createRecording({ status: 'failed', title: 'Para apagar' })
    getCampaignUserMock.mockResolvedValue(communicator)

    const statuses = await getRecordingStatusesForActor({ recordingIds: [recording.id] })
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({ id: recording.id, status: 'failed' })

    await deleteRecordingForActor({ recordingId: recording.id })
    createdRecordingIds.delete(recording.id)

    await expect(
      payload.findByID({ collection: 'recording', id: recording.id, overrideAccess: true }),
    ).rejects.toThrow()
    if (media) {
      // The media cleanup runs after commit, best-effort; poll for it.
      let deleted = false
      for (let attempt = 0; attempt < 20 && !deleted; attempt += 1) {
        deleted = await payload
          .findByID({ collection: 'recordingMedia', id: media.id, overrideAccess: true })
          .then(() => false)
          .catch(() => true)
        if (!deleted) await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect(deleted).toBe(true)
      createdMediaIds.delete(media.id)
    }
  })

  it('finds the spoken excerpt of any person through the recordings search', async () => {
    // A unique term keeps the assertion independent from residue left in the
    // shared test database by earlier runs.
    const marker = `merenda${Date.now().toString(36)}`
    const { recording } = await createRecording({
      title: `Comissão de Educação ${marker}`,
      segments: [
        { startSeconds: 0, endSeconds: 6, text: `A deputada falou sobre a ${marker} escolar.` },
        { startSeconds: 6, endSeconds: 12, text: 'O relator respondeu em seguida.' },
      ],
    })
    await createRecording({ title: 'Outra gravação', segments: [] })

    const data = await loadRecordingsPageData(payload, communicator, {
      source: 'enviadas',
      q: marker,
    })

    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]?.id).toBe(recording.id)
    expect(data.rows[0]?.excerpt?.parts.map((part) => part.text).join('')).toContain(marker)
    expect(data.rows[0]?.watchHref).toContain('t=0')
    expect(data.rows[0]?.watchHref).toContain(`q=${marker}`)

    const unfiltered = await loadRecordingsPageData(payload, communicator, {
      source: 'enviadas',
    })
    expect(unfiltered.rows.length).toBeGreaterThanOrEqual(2)
    expect(unfiltered.rows.every((row) => row.excerpt === null)).toBe(true)
  })

  it('filters recordings by a human label and lists the facet options', async () => {
    const marker = `solla${Date.now().toString(36)}`
    const { recording } = await createRecording({
      title: `Plenária com vozes ${marker}`,
      segments: [
        { startSeconds: 0, endSeconds: 5, text: 'Primeira fala.', speakerKey: 'speaker-1' },
        { startSeconds: 5, endSeconds: 10, text: 'Segunda fala.', speakerKey: 'speaker-2' },
      ],
      speakerLabels: [{ speakerKey: 'speaker-1', label: `Dep. ${marker}` }],
    })
    const { recording: other } = await createRecording({
      title: `Sem falantes ${marker}`,
      segments: [],
    })

    // The facet matches the same way the dialog chip does: case-insensitive
    // containment over the derived names, against the real join table.
    const filtered = await loadRecordingsPageData(payload, communicator, {
      source: 'enviadas',
      person: [`dep. ${marker}`],
    })
    expect(filtered.rows.map((row) => row.id)).toContain(recording.id)
    expect(filtered.rows.map((row) => row.id)).not.toContain(other.id)
    expect(filtered.rows.find((row) => row.id === recording.id)?.matchedPersons).toEqual([
      `dep. ${marker}`,
    ])

    const options = await loadRecordingFilterOptions(payload, communicator)
    expect(options.people).toContain(`Dep. ${marker}`)
  })

  it('filters by the C219 facets and lists their options', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const marker = `facetas${Date.now().toString(36)}`

    const { recording: health } = await createRecording({
      title: `Plenária de saúde ${marker}`,
      recordedAt: '2025-05-04T10:00:00.000Z',
      durationSeconds: 90,
      topics: ['saude'],
      scopes: ['bahia'],
      classifiedBy: 'llm',
      mentionedMunicipalities: [municipality.id],
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Saúde em pauta ${marker}` }],
    })
    const { recording: culture } = await createRecording({
      title: `Debate de cultura ${marker}`,
      recordedAt: '2023-01-01T10:00:00.000Z',
      durationSeconds: 400,
      topics: ['cultura'],
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Cultura em pauta ${marker}` }],
    })
    const { recording: noDuration } = await createRecording({
      title: `Material sem duração ${marker}`,
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Ainda processando ${marker}` }],
    })

    const load = (extra: Record<string, string>) =>
      loadRecordingsPageData(payload, communicator, {
        source: 'enviadas',
        q: marker,
        ...extra,
      })

    expect((await load({ year: '2025' })).rows.map((row) => row.id)).toEqual([health.id])
    expect((await load({ topic: 'saude' })).rows.map((row) => row.id)).toEqual([health.id])
    expect((await load({ scope: 'bahia' })).rows.map((row) => row.id)).toEqual([health.id])
    expect(
      (await load({ municipality: String(municipality.id) })).rows.map((row) => row.id),
    ).toEqual([health.id])
    expect((await load({ duration: 'curta' })).rows.map((row) => row.id)).toEqual([health.id])
    expect((await load({ duration: 'longa' })).rows.map((row) => row.id)).toEqual([culture.id])
    expect((await load({ duration: 'sem_duracao' })).rows.map((row) => row.id)).toEqual([
      noDuration.id,
    ])

    const options = await loadRecordingFilterOptions(payload, communicator)
    expect(options.years).toContain(2025)
    expect(options.municipalities.map((option) => option.value)).toContain(String(municipality.id))
  })

  it('orders by duration only over rows with a measured duration', async () => {
    const marker = `ordem${Date.now().toString(36)}`
    const { recording: short } = await createRecording({
      title: `Curta ${marker}`,
      durationSeconds: 60,
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Trecho ${marker}` }],
    })
    const { recording: long } = await createRecording({
      title: `Longa ${marker}`,
      durationSeconds: 900,
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Trecho ${marker}` }],
    })
    await createRecording({
      title: `Sem duração ${marker}`,
      segments: [{ startSeconds: 0, endSeconds: 5, text: `Trecho ${marker}` }],
    })

    const load = (sort?: string) =>
      loadRecordingsPageData(payload, communicator, {
        source: 'enviadas',
        q: marker,
        ...(sort ? { sort } : {}),
      })

    expect((await load('duracao_maior')).rows.map((row) => row.id)).toEqual([long.id, short.id])
    expect((await load('duracao_menor')).rows.map((row) => row.id)).toEqual([short.id, long.id])
    // The default order keeps every row (the gate only applies to duration orders).
    expect((await load()).rows.length).toBe(3)
  })

  it('searches by theme with the injected expansion and degrades honestly', async () => {
    const marker = `tema${Date.now().toString(36)}`
    const { recording } = await createRecording({
      title: `Merenda ${marker}`,
      segments: [
        { startSeconds: 0, endSeconds: 6, text: `Falamos de alimentação escolar ${marker}.` },
      ],
    })

    const expanded = await loadRecordingsPageData(
      payload,
      communicator,
      { source: 'enviadas', q: 'merenda escolar', mode: 'tema' },
      async (theme) => {
        expect(theme).toBe('merenda escolar')
        return { terms: ['alimentacao escolar'] }
      },
    )
    expect(expanded.themeApplied).toBe(true)
    expect(expanded.themeUnavailable).toBe(false)
    const row = expanded.rows.find((item) => item.id === recording.id)
    expect(row).toBeDefined()
    expect(row?.excerpt?.parts.some((part) => part.highlighted)).toBe(true)

    const degraded = await loadRecordingsPageData(
      payload,
      communicator,
      { source: 'enviadas', q: 'merenda escolar', mode: 'tema' },
      async () => null,
    )
    expect(degraded.themeApplied).toBe(false)
    expect(degraded.themeUnavailable).toBe(true)
    // Honest fallback: the literal phrase does not occur, so the row is out.
    expect(degraded.rows.map((item) => item.id)).not.toContain(recording.id)
  })

  it('labels one cluster through the action and rebuilds the facet names', async () => {
    const marker = `falante${Date.now().toString(36)}`
    const { recording } = await createRecording({
      title: `Debate ${marker}`,
      segments: [{ startSeconds: 0, endSeconds: 5, text: 'Fala única.', speakerKey: 'speaker-1' }],
    })

    getCampaignUserMock.mockResolvedValue(communicator)
    await labelRecordingSpeakerForActor({
      recordingId: recording.id,
      speakerKey: 'speaker-1',
      label: `Dep. ${marker}`,
    })

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.speakerLabels).toEqual([
      expect.objectContaining({ speakerKey: 'speaker-1', label: `Dep. ${marker}` }),
    ])
    expect(updated.speakerNames).toEqual([`Dep. ${marker}`])

    for (const denied of [advisor, leader]) {
      getCampaignUserMock.mockResolvedValue(denied)
      await expect(
        labelRecordingSpeakerForActor({
          recordingId: recording.id,
          speakerKey: 'speaker-1',
          label: 'Quem quer que seja',
        }),
      ).rejects.toThrow(RECORDING_FORBIDDEN_MESSAGE)
    }

    getCampaignUserMock.mockResolvedValue(communicator)
    await expect(
      labelRecordingSpeakerForActor({
        recordingId: recording.id,
        speakerKey: 'speaker-9',
        label: 'Agrupamento fantasma',
      }),
    ).rejects.toThrow(RECORDING_SPEAKER_UNKNOWN_MESSAGE)
  })

  it('groups the transcript with the injected diarizer and keeps a reconcilable label', async () => {
    const { recording } = await createRecording({
      status: 'processing',
      title: 'Plenária com falantes',
      segments: [
        { startSeconds: 1, endSeconds: 4, text: 'Fala anterior A', speakerKey: 'speaker-1' },
        { startSeconds: 5, endSeconds: 9, text: 'Fala anterior B', speakerKey: 'speaker-2' },
      ],
      speakerLabels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }],
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(
        payload,
        recording.id,
        async () => ({
          ok: true,
          segments: [
            { start: 1, end: 4, text: 'Bom dia a todas' },
            { start: 5, end: 9, text: 'e a todos' },
          ],
          durationSeconds: 1_200,
        }),
        async (file, options) => {
          expect(file).toBeInstanceOf(Blob)
          await options?.onProgress?.()
          return {
            ok: true,
            turns: [
              { speaker: 'A', startSeconds: 0, endSeconds: 4.5 },
              { speaker: 'B', startSeconds: 4.5, endSeconds: 10 },
            ],
          }
        },
      )
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    expect(updated.speakerLabels).toEqual([
      expect.objectContaining({ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }),
    ])
    expect(updated.speakerLabelsDropped).toBe(false)

    const segments = await payload.find({
      collection: 'recordingSegment',
      where: { recording: { equals: recording.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'order',
      overrideAccess: true,
    })
    expect(segments.docs).toHaveLength(4)
    expect(segments.docs.map((segment) => segment.speakerKey)).toEqual([
      'speaker-1',
      'speaker-2',
      'speaker-2',
      'speaker-2',
    ])
  })

  it('keeps the plain transcript and warns when the diarizer fails with labels present', async () => {
    const { recording } = await createRecording({
      status: 'processing',
      title: 'Debate sem provedor',
      segments: [{ startSeconds: 1, endSeconds: 4, text: 'Fala', speakerKey: 'speaker-1' }],
      speakerLabels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }],
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runRecordingJob(
        payload,
        recording.id,
        async () => ({
          ok: true,
          segments: [{ start: 1, end: 4, text: 'Fala' }],
          durationSeconds: 600,
        }),
        async () => ({ ok: false, error: 'provider down', status: 502 }),
      )
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'recording',
      id: recording.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.status).toBe('ready')
    expect(updated.speakerLabels ?? []).toEqual([])
    expect(updated.speakerLabelsDropped).toBe(true)

    const segments = await payload.find({
      collection: 'recordingSegment',
      where: { recording: { equals: recording.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'order',
      overrideAccess: true,
    })
    expect(segments.docs.every((segment) => !segment.speakerKey)).toBe(true)
  })
})
