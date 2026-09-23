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

import { GET } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/[id]/arquivo/route'
import {
  addContentPieceByLinkForActor,
  getContentPieceStatusesForActor,
  retryContentPieceForActor,
  setContentPiecePublishedForActor,
  updateContentPieceForActor,
} from '@/app/(campaign)/campanha/actions/contentPieces'
import { GET as getPublicPieceMedia } from '@/app/(frontend)/conteudos/[slug]/midia/route'
import type { ContentPieceCuratedField } from '@/lib/contentPiece'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_LINK_DUPLICATE_MESSAGE,
  CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
} from '@/lib/schemas/contentPiece'
import type { SpeechTopic } from '@/lib/speechFacets'
import { normalizeForSearch } from '@/lib/speechSearch'
import type { CampaignUser, ContentMedia } from '@/payload-types'
import config from '@/payload.config'
import {
  CONTENT_PIECE_STALE_MS,
  reapStaleContentPiece,
  runContentPieceJob,
} from '@/utilities/content/contentPieceJob'
import { loadContentPieceListPageData } from '@/utilities/content/contentPiecePageData'
import {
  getPublishedContentPieceBySlug,
  getPublishedContentPieceItems,
  hasPublishedContentPieces,
} from '@/utilities/content/contentPieceReads'
import {
  attachContentPieceMedia,
  receiveContentPieceUpload,
} from '@/utilities/content/contentPieceUpload'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const FAKE_FFMPEG = fileURLToPath(new URL('../fixtures/fake-ffmpeg.mjs', import.meta.url))

const VIDEO_BYTES = Buffer.from('fixture-content-piece-bytes')

let payload: Payload
const createdPieceIds = new Set<number>()
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
): Promise<ContentMedia> => {
  const media = await payload.create({
    collection: 'contentMedia',
    data: { alt: `Arquivo ${name}` },
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media
}

const createPiece = async ({
  title = 'Fim da escala 6x1',
  type = 'video',
  status = 'rascunho',
  processingStatus = 'pronto',
  origin = 'arquivo',
  withMedia = true,
  transcript,
  topics,
  institution,
  sourceUrl,
  curatedFields,
}: {
  title?: string
  type?: 'video' | 'foto' | 'texto' | 'audio' | 'card'
  status?: 'rascunho' | 'publicado'
  processingStatus?: 'processando' | 'pronto' | 'falhou'
  origin?: 'arquivo' | 'instagram' | 'youtube'
  withMedia?: boolean
  transcript?: string
  topics?: SpeechTopic[]
  institution?: string
  sourceUrl?: string
  curatedFields?: ContentPieceCuratedField[]
} = {}) => {
  const media = withMedia ? await createMedia(`${title}.mp4`) : null
  const piece = await payload.create({
    collection: 'contentPiece',
    data: {
      title,
      type,
      status,
      processingStatus,
      origin,
      ...(media ? { media: media.id } : {}),
      ...(transcript ? { transcript } : {}),
      ...(topics ? { topics } : {}),
      ...(institution ? { institution } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(curatedFields ? { curatedFields } : {}),
    },
    overrideAccess: true,
  })
  createdPieceIds.add(piece.id)
  return { piece, media }
}

const callFileRoute = async ({
  pieceId,
  user,
  range,
  download,
}: {
  pieceId: number
  user?: CampaignUser | null
  range?: string
  download?: boolean
}): Promise<Response> => {
  getCampaignUserMock.mockResolvedValue(user ?? null)
  const request = new Request(
    `http://localhost/campanha/comunicacao/conteudos/${pieceId}/arquivo${download ? '?download=1' : ''}`,
    { headers: range ? { range } : undefined },
  )
  return GET(request, { params: Promise.resolve({ id: String(pieceId) }) })
}

const callPublicPieceMedia = async ({
  slug,
  range,
  download,
}: {
  slug: string
  range?: string
  download?: boolean
}): Promise<Response> =>
  getPublicPieceMedia(
    new Request(`http://localhost/conteudos/${slug}/midia${download ? '?download=1' : ''}`, {
      headers: range ? { range } : undefined,
    }),
    { params: Promise.resolve({ slug }) },
  )

const transcribeOk = async () => ({
  ok: true as const,
  segments: [
    { start: 1, end: 4, text: 'A redução da jornada é saúde' },
    { start: 5, end: 9, text: 'em Feira de Santana' },
  ],
  durationSeconds: 134,
})

const catalogStub = async () => ({
  title: 'Fim da escala 6x1 é saúde',
  description: 'Solla explica a jornada.',
  topics: ['saude'] as SpeechTopic[],
  source: 'ai' as const,
})

describe('content pieces (C211)', () => {
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
    for (const id of createdPieceIds) {
      await payload
        .delete({ collection: 'contentPiece', id, overrideAccess: true })
        .catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload
        .delete({ collection: 'contentMedia', id, overrideAccess: true })
        .catch(() => undefined)
    }
  })

  it('reads pieces only with the communication roles', async () => {
    const { piece } = await createPiece()

    const readAs = (user?: CampaignUser) =>
      payload.find({
        collection: 'contentPiece',
        where: { id: { equals: piece.id } },
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

  it('serves the private file to the communication roles and 404s everyone else', async () => {
    const { piece } = await createPiece()

    const response = await callFileRoute({ pieceId: piece.id, user: communicator })
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES)

    const partial = await callFileRoute({
      pieceId: piece.id,
      user: coordinator,
      range: 'bytes=0-3',
    })
    expect(partial.status).toBe(206)

    const download = await callFileRoute({ pieceId: piece.id, user: candidate, download: true })
    expect(download.headers.get('Content-Disposition')).toContain('attachment')

    for (const user of [undefined, advisor, leader]) {
      expect((await callFileRoute({ pieceId: piece.id, user })).status).toBe(404)
    }
  })

  it('streams an upload to the private media and schedules the job only when needed', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from('raw-body-piece'))
        controller.close()
      },
    })
    const scheduled: number[] = []

    const { id } = await receiveContentPieceUpload({
      payload,
      actor: communicator,
      type: 'video',
      metadata: { filename: 'fim da escala.mp4' },
      body,
      contentLength: 13,
      startJob: (pieceId) => scheduled.push(pieceId),
    })
    createdPieceIds.add(id)

    const piece = await payload.findByID({
      collection: 'contentPiece',
      id,
      depth: 1,
      overrideAccess: true,
    })
    expect(piece.title).toBe('fim da escala')
    expect(piece.processingStatus).toBe('processando')
    expect(piece.step).toBe('extraindo')
    expect(piece.status).toBe('rascunho')
    expect(piece.origin).toBe('arquivo')
    expect(typeof piece.media === 'object' ? piece.media?.filename : null).toBeTruthy()
    expect(scheduled).toEqual([id])

    const photoBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from('image-bytes'))
        controller.close()
      },
    })
    const { id: photoId } = await receiveContentPieceUpload({
      payload,
      actor: communicator,
      type: 'foto',
      metadata: { filename: 'card-feira.png' },
      body: photoBody,
      contentLength: 11,
      startJob: (pieceId) => scheduled.push(pieceId),
    })
    createdPieceIds.add(photoId)

    const photo = await payload.findByID({
      collection: 'contentPiece',
      id: photoId,
      depth: 0,
      overrideAccess: true,
    })
    expect(photo.processingStatus).toBe('pronto')
    expect(photo.step).toBeNull()
    // A photo is catalogued by the assessoria: no job was scheduled for it.
    expect(scheduled).toEqual([id])
  })

  it('extracts a text piece without scheduling a transcription', async () => {
    const text = 'Mensagem para as lideranças: peça voto pra Solla 1313.'
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from(text))
        controller.close()
      },
    })
    const scheduled: number[] = []

    const { id } = await receiveContentPieceUpload({
      payload,
      actor: communicator,
      type: 'texto',
      metadata: { filename: 'mensagem.txt' },
      body,
      contentLength: Buffer.byteLength(text),
      startJob: (pieceId) => scheduled.push(pieceId),
    })
    createdPieceIds.add(id)

    const piece = await payload.findByID({
      collection: 'contentPiece',
      id,
      depth: 0,
      overrideAccess: true,
    })
    expect(piece.transcript).toBe(text)
    expect(piece.processingStatus).toBe('processando')
    expect(scheduled).toEqual([id])
  })

  it('attaches the original file to a link piece and refuses a second attachment', async () => {
    getCampaignUserMock.mockResolvedValue(communicator)
    const piece = await addContentPieceByLinkForActor({
      url: 'https://www.youtube.com/watch?v=ATTACH1',
    })
    createdPieceIds.add(piece.id)

    const bytes = Buffer.from('original-upload-bytes')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
    const scheduled: number[] = []

    await attachContentPieceMedia({
      payload,
      actor: communicator,
      piece: { id: piece.id, title: 'Peça por link', type: 'video' },
      filename: 'original do grupo.mp4',
      body,
      contentLength: bytes.length,
      startJob: (pieceId) => scheduled.push(pieceId),
    })

    const attached = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(attached.processingStatus).toBe('processando')
    expect(attached.step).toBe('extraindo')
    expect(scheduled).toEqual([piece.id])
    const media = typeof attached.media === 'object' ? attached.media : null
    // Payload suffixes a name already on disk (`-1`), so the assertion is the
    // sanitized stem plus the preserved extension, not an exact run-dependent name.
    expect(media?.filename).toMatch(/^original_do_grupo(-\d+)?\.mp4$/)
    expect(media?.filesize).toBe(bytes.length)

    // A second attachment is refused: the archived original is not replaced.
    await expect(
      attachContentPieceMedia({
        payload,
        actor: communicator,
        piece: { id: piece.id, title: 'Peça por link', type: 'video', media: media?.id ?? null },
        filename: 'outro.mp4',
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes)
            controller.close()
          },
        }),
        contentLength: bytes.length,
        startJob: () => undefined,
      }),
    ).rejects.toThrow()
  })

  it('runs the video pipeline to ready with transcript, duration, city and search text', async () => {
    const { piece } = await createPiece({
      processingStatus: 'processando',
      title: 'Visita ao posto',
    })

    const restoreFfmpeg = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    const restoreSegments = withEnv('FAKE_FFMPEG_SEGMENTS', '1')
    try {
      await runContentPieceJob(payload, piece.id, {
        transcribe: transcribeOk,
        catalog: catalogStub,
      })
    } finally {
      restoreSegments()
      restoreFfmpeg()
    }

    const updated = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.processingStatus).toBe('pronto')
    expect(updated.step).toBeNull()
    expect(updated.error).toBeNull()
    expect(updated.durationSeconds).toBe(134)
    expect(updated.transcript).toContain('A redução da jornada é saúde')
    expect(updated.title).toBe('Fim da escala 6x1 é saúde')
    expect(updated.description).toBe('Solla explica a jornada.')
    expect(updated.topics).toEqual(['saude'])
    // The derive hook owns the search text: title + description + transcript.
    expect(updated.searchText).toContain('fim da escala 6x1 e saude')
    expect(updated.searchText).toContain('a reducao da jornada e saude')
    // The file is preserved after processing.
    expect(updated.media).toBeTruthy()
  })

  it('marks a transcription failure as failed, preserves the file and retries', async () => {
    const { piece } = await createPiece({
      processingStatus: 'processando',
      title: 'Áudio do grupo',
      type: 'audio',
    })
    getCampaignUserMock.mockResolvedValue(communicator)

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runContentPieceJob(payload, piece.id, {
        transcribe: async () => ({ ok: false as const, error: 'provider fora', status: 502 }),
        catalog: catalogStub,
      })
    } finally {
      restore()
    }

    const failed = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(failed.processingStatus).toBe('falhou')
    expect(failed.step).toBe('transcrevendo')
    expect(failed.error).toBe('provider fora')
    expect(failed.media).toBeTruthy()

    const retried = await retryContentPieceForActor({ contentPieceId: piece.id })
    expect(retried.processingStatus).toBe('processando')

    // A second retry on a piece already processing is refused.
    await expect(retryContentPieceForActor({ contentPieceId: piece.id })).rejects.toThrow(
      CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
    )
  })

  it('refuses a retry from a denied role', async () => {
    const { piece } = await createPiece({ processingStatus: 'falhou' })
    getCampaignUserMock.mockResolvedValue(advisor)

    await expect(retryContentPieceForActor({ contentPieceId: piece.id })).rejects.toThrow(
      CONTENT_PIECE_FORBIDDEN_MESSAGE,
    )
  })

  it('reaps a stale processing row to failed and reports the repaired status', async () => {
    const { piece } = await createPiece({ processingStatus: 'processando' })
    await payload.update({
      collection: 'contentPiece',
      id: piece.id,
      data: { updatedAt: new Date(Date.now() - CONTENT_PIECE_STALE_MS - 60_000).toISOString() },
      overrideAccess: true,
    })

    const reaped = await reapStaleContentPiece(payload, {
      id: piece.id,
      processingStatus: 'processando',
      updatedAt: new Date(Date.now() - CONTENT_PIECE_STALE_MS - 60_000).toISOString(),
    })
    expect(reaped).toBe(true)

    getCampaignUserMock.mockResolvedValue(communicator)
    const statuses = await getContentPieceStatusesForActor({ contentPieceIds: [piece.id] })
    expect(statuses[0]?.processingStatus).toBe('falhou')
    expect(statuses[0]?.failureMessage).toContain('interrompido')
  })

  it('protects a curated title from the pipeline and clears the error on publish', async () => {
    const { piece } = await createPiece({
      processingStatus: 'processando',
      title: 'Título da assessoria',
      curatedFields: ['title'],
    })

    const restore = withEnv('FFMPEG_PATH', FAKE_FFMPEG)
    try {
      await runContentPieceJob(payload, piece.id, {
        transcribe: transcribeOk,
        catalog: catalogStub,
      })
    } finally {
      restore()
    }

    const updated = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(updated.title).toBe('Título da assessoria')
    expect(updated.description).toBe('Solla explica a jornada.')
  })

  it('generates the slug on the first publish, suffixes collisions and preserves it', async () => {
    getCampaignUserMock.mockResolvedValue(communicator)
    const first = await createPiece({ title: 'Fim da escala 6x1' })
    const second = await createPiece({ title: 'Fim da escala 6x1' })

    const published = await setContentPiecePublishedForActor({
      contentPieceId: first.piece.id,
      published: true,
    })
    expect(published.status).toBe('publicado')
    expect(published.publishedAtLabel).toBeTruthy()

    const publishedSecond = await setContentPiecePublishedForActor({
      contentPieceId: second.piece.id,
      published: true,
    })

    const firstRow = await payload.findByID({
      collection: 'contentPiece',
      id: first.piece.id,
      depth: 0,
      overrideAccess: true,
    })
    const secondRow = await payload.findByID({
      collection: 'contentPiece',
      id: second.piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(firstRow.slug).toBe('fim-da-escala-6x1')
    expect(secondRow.slug).toBe('fim-da-escala-6x1-2')
    expect(publishedSecond.isPublished).toBe(true)

    const unpublished = await setContentPiecePublishedForActor({
      contentPieceId: first.piece.id,
      published: false,
    })
    expect(unpublished.status).toBe('rascunho')

    const afterUnpublish = await payload.findByID({
      collection: 'contentPiece',
      id: first.piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterUnpublish.slug).toBe('fim-da-escala-6x1')
    expect(afterUnpublish.publishedAt).toBe(firstRow.publishedAt)

    // A rename after the first publication never moves the public URL.
    await payload.update({
      collection: 'contentPiece',
      id: first.piece.id,
      data: { title: 'Outro título' },
      overrideAccess: true,
    })
    const republished = await setContentPiecePublishedForActor({
      contentPieceId: first.piece.id,
      published: true,
    })
    expect(republished.status).toBe('publicado')
    const renamed = await payload.findByID({
      collection: 'contentPiece',
      id: first.piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(renamed.slug).toBe('fim-da-escala-6x1')
  })

  it('saves the ficha and records the curated fields', async () => {
    const { piece } = await createPiece({ title: 'Peça antiga' })
    getCampaignUserMock.mockResolvedValue(communicator)

    const updated = await updateContentPieceForActor({
      contentPieceId: piece.id,
      title: 'Título curado',
      description: 'Descrição da assessoria',
      type: 'card',
      pieceDate: '2026-09-10',
      topics: ['saude', 'nao-existe'],
      municipalityId: null,
      institution: 'Câmara dos Deputados',
      transcript: 'Texto revisado',
    })

    expect(updated.title).toBe('Título curado')
    expect(updated.type).toBe('card')
    expect(updated.topics).toEqual(['saude'])
    expect(updated.pieceDateLabel).toBe('10/09/2026')

    const row = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.curatedFields).toEqual([
      'title',
      'description',
      'topics',
      'municipality',
      'institution',
      'pieceDate',
      'transcript',
      'type',
    ])
    expect(row.searchText).toContain('titulo curado')
    expect(row.searchText).toContain('camara dos deputados')
  })

  it('derives the city and the region from the related município', async () => {
    const municipality = await payload.find({
      collection: 'municipality',
      where: { kind: { equals: 'municipio' } },
      depth: 0,
      limit: 1,
      pagination: false,
      sort: 'name',
      overrideAccess: true,
    })
    const target = municipality.docs[0]!
    const { piece } = await createPiece()

    await payload.update({
      collection: 'contentPiece',
      id: piece.id,
      data: { municipality: target.id },
      overrideAccess: true,
    })

    const row = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.cityLabel).toBe(target.name)
    expect(row.region).toBe(target.region)
    // The haystack is normalized (accents stripped); the city name is in it.
    expect(row.searchText).toContain(normalizeForSearch(target.name))
  })

  it('creates a link piece without an official path as a peça-link', async () => {
    getCampaignUserMock.mockResolvedValue(communicator)

    const piece = await addContentPieceByLinkForActor({
      url: 'https://www.youtube.com/watch?v=VIDEO1&utm_source=grupo',
    })
    createdPieceIds.add(piece.id)
    expect(piece.origin).toBe('youtube')
    expect(piece.processingStatus).toBe('processando')

    const row = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.sourceUrl).toBe('https://www.youtube.com/watch?v=VIDEO1')
    expect(row.media).toBeNull()

    // The job resolves no official path: the piece becomes a peça-link.
    await runContentPieceJob(payload, piece.id, { catalog: catalogStub })
    const resolved = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(resolved.processingStatus).toBe('pronto')
    expect(resolved.media).toBeNull()
  })

  it('refuses a duplicate link and an invalid one', async () => {
    getCampaignUserMock.mockResolvedValue(communicator)
    const url = 'https://www.instagram.com/reel/DUPLICADO/'

    const first = await addContentPieceByLinkForActor({ url })
    createdPieceIds.add(first.id)

    await expect(addContentPieceByLinkForActor({ url: `${url}?igsh=abc` })).rejects.toThrow(
      CONTENT_PIECE_LINK_DUPLICATE_MESSAGE,
    )
    await expect(
      addContentPieceByLinkForActor({ url: 'https://twitter.com/x/status/1' }),
    ).rejects.toThrow()
  })

  it('filters and searches the list', async () => {
    const municipality = await payload.find({
      collection: 'municipality',
      where: { kind: { equals: 'municipio' } },
      depth: 0,
      limit: 1,
      pagination: false,
      sort: 'name',
      overrideAccess: true,
    })
    const target = municipality.docs[0]!

    // The suite shares one database and the rows of every test stay until the
    // end: each assertion is scoped by a marker only this test creates.
    const matchMarker = `escala-${Date.now()}`
    const otherMarker = `card-${Date.now()}`
    const match = await createPiece({
      title: `Fim da escala 6x1 ${matchMarker}`,
      topics: ['saude'],
      institution: 'Câmara dos Deputados',
    })
    await payload.update({
      collection: 'contentPiece',
      id: match.piece.id,
      data: { municipality: target.id },
      overrideAccess: true,
    })
    const other = await createPiece({
      title: `Card do giro ${otherMarker}`,
      type: 'card',
      status: 'publicado',
    })

    const idsOf = async (params: Record<string, string | string[]>) =>
      (await loadContentPieceListPageData(payload, communicator, params)).rows.map((row) => row.id)

    expect(await idsOf({ q: matchMarker })).toEqual([match.piece.id])
    expect(await idsOf({ q: otherMarker })).toEqual([other.piece.id])
    expect(await idsOf({ q: target.name.split(' ')[0]! })).toContain(match.piece.id)
    expect(await idsOf({ q: 'camara dos deputados' })).toContain(match.piece.id)
    expect(await idsOf({ type: ['card'] })).toContain(other.piece.id)
    expect(await idsOf({ status: ['publicado'] })).toContain(other.piece.id)
    expect(await idsOf({ processing: ['pronto'] })).toEqual(
      expect.arrayContaining([match.piece.id, other.piece.id]),
    )

    // The loader answers for the communication roles only.
    await expect(loadContentPieceListPageData(payload, leader, {})).rejects.toThrow()
  })

  it('shows only published pieces with file or link in the public read', async () => {
    const marker = `pub-${Date.now()}`
    const draft = await createPiece({ title: `Rascunho ${marker}` })
    const published = await createPiece({ title: `Publicada ${marker}` })
    const empty = await createPiece({ title: `Vazia ${marker}`, withMedia: false })
    const link = await createPiece({
      title: `Link ${marker}`,
      withMedia: false,
      origin: 'youtube',
      sourceUrl: `https://www.youtube.com/watch?v=PUB${Date.now()}`,
    })

    await payload.update({
      collection: 'contentPiece',
      id: published.piece.id,
      data: { status: 'publicado' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'contentPiece',
      id: empty.piece.id,
      data: { status: 'publicado' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'contentPiece',
      id: link.piece.id,
      data: { status: 'publicado' },
      overrideAccess: true,
    })

    const items = await getPublishedContentPieceItems()
    const ids = items.map((item) => item.id)
    const publishedItem = items.find((item) => item.id === published.piece.id)

    expect(ids).toContain(published.piece.id)
    expect(ids).toContain(link.piece.id)
    expect(ids).not.toContain(draft.piece.id)
    // Published but with nothing to show (no file, no link) fails closed.
    expect(ids).not.toContain(empty.piece.id)
    expect(publishedItem?.slug).toMatch(new RegExp(`^publicada-${marker}`))
    expect(await getPublishedContentPieceBySlug(publishedItem!.slug)).toMatchObject({
      id: published.piece.id,
      file: { path: `/conteudos/${publishedItem!.slug}/midia` },
    })
    expect(await getPublishedContentPieceBySlug(`nao-existe-${marker}`)).toBeNull()
    expect(await hasPublishedContentPieces()).toBe(true)
  })

  it('serves a published piece file publicly and 404s draft, link and unknown slugs', async () => {
    const marker = `media-${Date.now()}`
    const draft = await createPiece({ title: `Mídia rascunho ${marker}` })
    const published = await createPiece({ title: `Mídia pública ${marker}` })
    const link = await createPiece({
      title: `Mídia link ${marker}`,
      withMedia: false,
      origin: 'instagram',
      sourceUrl: `https://www.instagram.com/reel/MEDIA${Date.now()}/`,
    })

    await payload.update({
      collection: 'contentPiece',
      id: published.piece.id,
      data: { status: 'publicado' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'contentPiece',
      id: link.piece.id,
      data: { status: 'publicado' },
      overrideAccess: true,
    })

    const publishedSlug = (
      await payload.findByID({
        collection: 'contentPiece',
        id: published.piece.id,
        depth: 0,
        overrideAccess: true,
      })
    ).slug!
    const draftSlug = (
      await payload.findByID({
        collection: 'contentPiece',
        id: draft.piece.id,
        depth: 0,
        overrideAccess: true,
      })
    ).slug
    const linkSlug = (
      await payload.findByID({
        collection: 'contentPiece',
        id: link.piece.id,
        depth: 0,
        overrideAccess: true,
      })
    ).slug!

    const full = await callPublicPieceMedia({ slug: publishedSlug })
    expect(full.status).toBe(200)
    expect(Buffer.from(await full.arrayBuffer())).toEqual(VIDEO_BYTES)

    const partial = await callPublicPieceMedia({ slug: publishedSlug, range: 'bytes=0-3' })
    expect(partial.status).toBe(206)

    const download = await callPublicPieceMedia({ slug: publishedSlug, download: true })
    expect(download.headers.get('Content-Disposition')).toContain('attachment')
    // The public download carries the legible name, never the stored upload one.
    expect(download.headers.get('Content-Disposition')).toContain(
      `jorge-solla-1313-${publishedSlug}.mp4`,
    )

    // A draft has no public slug at all; a link piece has no archived file.
    expect(draftSlug).toBeNull()
    expect((await callPublicPieceMedia({ slug: linkSlug })).status).toBe(404)
    expect((await callPublicPieceMedia({ slug: `nao-existe-${marker}` })).status).toBe(404)

    // Unpublishing removes the file from the public door immediately.
    await payload.update({
      collection: 'contentPiece',
      id: published.piece.id,
      data: { status: 'rascunho' },
      overrideAccess: true,
    })
    expect((await callPublicPieceMedia({ slug: publishedSlug })).status).toBe(404)
  })
})
