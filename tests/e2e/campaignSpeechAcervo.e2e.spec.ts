import type { SpeechScope, SpeechTopic } from '@/lib/speechFacets'

import type { CampaignE2EOwnership } from './fixtures/campaignE2EFixtures.js'
import { assertCampaignRedirect, expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * C154 — the communication vertical over real HTTP (browserless, OPS35/OPS87):
 * role gates, the acervo search rendering (highlight + excerpt), the filter
 * URL contract and the detail's player/transcript/actions. Playback itself is
 * browser territory and is not asserted here — the HTML carries the contract
 * (`<video src>`, `data-start-seconds`).
 */

const createSpeech = async (
  campaign: { fixtures: CampaignE2EOwnership },
  input: {
    marker: string
    speechAt?: string
    topics?: SpeechTopic[]
    scopes?: SpeechScope[]
    keywords?: string[]
    durationSeconds?: number
    withVideo?: boolean
  },
) => {
  const marker = input.marker
  const speech = await campaign.fixtures.payload.create({
    collection: 'speech',
    data: {
      sourceKey: campaign.fixtures.value('speech'),
      speechAt: input.speechAt ?? '2026-03-10T18:00',
      type: 'BREVES COMUNICAÇÕES',
      phase: 'Breves Comunicações',
      durationSeconds: input.durationSeconds ?? 252,
      summary: `Sumário oficial com o marcador ${marker}.`,
      officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
      keywords: input.keywords ?? ['Farmácia Popular'],
      topics: input.topics ?? ['saude'],
      scopes: input.scopes ?? ['bahia'],
      classifiedBy: 'gazetteer',
      // Mirrors what `upsertSpeechBundle` derives from the segments (C154).
      searchText: `a retomada da saude ${marker} na bahia`,
      presidingOfficer: 'Pompeo de Mattos',
      officialTextUrl: 'https://camara.leg.br/discurso',
      ...(input.withVideo === false
        ? {}
        : {
            vodPlaybackUrl: 'https://vod.camara.leg.br/excerpt.mp4',
            vodDownloadUrl: 'https://vod.camara.leg.br/excerpt.mp4',
          }),
    },
    depth: 0,
  })
  await campaign.fixtures.payload.create({
    collection: 'speechSegment',
    data: {
      speech: speech.id,
      order: 1,
      startSeconds: 0,
      endSeconds: 4,
      text: `A retomada da saúde ${marker} na Bahia`,
      searchText: `a retomada da saude ${marker} na bahia`,
    },
    depth: 0,
  })
  return speech
}

test.describe('communication vertical (C154)', () => {
  test('communicator lands on the acervo and sees only the vertical nav', async ({
    campaign,
    campaignRequest,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    await assertCampaignRedirect(request, '/campanha', '/campanha/comunicacao')
    await assertCampaignRedirect(request, '/campanha/comunicacao', '/campanha/comunicacao/acervo')

    const response = await request.get('/campanha/comunicacao/acervo')
    expect(response.status()).toBe(200)
    const html = rendered(await response.text())
    expect(html).toContain('Acervo de falas')
    expect(html).toContain('href="/campanha/comunicacao"')
    expect(html).not.toContain('href="/campanha/apoiadores"')
    expect(html).not.toContain('href="/campanha/municipios"')
    // C154 — no Sollinha for the communication assessor (C153 debt resolved).
    expect(html).not.toContain('campaign-ai-shell')
    expect(html).not.toContain('Sollinha')
  })

  test('coordinator sees the vertical from the staff nav; advisor does not', async ({
    campaign,
    campaignRequest,
  }) => {
    const coordinator = await campaign.fixtures.createCampaignUser('coordinator')
    const coordinatorRequest = await campaignRequest(coordinator, coordinator.password)
    const coordinatorHome = await coordinatorRequest.get('/campanha')
    expect(coordinatorHome.status()).toBe(200)
    expect(rendered(await coordinatorHome.text())).toContain('href="/campanha/comunicacao"')

    const advisor = await campaign.fixtures.createCampaignUser('advisor')
    const advisorRequest = await campaignRequest(advisor, advisor.password)
    const advisorHome = await advisorRequest.get('/campanha')
    expect(advisorHome.status()).toBe(200)
    expect(rendered(await advisorHome.text())).not.toContain('href="/campanha/comunicacao"')
  })

  test('search renders the highlighted excerpt and the detail carries the player', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('falateste')
    const speech = await createSpeech(campaign, { marker })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const results = await request.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(results.status()).toBe(200)
    const resultsHtml = rendered(await results.text())
    expect(resultsHtml).toContain(marker)
    expect(resultsHtml).toContain('<mark')
    expect(resultsHtml).toContain('Assistir no trecho')
    expect(resultsHtml).toContain('1 fala encontrada')

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}?t=0&q=${marker}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain('data-slot="speech-player"')
    expect(detailHtml).toContain('<video')
    expect(detailHtml).toContain('data-start-seconds="0"')
    expect(detailHtml).toContain('Baixar vídeo (MP4)')
    expect(detailHtml).toContain('Abrir fonte')
    expect(detailHtml).toContain('Fonte: Câmara dos Deputados')
  })

  test('facet filters narrow the results and the empty state suggests clearing', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('filtroteste')
    await createSpeech(campaign, {
      marker,
      speechAt: '2019-05-10T15:00',
      topics: ['igualdade-racial'],
      scopes: ['brasil'],
      durationSeconds: 90,
    })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const matching = await request.get(
      `/campanha/comunicacao/acervo?q=${marker}&topic=igualdade-racial&year=2019&duration=curta`,
    )
    expect(rendered(await matching.text())).toContain(marker)

    const filteredOut = await request.get(`/campanha/comunicacao/acervo?q=${marker}&topic=saude`)
    const filteredHtml = rendered(await filteredOut.text())
    // The term still rides the search chip; what must be gone is the result.
    expect(filteredHtml).not.toContain('Assistir no trecho')
    expect(filteredHtml).toContain('Nenhuma fala encontrada')
    expect(filteredHtml).toContain('Limpar busca e filtros')
  })

  test('advisor and leader are redirected away from the acervo', async ({
    campaign,
    campaignRequest,
  }) => {
    const advisor = await campaign.fixtures.createCampaignUser('advisor')
    const advisorRequest = await campaignRequest(advisor, advisor.password)
    await assertCampaignRedirect(advisorRequest, '/campanha/comunicacao/acervo', '/campanha')

    const leader = await campaign.fixtures.createCampaignUser('leader')
    const leaderRequest = await campaignRequest(leader, leader.password)
    await assertCampaignRedirect(
      leaderRequest,
      '/campanha/comunicacao/acervo',
      '/campanha/meus-contatos',
    )
  })

  test('a speech without VOD renders the unavailable block instead of a player', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('semvod')
    const speech = await createSpeech(campaign, { marker, withVideo: false })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}`)
    const html = rendered(await detail.text())
    expect(html).toContain('VOD indisponível')
    expect(html).not.toContain('Baixar vídeo (MP4)')
  })
})
