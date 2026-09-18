// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

const { getCampaignUserMock } = vi.hoisted(() => ({ getCampaignUserMock: vi.fn() }))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: getCampaignUserMock,
}))

import { GET } from '@/app/(campaign)/campanha/(app)/comunicacao/reels/[id]/media/[kind]/route'
import type { CampaignUser, Reel, ReelMedia } from '@/payload-types'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const MP4_BYTES = Buffer.from('fixture-mp4-bytes')
const SRT_BYTES = Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nOlá\n')
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

let payload: Payload
const createdReelIds = new Set<number>()
const createdMediaIds = new Set<number>()
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const createMedia = async (name: string, data: Buffer, mimetype: string): Promise<ReelMedia> => {
  const media = await payload.create({
    collection: 'reelMedia',
    data: { alt: `Artefato ${name}` },
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media
}

const createReel = async ({
  status = 'draft',
  withCaptions = false,
  title = 'Reel de tutorial',
}: {
  status?: Reel['status']
  withCaptions?: boolean
  title?: string
} = {}): Promise<{ reel: Reel; video: ReelMedia }> => {
  const video = await createMedia('reel.mp4', MP4_BYTES, 'video/mp4')
  const cover = await createMedia('capa.png', PNG_BYTES, 'image/png')
  const captions = withCaptions
    ? await createMedia('narracao.srt', SRT_BYTES, 'application/x-subrip')
    : null

  const reel = await payload.create({
    collection: 'reel',
    data: {
      title,
      feature: 'cards',
      status,
      video: video.id,
      cover: cover.id,
      ...(captions ? { captions: captions.id } : {}),
    },
    overrideAccess: true,
  })
  createdReelIds.add(reel.id)
  return { reel, video }
}

const callRoute = async ({
  reelId,
  kind,
  user,
  range,
  download,
}: {
  reelId: number
  kind: string
  user?: CampaignUser | null
  range?: string
  download?: boolean
}): Promise<Response> => {
  getCampaignUserMock.mockResolvedValue(user ?? null)
  const request = new Request(
    `http://localhost/campanha/comunicacao/reels/${reelId}/media/${kind}${download ? '?download=1' : ''}`,
    { headers: range ? { range } : undefined },
  )
  return GET(request, { params: Promise.resolve({ id: String(reelId), kind }) })
}

const findReelsAs = (user: CampaignUser | undefined, id: number) =>
  payload.find({
    collection: 'reel',
    where: { id: { equals: id } },
    depth: 0,
    limit: 1,
    ...(user ? { user } : {}),
    overrideAccess: false,
  })

describe('reel private library (C193)', () => {
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
  })

  afterAll(async () => {
    for (const id of createdReelIds) {
      await payload.delete({ collection: 'reel', id, overrideAccess: true }).catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload
        .delete({ collection: 'reelMedia', id, overrideAccess: true })
        .catch(() => undefined)
    }
  })

  it('reads the reel only with the communication roles', async () => {
    const { reel } = await createReel({ status: 'published' })

    await expect(findReelsAs(undefined, reel.id)).rejects.toThrow()
    await expect(findReelsAs(advisor, reel.id)).rejects.toThrow()
    await expect(findReelsAs(leader, reel.id)).rejects.toThrow()
    expect((await findReelsAs(communicator, reel.id)).docs).toHaveLength(1)
    expect((await findReelsAs(coordinator, reel.id)).docs).toHaveLength(1)
    expect((await findReelsAs(candidate, reel.id)).docs).toHaveLength(1)
  })

  it('stamps the actor and the publication through the create path', async () => {
    const video = await createMedia('stamp.mp4', MP4_BYTES, 'video/mp4')
    const cover = await createMedia('stamp.png', PNG_BYTES, 'image/png')

    const reel = await payload.create({
      collection: 'reel',
      data: {
        title: 'Reel com carimbo',
        feature: 'cards',
        status: 'published',
        video: video.id,
        cover: cover.id,
      },
      depth: 0,
      user: communicator,
      overrideAccess: false,
    })
    createdReelIds.add(reel.id)

    expect(reel.createdBy).toBe(communicator.id)
    expect(reel.publishedAt).toBeTruthy()
  })

  it('serves a published artifact to a communication role', async () => {
    const { reel } = await createReel({ status: 'published' })

    const response = await callRoute({ reelId: reel.id, kind: 'video', user: communicator })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Disposition')).toContain('inline')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(MP4_BYTES)
  })

  it('answers a byte range with 206 and the exact slice', async () => {
    const { reel } = await createReel({ status: 'published' })

    const response = await callRoute({
      reelId: reel.id,
      kind: 'video',
      user: coordinator,
      range: 'bytes=0-3',
    })

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe(`bytes 0-3/${MP4_BYTES.length}`)
    expect(response.headers.get('Content-Length')).toBe('4')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(MP4_BYTES.subarray(0, 4))
  })

  it('forces a download when asked and for unsafe types', async () => {
    const { reel } = await createReel({ status: 'published', withCaptions: true })

    const download = await callRoute({
      reelId: reel.id,
      kind: 'video',
      user: communicator,
      download: true,
    })
    expect(download.headers.get('Content-Disposition')).toContain('attachment')

    const captions = await callRoute({
      reelId: reel.id,
      kind: 'captions',
      user: communicator,
    })
    expect(captions.status).toBe(200)
    expect(captions.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(captions.headers.get('Content-Disposition')).toContain('attachment')
    expect(Buffer.from(await captions.arrayBuffer())).toEqual(SRT_BYTES)
  })

  it('kill switch: draft and unpublished never serve the file', async () => {
    const draft = await createReel({ status: 'draft' })
    const unpublished = await createReel({ status: 'unpublished' })

    expect(
      (await callRoute({ reelId: draft.reel.id, kind: 'video', user: communicator })).status,
    ).toBe(404)
    expect(
      (await callRoute({ reelId: unpublished.reel.id, kind: 'video', user: communicator })).status,
    ).toBe(404)
  })

  it('denies anonymous, advisor and leader with a silent 404', async () => {
    const { reel } = await createReel({ status: 'published' })

    for (const user of [undefined, advisor, leader]) {
      const response = await callRoute({ reelId: reel.id, kind: 'video', user })
      expect(response.status).toBe(404)
    }
  })

  it('answers 404 for a missing artifact, an unknown kind and an unknown reel', async () => {
    const { reel } = await createReel({ status: 'published' })

    expect(
      (await callRoute({ reelId: reel.id, kind: 'narration', user: communicator })).status,
    ).toBe(404)
    expect((await callRoute({ reelId: reel.id, kind: 'poster', user: communicator })).status).toBe(
      404,
    )
    expect((await callRoute({ reelId: 999999, kind: 'video', user: communicator })).status).toBe(
      404,
    )
  })

  it('keeps delete out of the advisor and in the communication roles', async () => {
    const { reel } = await createReel({ status: 'published' })

    await expect(
      payload.delete({
        collection: 'reel',
        id: reel.id,
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'reel',
        id: reel.id,
        user: communicator,
        overrideAccess: false,
      }),
    ).resolves.toBeTruthy()
    createdReelIds.delete(reel.id)
  })
})
