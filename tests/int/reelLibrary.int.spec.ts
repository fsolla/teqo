// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The reel collection's hooks and the Next runtime: the library loaders do not
// cache anything, but the action context and the config import run through the
// Next server graph — same neutering as the sibling speech-cut suite.
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('@/utilities/campaignActionContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/campaignActionContext')>()
  return { ...original, getCampaignActionContext: vi.fn() }
})

import { setReelPublishedForActor } from '@/app/(campaign)/campanha/actions/reels'
import { REEL_FORBIDDEN_MESSAGE, REEL_NOT_FOUND_MESSAGE } from '@/lib/schemas/reel'
import type { CampaignUser, Reel, ReelMedia } from '@/payload-types'
import config from '@/payload.config'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  loadReelDetailPageData,
  loadReelLibraryPageData,
  ReelNotFoundError,
} from '@/utilities/reels/reelPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const MP4_BYTES = Buffer.from('fixture-mp4-bytes')
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

const mockedGetContext = vi.mocked(getCampaignActionContext)
const asActor = (actor: CampaignUser) => mockedGetContext.mockResolvedValue({ payload, actor })

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
  title = 'Reel de tutorial',
  withTranscript = false,
}: {
  status?: Reel['status']
  title?: string
  withTranscript?: boolean
} = {}): Promise<Reel> => {
  const video = await createMedia(`reel-${createdReelIds.size}.mp4`, MP4_BYTES, 'video/mp4')
  const cover = await createMedia(`capa-${createdReelIds.size}.png`, PNG_BYTES, 'image/png')

  const reel = await payload.create({
    collection: 'reel',
    data: {
      title,
      feature: 'cards',
      status,
      video: video.id,
      cover: cover.id,
      ...(withTranscript ? { transcript: '  [Abertura] Olá.  ' } : {}),
    },
    overrideAccess: true,
  })
  createdReelIds.add(reel.id)
  return reel
}

const setPublishedAt = async (reelId: number, iso: string): Promise<void> => {
  await payload.update({
    collection: 'reel',
    id: reelId,
    data: { publishedAt: iso },
    depth: 0,
    overrideAccess: true,
  })
}

describe('reel library data (C194)', () => {
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

  it('lists only published reels, newest publication first, with the private cover path', async () => {
    const older = await createReel({ status: 'published', title: 'Reel antigo' })
    await setPublishedAt(older.id, '2026-09-01T12:00:00.000Z')
    const newer = await createReel({ status: 'published', title: 'Reel novo' })
    await setPublishedAt(newer.id, '2026-09-10T12:00:00.000Z')
    const draft = await createReel({ status: 'draft' })
    const unpublished = await createReel({ status: 'unpublished' })

    const data = await loadReelLibraryPageData(payload, communicator, {})

    const ids = data.rows.map((row) => row.id)
    expect(ids).toContain(newer.id)
    expect(ids).toContain(older.id)
    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(unpublished.id)
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id))
    expect(data.totalDocs).toBeGreaterThanOrEqual(2)

    const newest = data.rows.find((row) => row.id === newer.id)
    expect(newest).toMatchObject({
      title: 'Reel novo',
      featureLabel: 'Cards de apoio (#cards)',
      status: 'published',
      statusLabel: 'Publicado',
      coverUrl: `/campanha/comunicacao/reels/${newer.id}/media/cover`,
      detailHref: `/campanha/comunicacao/reels/${newer.id}`,
    })
  })

  it('canonicalizes the URL and redirects an overflowing page', async () => {
    const data = await loadReelLibraryPageData(payload, coordinator, {
      page: 'abc',
      unsupported: 'x',
    })

    expect(data.state.page).toBe(1)
    expect(data.redirectHref).toBe('/campanha/comunicacao/reels')
  })

  it('denies the list to advisors and leaders', async () => {
    await expect(loadReelLibraryPageData(payload, advisor, {})).rejects.toThrow()
    await expect(loadReelLibraryPageData(payload, leader, {})).rejects.toThrow()
  })

  it('loads the detail for any status and fails closed for an unknown reel', async () => {
    const published = await createReel({
      status: 'published',
      title: 'Reel com arquivos',
      withTranscript: true,
    })
    const draft = await createReel({ status: 'draft' })

    const detail = await loadReelDetailPageData(payload, candidate, published.id)
    expect(detail.canServeMedia).toBe(true)
    expect(detail.videoSourceUrl).toBe(`/campanha/comunicacao/reels/${published.id}/media/video`)
    expect(detail.videoPosterUrl).toBe(`/campanha/comunicacao/reels/${published.id}/media/cover`)
    expect(detail.transcript).toBe('[Abertura] Olá.')
    expect(detail.downloads[0]).toMatchObject({
      kind: 'video',
      primary: true,
      href: `/campanha/comunicacao/reels/${published.id}/media/video?download=1`,
      unavailableLabel: null,
    })
    expect(detail.downloads[1].href).toBeNull()

    const draftDetail = await loadReelDetailPageData(payload, communicator, draft.id)
    expect(draftDetail.canServeMedia).toBe(false)
    expect(draftDetail.videoSourceUrl).toBeNull()
    expect(draftDetail.downloads.every((item) => item.href === null)).toBe(true)

    await expect(loadReelDetailPageData(payload, communicator, 999_999)).rejects.toBeInstanceOf(
      ReelNotFoundError,
    )
  })

  it('denies the detail to advisors and leaders', async () => {
    const reel = await createReel({ status: 'published' })

    await expect(loadReelDetailPageData(payload, advisor, reel.id)).rejects.toThrow()
    await expect(loadReelDetailPageData(payload, leader, reel.id)).rejects.toThrow()
  })
})

describe('reel kill switch (C194)', () => {
  let communicator: CampaignUser
  let coordinator: CampaignUser
  let advisor: CampaignUser

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(async () => {
    const fixtures = campaignFixtures()
    ;[communicator, coordinator, advisor] = await Promise.all([
      fixtures.createCampaignUser('communicator'),
      fixtures.createCampaignUser('coordinator'),
      fixtures.createCampaignUser('advisor'),
    ])
  })

  it('takes the reel off the list and withholds its media without deleting it', async () => {
    const reel = await createReel({
      status: 'published',
      title: 'Reel do kill switch',
      withTranscript: true,
    })
    asActor(communicator)

    const result = await setReelPublishedForActor({ reelId: reel.id, published: false })
    expect(result).toEqual({ id: reel.id, status: 'unpublished' })

    const list = await loadReelLibraryPageData(payload, communicator, {})
    expect(list.rows.map((row) => row.id)).not.toContain(reel.id)

    const detail = await loadReelDetailPageData(payload, communicator, reel.id)
    expect(detail.canServeMedia).toBe(false)
    expect(detail.transcript).toBe('[Abertura] Olá.')
    expect(detail.status).toBe('unpublished')

    const stored = await payload.findByID({
      collection: 'reel',
      id: reel.id,
      depth: 0,
      overrideAccess: true,
    })
    const videoId = typeof reel.video === 'number' ? reel.video : reel.video.id
    expect(stored.video).toBe(videoId)
  })

  it('republishes the same row and re-stamps the publication', async () => {
    const reel = await createReel({ status: 'published', title: 'Reel republicado' })
    asActor(coordinator)

    await setReelPublishedForActor({ reelId: reel.id, published: false })
    await setPublishedAt(reel.id, '2020-01-01T00:00:00.000Z')

    const result = await setReelPublishedForActor({ reelId: reel.id, published: true })
    expect(result.status).toBe('published')

    const stored = await payload.findByID({
      collection: 'reel',
      id: reel.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.publishedAt).not.toBe('2020-01-01T00:00:00.000Z')
    expect(new Date(stored.publishedAt ?? 0).getTime()).toBeGreaterThan(
      new Date('2020-01-01T00:00:00.000Z').getTime(),
    )

    const list = await loadReelLibraryPageData(payload, coordinator, {})
    expect(list.rows.map((row) => row.id)).toContain(reel.id)
  })

  it('refuses the kill switch for a denied role and reports a missing reel', async () => {
    const reel = await createReel({ status: 'published' })

    asActor(advisor)
    await expect(setReelPublishedForActor({ reelId: reel.id, published: false })).rejects.toThrow(
      REEL_FORBIDDEN_MESSAGE,
    )

    asActor(communicator)
    await expect(setReelPublishedForActor({ reelId: 999_999, published: false })).rejects.toThrow(
      REEL_NOT_FOUND_MESSAGE,
    )
  })
})
