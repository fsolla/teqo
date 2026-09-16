import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { request as playwrightRequest } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import type { CampaignE2EOwnership } from './fixtures/campaignE2EFixtures.js'
import { assertCampaignRedirect, expect, rendered, test } from './fixtures/campaignHttpTest.js'

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
      // C176 — the neutral `editorial` surface is what removes the dark-red
      // body gradient this page used to inherit; the attribute is the guard.
      expect(html).toContain('data-theme="editorial"')
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

/**
 * C168 — the internal cut library: list and detail render for a communicator,
 * the text edit and the kill switch go through the JSON routes, the public page
 * reflects the unpublish, and advisor/leader are denied both the page and the
 * edit route.
 */
test.describe('Acervo cut library (C168)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test('lists, edits and toggles a cut over HTTP; the kill switch reaches the public page', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const title = 'Corte da biblioteca'
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'published',
      title,
    })

    const communicator = await campaign.fixtures.createCampaignUser('communicator')
    const communicatorRequest = await campaignRequest(communicator, communicator.password)

    const list = await communicatorRequest.get('/campanha/comunicacao/acervo/cortes')
    expect(list.status()).toBe(200)
    expect(rendered(await list.text())).toContain(title)

    const detail = await communicatorRequest.get(`/campanha/comunicacao/acervo/cortes/${cutId}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain(title)
    expect(detailHtml).toContain(`/campanha/comunicacao/acervo/${speech.id}`)

    const edit = await communicatorRequest.post(
      `/campanha/comunicacao/acervo/cortes/${cutId}/texto`,
      { data: { cutId, title: 'Título revisado', description: 'Descrição revisada' } },
    )
    expect(edit.status()).toBe(200)
    const editBody = (await edit.json()) as { status: string; cut: { title: string } }
    expect(editBody.status).toBe('success')
    expect(editBody.cut.title).toBe('Título revisado')

    const unpublish = await communicatorRequest.post(
      `/campanha/comunicacao/acervo/cortes/${cutId}/publicacao`,
      { data: { cutId, published: false } },
    )
    expect(unpublish.status()).toBe(200)
    expect(((await unpublish.json()) as { cut: { status: string } }).cut.status).toBe('unpublished')

    const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      expect((await anonymous.get(`/corte/${cutId}`)).status()).toBe(404)
    } finally {
      await anonymous.dispose()
    }
  })

  test('denies advisor/leader on the library page and on the edit route', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'published',
      title: 'Corte restrito',
    })

    for (const role of ['advisor', 'leader'] as const) {
      const denied = await campaign.fixtures.createCampaignUser(role)
      const deniedRequest = await campaignRequest(denied, denied.password)

      await assertCampaignRedirect(
        deniedRequest,
        '/campanha/comunicacao/acervo/cortes',
        role === 'leader' ? '/campanha/meus-contatos' : '/campanha',
      )

      const response = await deniedRequest.post(
        `/campanha/comunicacao/acervo/cortes/${cutId}/publicacao`,
        { data: { cutId, published: false } },
      )
      expect(response.status()).toBe(400)
      expect(((await response.json()) as { message: string }).message).toContain(
        'não tem acesso ao acervo',
      )

      const deleteResponse = await deniedRequest.delete(
        `/campanha/comunicacao/acervo/cortes/${cutId}/apagar`,
      )
      expect(deleteResponse.status()).toBe(400)
      expect(((await deleteResponse.json()) as { message: string }).message).toContain(
        'não tem acesso ao acervo',
      )
    }
  })

  test('deletes a cut over HTTP (public link dies) and retries a failed one', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const title = `Corte apagável ${randomUUID().slice(0, 8)}`
    const cutId = await createCut(request, headers, {
      speechId: speech.id,
      status: 'published',
      title,
    })

    const communicator = await campaign.fixtures.createCampaignUser('communicator')
    const communicatorRequest = await campaignRequest(communicator, communicator.password)

    const publicBefore = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      expect((await publicBefore.get(`/corte/${cutId}`)).status()).toBe(200)
    } finally {
      await publicBefore.dispose()
    }

    const deleted = await communicatorRequest.delete(
      `/campanha/comunicacao/acervo/cortes/${cutId}/apagar`,
    )
    expect(deleted.status()).toBe(200)
    expect(((await deleted.json()) as { status: string }).status).toBe('success')

    const list = await communicatorRequest.get('/campanha/comunicacao/acervo/cortes')
    expect(list.status()).toBe(200)
    expect(rendered(await list.text())).not.toContain(title)

    const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
    try {
      expect((await anonymous.get(`/corte/${cutId}`)).status()).toBe(404)
    } finally {
      await anonymous.dispose()
    }

    const failedTitle = `Corte falho ${randomUUID().slice(0, 8)}`
    const failedCut = await createCut(request, headers, {
      speechId: speech.id,
      status: 'failed',
      title: failedTitle,
    })
    const retried = await communicatorRequest.post(
      `/campanha/comunicacao/acervo/cortes/${failedCut}/retry`,
      { data: { cutId: failedCut } },
    )
    expect(retried.status()).toBe(200)
    expect(((await retried.json()) as { cut: { status: string } }).cut.status).toBe('processing')
  })
})

/**
 * C174 — finding a cut without re-cutting: the library is reachable from the
 * vertical nav, the speech detail lists its own cuts, the search nests them
 * under the speech, and a cut matching the term surfaces its origin speech.
 */
test.describe('Acervo: finding cuts (C174)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test('reaches the library, the speech cuts and the nested/origin search results', async ({
    campaign,
    campaignRequest,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const speech = await createSpeech(campaign)
    const marker = randomUUID().slice(0, 8)
    const title = `Corte localizável ${marker}`
    await createCut(request, headers, { speechId: speech.id, status: 'published', title })

    const communicator = await campaign.fixtures.createCampaignUser('communicator')
    const communicatorRequest = await campaignRequest(communicator, communicator.password)

    const detail = await communicatorRequest.get(`/campanha/comunicacao/acervo/${speech.id}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain('Cortes desta fala')
    expect(detailHtml).toContain(title)
    // C174 — the library sub-item now lives in the vertical nav on every page.
    expect(detailHtml).toContain('/campanha/comunicacao/acervo/cortes')

    // The speech matches "retomada" (its searchText) and shows its cut nested.
    const nested = await communicatorRequest.get('/campanha/comunicacao/acervo?q=retomada')
    expect(nested.status()).toBe(200)
    const nestedHtml = rendered(await nested.text())
    expect(nestedHtml).toContain(title)
    expect(nestedHtml).toContain('corte desta fala')

    // Option B: only the cut matches; the origin speech still appears.
    const byCut = await communicatorRequest.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(byCut.status()).toBe(200)
    const byCutHtml = rendered(await byCut.text())
    expect(byCutHtml).toContain(title)
    expect(byCutHtml).toContain('Fala de origem')
    expect(byCutHtml).toContain(`/campanha/comunicacao/acervo/${speech.id}`)
  })
})
