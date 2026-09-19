import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { request as playwrightRequest } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import {
  assertCampaignRedirect,
  assertLeaderRedirect,
  expect,
  rendered,
  test,
} from './fixtures/campaignHttpTest.js'

/**
 * C194 — the private reel library over real HTTP (browserless): the list and
 * the detail render for a communication role, the downloads are served by the
 * C193 authenticated media route, the kill switch takes the reel off the list
 * and withholds every file (C193 decision B), and advisor/leader are denied
 * both the page and the mutation route.
 *
 * Reels and their media are seeded through the deployed REST API (admin
 * session) so the server process runs the real hooks; a Local API call from
 * the runner would throw on `revalidateTag` (same reason as the sibling
 * speech-cut spec).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const FAKE_MP4 = Buffer.from('reel-library-mp4')
const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const createdReelIds: number[] = []
const createdMediaIds: number[] = []

const createReelMedia = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
  mimeType: string,
  buffer: Buffer,
): Promise<number> => {
  const media = await request.post(`${BASE_URL}/api/reelMedia`, {
    headers,
    multipart: {
      _payload: JSON.stringify({ alt: `Artefato ${name}` }),
      file: { name, mimeType, buffer },
    },
  })
  expect(media.ok(), await media.text()).toBeTruthy()
  const mediaId = ((await media.json()) as { doc: { id: number } }).doc.id
  createdMediaIds.push(mediaId)
  return mediaId
}

const createReel = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  input: { title: string; status: 'published' | 'unpublished' | 'draft' },
): Promise<number> => {
  const suffix = randomUUID().slice(0, 8)
  const video = await createReelMedia(request, headers, `reel-${suffix}.mp4`, 'video/mp4', FAKE_MP4)
  const cover = await createReelMedia(request, headers, `capa-${suffix}.png`, 'image/png', FAKE_PNG)

  const reel = await request.post(`${BASE_URL}/api/reel`, {
    headers,
    data: {
      title: input.title,
      feature: 'cards',
      status: input.status,
      video,
      cover,
      transcript: '[Abertura] Quer mostrar que está com Solla?',
    },
  })
  expect(reel.ok(), await reel.text()).toBeTruthy()
  const reelId = ((await reel.json()) as { doc: { id: number } }).doc.id
  createdReelIds.push(reelId)
  return reelId
}

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdReelIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/reel/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/reelMedia/${id}`, { headers }).catch(() => undefined)
  }
})

test.describe('Reel library (C194)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test('lists, opens and downloads a published reel; the kill switch empties the list and withholds the files', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const title = `Reel da biblioteca ${randomUUID().slice(0, 8)}`
    const reelId = await createReel(request, headers, { status: 'published', title })

    const communicator = await campaign.fixtures.createCampaignUser('communicator')
    const communicatorRequest = await campaignRequest(communicator, communicator.password)

    const list = await communicatorRequest.get('/campanha/comunicacao/reels')
    expect(list.status()).toBe(200)
    expect(rendered(await list.text())).toContain(title)

    const detail = await communicatorRequest.get(`/campanha/comunicacao/reels/${reelId}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain(title)
    expect(detailHtml).toContain(`/campanha/comunicacao/reels/${reelId}/media/video?download=1`)
    expect(detailHtml).toContain(`/campanha/comunicacao/reels/${reelId}/media/cover`)
    expect(detailHtml).toContain('Transcrição / roteiro')

    const download = await communicatorRequest.get(
      `/campanha/comunicacao/reels/${reelId}/media/video?download=1`,
    )
    expect(download.status()).toBe(200)
    expect(download.headers()['content-disposition']).toContain('attachment')

    const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      expect(
        (await anonymous.get(`/campanha/comunicacao/reels/${reelId}/media/video`)).status(),
      ).toBe(404)
    } finally {
      await anonymous.dispose()
    }

    const unpublish = await communicatorRequest.post(
      `/campanha/comunicacao/reels/${reelId}/publicacao`,
      { data: { reelId, published: false } },
    )
    expect(unpublish.status()).toBe(200)
    expect(((await unpublish.json()) as { reel: { status: string } }).reel.status).toBe(
      'unpublished',
    )

    const listAfter = rendered(
      await (await communicatorRequest.get('/campanha/comunicacao/reels')).text(),
    )
    expect(listAfter).not.toContain(title)

    const detailAfter = rendered(
      await (await communicatorRequest.get(`/campanha/comunicacao/reels/${reelId}`)).text(),
    )
    expect(detailAfter).toContain('Republicar reel')
    expect(detailAfter).toContain('Player indisponível')
    expect(detailAfter).not.toContain('?download=1')
    expect(detailAfter).not.toContain('<video')

    const republish = await communicatorRequest.post(
      `/campanha/comunicacao/reels/${reelId}/publicacao`,
      { data: { reelId, published: true } },
    )
    expect(republish.status()).toBe(200)
    expect(((await republish.json()) as { reel: { status: string } }).reel.status).toBe('published')

    const listBack = rendered(
      await (await communicatorRequest.get('/campanha/comunicacao/reels')).text(),
    )
    expect(listBack).toContain(title)
  })

  test('denies advisor/leader on the library page and on the kill-switch route', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const reelId = await createReel(request, headers, {
      status: 'published',
      title: `Reel restrito ${randomUUID().slice(0, 8)}`,
    })

    for (const role of ['advisor', 'leader'] as const) {
      const denied = await campaign.fixtures.createCampaignUser(role)
      const deniedRequest = await campaignRequest(denied, denied.password)

      if (role === 'leader') {
        await assertLeaderRedirect(deniedRequest, '/campanha/comunicacao/reels')
      } else {
        await assertCampaignRedirect(deniedRequest, '/campanha/comunicacao/reels', '/campanha')
      }

      const response = await deniedRequest.post(
        `/campanha/comunicacao/reels/${reelId}/publicacao`,
        { data: { reelId, published: false } },
      )
      expect(response.status()).toBe(400)
      expect(((await response.json()) as { message: string }).message).toContain(
        'não tem acesso à biblioteca de reels',
      )
    }
  })
})
