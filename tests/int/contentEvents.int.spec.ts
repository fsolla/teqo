// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

const afterCallbacks: Array<Promise<unknown>> = []

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    // The media route keeps the count off the response path; the test runs the
    // deferred work explicitly and asserts the row.
    after: (callback: () => unknown) => {
      afterCallbacks.push(Promise.resolve().then(callback))
    },
  }
})

const { rateLimitMock } = vi.hoisted(() => ({ rateLimitMock: vi.fn(() => true) }))

vi.mock('@/utilities/content/contentEventRateLimit', () => ({
  contentEventClientKey: () => 'content-event-test-key',
  checkContentEventRateLimit: rateLimitMock,
}))

vi.mock('@/utilities/content/contentEventAggregate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/content/contentEventAggregate')>()
  return { loadContentEventCountsBySubject: vi.fn(actual.loadContentEventCountsBySubject) }
})

import { POST as postContentEvent } from '@/app/(frontend)/api/content-events/route'
import { GET as getPublicPieceMedia } from '@/app/(frontend)/conteudos/[slug]/midia/route'
import { contentPieceCirculationFromRows } from '@/lib/contentPieceCirculation'
import type { CampaignUser, ContentMedia } from '@/payload-types'
import config from '@/payload.config'
import { loadContentEventCountsBySubject } from '@/utilities/content/contentEventAggregate'
import {
  loadContentPieceDetailPageData,
  loadContentPieceListPageData,
} from '@/utilities/content/contentPiecePageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const VIDEO_BYTES = Buffer.from('fixture-content-event-bytes')

let payload: Payload
const createdPieceIds = new Set<number>()
const createdMediaIds = new Set<number>()

const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const flushAfterCallbacks = async (): Promise<void> => {
  await Promise.all(afterCallbacks.splice(0))
}

const eventRowsOf = async (subjectIds: number[]) =>
  payload.find({
    collection: 'contentEvent',
    where: { subjectId: { in: subjectIds.map(String) } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'id',
    overrideAccess: true,
  })

const createMedia = async (name: string): Promise<ContentMedia> => {
  const media = await payload.create({
    collection: 'contentMedia',
    data: { alt: `Arquivo ${name}` },
    file: { data: VIDEO_BYTES, mimetype: 'video/mp4', name, size: VIDEO_BYTES.length },
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media
}

const createPiece = async ({
  title = `Peça de eventos ${Date.now()}`,
  status = 'publicado',
  withMedia = true,
}: {
  title?: string
  status?: 'rascunho' | 'publicado'
  withMedia?: boolean
} = {}) => {
  const media = withMedia ? await createMedia(`${title}.mp4`) : null
  const piece = await payload.create({
    collection: 'contentPiece',
    data: {
      title,
      type: 'video',
      status,
      processingStatus: 'pronto',
      origin: 'arquivo',
      ...(media ? { media: media.id } : {}),
    },
    overrideAccess: true,
  })
  createdPieceIds.add(piece.id)
  return piece
}

const slugOf = async (pieceId: number): Promise<string> =>
  (
    await payload.findByID({
      collection: 'contentPiece',
      id: pieceId,
      depth: 0,
      overrideAccess: true,
    })
  ).slug!

const postEvent = (body: unknown, init: RequestInit = {}): Promise<Response> =>
  postContentEvent(
    new Request('http://localhost/api/content-events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }),
  )

const callPublicMedia = (
  slug: string,
  { download, range }: { download?: boolean; range?: string },
) =>
  getPublicPieceMedia(
    new Request(`http://localhost/conteudos/${slug}/midia${download ? '?download=1' : ''}`, {
      headers: range ? { range } : undefined,
    }),
    { params: Promise.resolve({ slug }) },
  )

describe('content events (C213)', () => {
  let communicator: CampaignUser
  let leader: CampaignUser

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(async () => {
    const fixtures = campaignFixtures()
    ;[communicator, leader] = await Promise.all([
      fixtures.createCampaignUser('communicator'),
      fixtures.createCampaignUser('leader'),
    ])
    afterCallbacks.length = 0
  })

  afterAll(async () => {
    await payload
      .delete({
        collection: 'contentEvent',
        where: { id: { greater_than: 0 } },
        overrideAccess: true,
      })
      .catch(() => undefined)
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

  it('records an event for a published piece only', async () => {
    const piece = await createPiece()
    const slug = await slugOf(piece.id)

    const accepted = await postEvent({ type: 'abertura', pieceSlug: slug })
    expect(accepted.status).toBe(204)
    expect(accepted.headers.get('Cache-Control')).toBe('no-store')

    const rows = await eventRowsOf([piece.id])
    expect(rows.docs).toHaveLength(1)
    expect(rows.docs[0]).toMatchObject({
      type: 'abertura',
      subjectType: 'peca',
      subjectId: String(piece.id),
    })

    // An unknown slug is indistinguishable from a recorded event.
    expect(
      (await postEvent({ type: 'download', pieceSlug: `nao-existe-${Date.now()}` })).status,
    ).toBe(204)

    // Unpublishing closes the door immediately: the slug survives, the write does not.
    await payload.update({
      collection: 'contentPiece',
      id: piece.id,
      data: { status: 'rascunho' },
      overrideAccess: true,
    })
    expect((await postEvent({ type: 'download', pieceSlug: slug })).status).toBe(204)
    expect((await eventRowsOf([piece.id])).docs).toHaveLength(1)
  })

  it('refuses malformed bodies, unknown types, oversized bodies and cross-origin requests', async () => {
    const piece = await createPiece()
    const slug = await slugOf(piece.id)

    expect((await postEvent('not-json')).status).toBe(400)
    expect((await postEvent({ type: 'pageview', pieceSlug: slug })).status).toBe(400)
    expect((await postEvent({ type: 'download', pieceSlug: '../etc/passwd' })).status).toBe(400)
    // The byte ceiling is enforced on the stream, not on a declared header.
    expect((await postEvent(`{"padding":"${'x'.repeat(5 * 1024)}"}`)).status).toBe(400)
    expect(
      (
        await postEvent(
          { type: 'download', pieceSlug: slug },
          { headers: { 'content-type': 'application/json', origin: 'https://evil.example' } },
        )
      ).status,
    ).toBe(403)

    expect((await eventRowsOf([piece.id])).docs).toHaveLength(0)
  })

  it('aggregates counts per subject and never leaks one subject type into another', async () => {
    const first = await createPiece({ title: `Eventos A ${Date.now()}` })
    const second = await createPiece({ title: `Eventos B ${Date.now()}` })

    await payload.create({
      collection: 'contentEvent',
      data: { type: 'abertura', subjectType: 'peca', subjectId: String(first.id) },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'contentEvent',
      data: { type: 'abertura', subjectType: 'peca', subjectId: String(first.id) },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'contentEvent',
      data: { type: 'compartilhar_link', subjectType: 'peca', subjectId: String(second.id) },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'contentEvent',
      data: { type: 'download', subjectType: 'card', subjectId: String(first.id) },
      overrideAccess: true,
    })

    const result = await loadContentEventCountsBySubject(payload, {
      subjectType: 'peca',
      subjectIds: [String(first.id), String(second.id)],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const byPieceId = contentPieceCirculationFromRows(result.rows)
    expect(byPieceId.get(first.id)).toEqual({ opens: 2, downloads: 0, whatsapp: 0, link: 0 })
    expect(byPieceId.get(second.id)).toEqual({ opens: 0, downloads: 0, whatsapp: 0, link: 1 })
  })

  it('answers unavailable when the aggregate cannot run', async () => {
    const brokenPayload = {
      db: {
        name: 'postgres',
        drizzle: {
          execute: () => {
            throw new Error('boom')
          },
        },
      },
    } as unknown as Pick<Payload, 'db'>

    await expect(
      loadContentEventCountsBySubject(brokenPayload, { subjectType: 'peca', subjectIds: ['1'] }),
    ).resolves.toEqual({ ok: false })
  })

  it('counts one full public download and ignores ranges and plain reads', async () => {
    const piece = await createPiece({ title: `Download ${Date.now()}` })
    const slug = await slugOf(piece.id)

    const plain = await callPublicMedia(slug, {})
    expect(plain.status).toBe(200)
    await flushAfterCallbacks()

    const ranged = await callPublicMedia(slug, { download: true, range: 'bytes=0-3' })
    expect(ranged.status).toBe(206)
    await flushAfterCallbacks()

    const download = await callPublicMedia(slug, { download: true })
    expect(download.status).toBe(200)
    await flushAfterCallbacks()

    const rows = await eventRowsOf([piece.id])
    expect(rows.docs).toHaveLength(1)
    expect(rows.docs[0]).toMatchObject({ type: 'download', subjectId: String(piece.id) })
  })

  it('attaches the circulation counters to the list and the detail loaders', async () => {
    const published = await createPiece({ title: `Circulação ${Date.now()}` })
    const untouched = await createPiece({ title: `Circulação zerada ${Date.now()}` })
    const draft = await createPiece({ title: `Sem publicar ${Date.now()}`, status: 'rascunho' })
    await payload.create({
      collection: 'contentEvent',
      data: { type: 'download', subjectType: 'peca', subjectId: String(published.id) },
      overrideAccess: true,
    })

    const list = await loadContentPieceListPageData(payload, communicator, { q: 'Circulação' })
    const listRow = list.rows.find((row) => row.id === published.id)
    expect(listRow?.circulation).toEqual({
      state: 'data',
      counts: { opens: 0, downloads: 1, whatsapp: 0, link: 0 },
    })
    // Published without any event is data with zeros — not "never published".
    expect(list.rows.find((row) => row.id === untouched.id)?.circulation).toEqual({
      state: 'data',
      counts: { opens: 0, downloads: 0, whatsapp: 0, link: 0 },
    })

    const detail = await loadContentPieceDetailPageData(payload, communicator, published.id)
    expect(detail.piece.circulation).toEqual({
      state: 'data',
      counts: { opens: 0, downloads: 1, whatsapp: 0, link: 0 },
    })

    // A piece that never had a slug has nothing to count, honestly.
    const draftDetail = await loadContentPieceDetailPageData(payload, communicator, draft.id)
    expect(draftDetail.piece.circulation).toEqual({ state: 'neverPublished' })
  })

  it('degrades the loaders to the unavailable state when the aggregate fails', async () => {
    const piece = await createPiece({ title: `Circulação indisponível ${Date.now()}` })

    vi.mocked(loadContentEventCountsBySubject).mockResolvedValueOnce({ ok: false })
    const list = await loadContentPieceListPageData(payload, communicator, {
      q: 'Circulação indisponível',
    })
    expect(list.rows.find((row) => row.id === piece.id)?.circulation).toEqual({
      state: 'unavailable',
    })

    vi.mocked(loadContentEventCountsBySubject).mockResolvedValueOnce({ ok: false })
    const detail = await loadContentPieceDetailPageData(payload, communicator, piece.id)
    expect(detail.piece.circulation).toEqual({ state: 'unavailable' })
  })

  it('answers silently and writes nothing when the client is throttled', async () => {
    const piece = await createPiece()
    const slug = await slugOf(piece.id)

    rateLimitMock.mockReturnValueOnce(false)
    const throttled = await postEvent({ type: 'abertura', pieceSlug: slug })

    expect(throttled.status).toBe(204)
    expect((await eventRowsOf([piece.id])).docs).toHaveLength(0)
  })

  it('keeps the collection closed to every campaign write and open to communication reads', async () => {
    const piece = await createPiece()
    await payload.create({
      collection: 'contentEvent',
      data: { type: 'abertura', subjectType: 'peca', subjectId: String(piece.id) },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'contentEvent',
        data: { type: 'abertura', subjectType: 'peca', subjectId: String(piece.id) },
        overrideAccess: false,
        user: communicator,
      }),
    ).rejects.toThrow()

    const readAs = (user?: CampaignUser) =>
      payload.find({
        collection: 'contentEvent',
        where: { subjectId: { equals: String(piece.id) } },
        depth: 0,
        limit: 1,
        ...(user ? { user } : {}),
        overrideAccess: false,
      })

    await expect(readAs()).rejects.toThrow()
    await expect(readAs(leader)).rejects.toThrow()
    expect((await readAs(communicator)).docs).toHaveLength(1)
  })
})
