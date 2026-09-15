import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { request as playwrightRequest } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import type { CampaignE2EOwnership } from './fixtures/campaignE2EFixtures.js'
import { expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * C167 — speech cuts over real HTTP (browserless): the unlisted public page of
 * a published cut (same stored file, OG, credit, noindex), the identical
 * not-found screen for unpublished and unknown ids, and the cut routes' gate
 * (communicator/coordinator/candidate pass, advisor/leader fail closed). The
 * cut job itself (ffmpeg, Câmara download, media publish) is unit/int
 * territory — it is deliberately not driven through the HTTP server here.
 *
 * Media and cuts are seeded through the deployed REST API (admin session) so
 * the server process runs the real cache hooks; a Local API call from the
 * runner would throw on `revalidateTag` (same reason as the S1 posts spec).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const FAKE_MP4 = Buffer.from('camara-corte-mp4')
const createdCutIds: number[] = []
const createdMediaIds: number[] = []

const createSpeech = async (
  campaign: { fixtures: CampaignE2EOwnership },
  input: { youtubeUrl?: string | null; withVideo?: boolean } = {},
) => {
  const speech = await campaign.fixtures.payload.create({
    collection: 'speech',
    data: {
      sourceKey: campaign.fixtures.value('speech'),
      speechAt: '2026-08-11T18:48',
      type: 'BREVES COMUNICAÇÕES',
      phase: 'Breves Comunicações',
      durationSeconds: 252,
      summary: 'Saúde e educação em Feira de Santana.',
      officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
      keywords: ['Farmácia Popular'],
      topics: ['saude'],
      scopes: ['bahia'],
      classifiedBy: 'gazetteer',
      searchText: 'a retomada da saude na bahia',
      presidingOfficer: 'Pompeo de Mattos',
      eventId: 67091,
      audioId: 558641,
      excerptTMs: 1786473834650,
      eventStartAt: '2026-08-11T15:00',
      youtubeUrl: input.youtubeUrl ?? null,
      ...(input.withVideo === false
        ? {}
        : {
            vodPlaybackUrl: 'https://vod.camara.leg.br/excerpt.mp4',
            vodDownloadUrl: 'https://vod.camara.leg.br/excerpt.mp4',
          }),
    },
    depth: 0,
  })
  return speech
}

const createCut = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  input: {
    speechId: number
    status: 'published' | 'unpublished' | 'processing' | 'failed'
    title: string
  },
): Promise<number> => {
  const media = await request.post(`${BASE_URL}/api/media`, {
    headers,
    // Payload multipart carries the document fields in `_payload` (JSON).
    multipart: {
      _payload: JSON.stringify({ alt: input.title }),
      file: {
        name: `corte-${randomUUID().slice(0, 8)}.mp4`,
        mimeType: 'video/mp4',
        buffer: FAKE_MP4,
      },
    },
  })
  expect(media.ok(), await media.text()).toBeTruthy()
  const mediaId = ((await media.json()) as { doc: { id: number } }).doc.id
  createdMediaIds.push(mediaId)

  const cut = await request.post(`${BASE_URL}/api/speechCut`, {
    headers,
    data: {
      speech: input.speechId,
      startSeconds: 43,
      endSeconds: 118,
      durationSeconds: 75,
      title: input.title,
      description: 'Em pronunciamento no plenário, o deputado cobra o financiamento da saúde.',
      status: input.status,
      media: mediaId,
      ...(input.status === 'published' ? { publishedAt: new Date().toISOString() } : {}),
    },
  })
  expect(cut.ok(), await cut.text()).toBeTruthy()
  const cutId = ((await cut.json()) as { doc: { id: number } }).doc.id
  createdCutIds.push(cutId)
  return cutId
}

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdCutIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/speechCut/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/media/${id}`, { headers }).catch(() => undefined)
  }
})

test.describe('Acervo speech cuts (C167)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test('serves the published cut with the stored file, OG image, credit and noindex', async ({
    campaign,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign, {
      youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A',
    })
    const title = 'Acesso a medicamentos na Bahia'
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'published',
      title,
    })

    const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      const response = await anonymous.get(`/corte/${cutId}`)
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())

      expect(html).toContain(title)
      expect(html).toContain('/api/media/file/')
      expect(html).toContain('Fonte: Câmara dos Deputados · CC BY 4.0')
      expect(html).toContain('noindex')
      expect(html).toContain('https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg')
      expect(html).toContain('Ver sessão no YouTube')
    } finally {
      await anonymous.dispose()
    }
  })

  test('answers the same not-found screen for an unpublished cut and an unknown id', async ({
    campaign,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'unpublished',
      title: 'Corte despublicado',
    })

    const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      const unpublished = await anonymous.get(`/corte/${cutId}`)
      const unknown = await anonymous.get('/corte/999999999')

      expect(unpublished.status()).toBe(404)
      expect(unknown.status()).toBe(404)
      const unpublishedHtml = rendered(await unpublished.text())
      const unknownHtml = rendered(await unknown.text())
      expect(unpublishedHtml).toContain('Este corte não está disponível')
      expect(unknownHtml).toContain('Este corte não está disponível')
      expect(unpublishedHtml).not.toContain('Corte despublicado')
    } finally {
      await anonymous.dispose()
    }
  })

  test('serves the cut status to a communicator and denies advisor/leader fail-closed', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'published',
      title: 'Corte do acervo',
    })

    const communicator = await campaign.fixtures.createCampaignUser('communicator')
    const communicatorRequest = await campaignRequest(communicator, communicator.password)
    const communicatorPoll = await communicatorRequest.post(
      '/campanha/comunicacao/acervo/cortar/status',
      { data: { cutId } },
    )
    expect(communicatorPoll.status()).toBe(200)
    const pollBody = (await communicatorPoll.json()) as {
      status: string
      cut: { status: string; publicPath: string; mediaUrl: string | null }
    }
    expect(pollBody.status).toBe('success')
    expect(pollBody.cut.status).toBe('published')
    expect(pollBody.cut.publicPath).toBe(`/corte/${cutId}`)
    expect(pollBody.cut.mediaUrl).toContain('/api/media/file/')

    // A VOD-less speech cannot be cut: the route answers the domain message
    // instead of creating a row that could never publish.
    const withoutVideo = await createSpeech(campaign, { withVideo: false })
    const ineligible = await communicatorRequest.post('/campanha/comunicacao/acervo/cortar', {
      data: {
        speechId: withoutVideo.id,
        startSeconds: 0,
        endSeconds: 30,
        title: 'Título',
        description: 'Descrição',
      },
    })
    expect(ineligible.status()).toBe(400)
    expect(((await ineligible.json()) as { message: string }).message).toContain(
      'não tem trecho de vídeo',
    )

    for (const role of ['advisor', 'leader'] as const) {
      const denied = await campaign.fixtures.createCampaignUser(role)
      const deniedRequest = await campaignRequest(denied, denied.password)
      const response = await deniedRequest.post('/campanha/comunicacao/acervo/cortar/status', {
        data: { cutId },
      })
      expect(response.status()).toBe(400)
      expect(((await response.json()) as { message: string }).message).toContain(
        'não tem acesso ao acervo',
      )
    }
  })
})
