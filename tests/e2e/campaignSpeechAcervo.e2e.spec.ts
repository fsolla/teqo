import { request as playwrightRequest } from '@playwright/test'

import type { SpeechScope, SpeechTopic } from '@/lib/speechFacets'
import { normalizeForSearch } from '../../src/lib/speechSearch.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'

import type { CampaignE2EOwnership } from './fixtures/campaignE2EFixtures.js'
import { assertCampaignRedirect, expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * C154/C162 — the communication vertical over real HTTP (browserless,
 * OPS35/OPS87): role gates, the acervo search rendering (highlight + excerpt),
 * the filter URL contract and the detail's player/transcript/actions. The
 * player picks the surface from the row coordinates — the Câmara excerpt as the
 * default when the speech has one (stored-VOD capa resolved on click), a
 * clickable YouTube cover when it only has a session link (C178: YouTube is
 * never an embedded entry; C181 restores the embed as the opt-in in-page surface
 * behind "Assistir no YouTube", keeping the Câmara as the default entry) — and
 * honest states when neither exists — and the stored VOD link itself is never
 * rendered (C162). Playback is browser territory and is not asserted here; the
 * HTML carries the contract (`<video src>` only after a click, `data-start-seconds`,
 * the cover href; the embed is never server-rendered).
 */

const YOUTUBE_VIDEO_ID = 'lLhRDkSPw0A'
const EXCERPT_TMS = 1786473834650
const EXCERPT_SESSION = '2026-08-11T15:00'
const EXCERPT_OFFSET_SECONDS = 2634

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
    /** C182 — drop the Câmara coordinates so the frame is not resolvable. */
    withCoordinates?: boolean
    youtubeUrl?: string | null
    eventStartAt?: string
    /** C177 — set to null to create a speech without the official text. */
    officialTextUrl?: string | null
  },
) => {
  const marker = input.marker
  const withCoordinates = input.withCoordinates ?? true
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
      officialTextUrl:
        input.officialTextUrl === undefined
          ? 'https://camara.leg.br/discurso'
          : input.officialTextUrl,
      eventId: withCoordinates ? 67091 : null,
      audioId: withCoordinates ? 558641 : null,
      excerptTMs: withCoordinates ? EXCERPT_TMS : null,
      eventStartAt: input.eventStartAt ?? EXCERPT_SESSION,
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

test.describe('communication vertical (C154/C162)', () => {
  test('communicator lands on the acervo and sees only the vertical nav, with her scoped Sollinha', async ({
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
    // C159 — the communication assessor gets the Sollinha scoped to the
    // acervo: the surface exists, the greeting speaks acervo and the opening
    // chips are hers (never the staff set).
    expect(html).toContain('campaign-ai-shell')
    expect(html).toContain('Olá! Eu sou o Sollinha')
    expect(html).toContain('O que o Solla já falou sobre Farmácia Popular?')
    expect(html).toContain('Qual um trecho bom sobre o hospital do subúrbio?')
    expect(html).not.toContain('Quem foi o deputado mais votado em Feira de Santana?')
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

  test('search keeps the download off the card; the both-sources detail defaults to the Câmara excerpt', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('falateste')
    const speech = await createSpeech(campaign, {
      marker,
      youtubeUrl: `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
    })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const results = await request.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(results.status()).toBe(200)
    const resultsHtml = rendered(await results.text())
    expect(resultsHtml).toContain(marker)
    expect(resultsHtml).toContain('<mark')
    expect(resultsHtml).toContain('Assistir no trecho')
    expect(resultsHtml).toContain('1 fala encontrada')
    // C182 — the card points at the frame of the speech (middle of the trecho),
    // served by the internal poster route; the session cover does not take over.
    expect(resultsHtml).toContain(`/campanha/comunicacao/acervo/${speech.id}/poster`)
    expect(resultsHtml).not.toContain(`https://i.ytimg.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`)
    // C162 — the direct download left the card, and the stored ephemeral link
    // never reaches any list HTML.
    expect(resultsHtml).not.toContain('Baixar')
    expect(resultsHtml).not.toContain('vod.camara.leg.br')
    // C177 — the source button names the official record (the card carries it too).
    expect(resultsHtml).toContain('Abrir Diário Oficial')

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}?t=43&q=${marker}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain('data-slot="speech-player"')
    // C178 — the YouTube embed is never the entry: the default surface is the
    // Câmara excerpt (resolved on click) and no iframe is ever server-rendered.
    expect(detailHtml).not.toContain('youtube.com/embed')
    expect(detailHtml).not.toContain('<iframe')
    expect(detailHtml).toContain('O trecho deste vídeo é gerado pela Câmara dos Deputados.')
    expect(detailHtml).toContain('Assistir o trecho')
    // C178 — the exit block is server-rendered with the Câmara panel: the
    // watch URL opens at the deep-linked point (never a signin dead end), and
    // the Câmara surface owns the switch button (C181).
    expect(detailHtml).toContain('Se o vídeo não abrir aqui, assista por outro caminho:')
    expect(detailHtml).toContain('Abrir no YouTube')
    expect(detailHtml).not.toContain('Assistir na Câmara')
    // C181 — the way back to the YouTube surface is server-rendered with the
    // Câmara default (the embed itself only mounts after the click).
    expect(detailHtml).toContain('Assistir no YouTube')
    expect(detailHtml).toContain('data-slot="speech-youtube-exit-embed"')
    expect(detailHtml).toContain(`watch?v=${YOUTUBE_VIDEO_ID}&amp;t=${EXCERPT_OFFSET_SECONDS + 43}`)
    expect(detailHtml).toContain('data-slot="speech-youtube-exit-link"')
    expect(detailHtml).toContain('data-start-seconds="0"')
    expect(detailHtml).toContain('Baixar vídeo (MP4)')
    expect(detailHtml).toContain('Abrir Diário Oficial')
    expect(detailHtml).toContain('Fonte: Câmara dos Deputados')
    // C166 — the excerpt picker's door is server-rendered; its link limit is
    // not in this quadrant (the share control itself only appears in the mode,
    // which is client interaction).
    expect(detailHtml).toContain('Selecionar trecho')
    expect(detailHtml).not.toContain('Compartilhar por link exige o vídeo no YouTube')
    expect(detailHtml).not.toContain('<video')
    expect(detailHtml).not.toContain('vod.camara.leg.br')
  })

  test('a YouTube-only speech gets a clickable cover, never an embedded iframe', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('soyoutube')
    const speech = await createSpeech(campaign, {
      marker,
      withVideo: false,
      youtubeUrl: `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
    })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain('data-slot="speech-youtube-facade"')
    expect(detailHtml).toContain('aria-label="Abrir no YouTube"')
    // C178 — the cover is the external exit: the click goes to YouTube, and no
    // iframe/video reaches the HTML.
    expect(detailHtml).toContain(`watch?v=${YOUTUBE_VIDEO_ID}&amp;t=${EXCERPT_OFFSET_SECONDS}`)
    expect(detailHtml).toContain('Vídeo no YouTube')
    expect(detailHtml).toContain('Abrir no YouTube')
    expect(detailHtml).not.toContain('youtube.com/embed')
    expect(detailHtml).not.toContain('<iframe')
    expect(detailHtml).not.toContain('<video')
    // Without an in-page player the "if the video fails here" copy would lie.
    expect(detailHtml).not.toContain('Se o vídeo não abrir aqui')
    expect(detailHtml).not.toContain('Assistir na Câmara')
    expect(detailHtml).toContain('Abrir Diário Oficial')
    expect(detailHtml).not.toContain('vod.camara.leg.br')
  })

  test('a speech without the official text hides the source button in list and detail (C177)', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('semfonte')
    const speech = await createSpeech(campaign, {
      marker,
      officialTextUrl: null,
      youtubeUrl: `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
    })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const results = await request.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(results.status()).toBe(200)
    const resultsHtml = rendered(await results.text())
    expect(resultsHtml).toContain(marker)
    // C177 — no official text means no source button, and the YouTube URL is
    // never smuggled into a "source" link; the card CTA still opens the speech.
    expect(resultsHtml).not.toContain('Abrir Diário Oficial')

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}`)
    expect(detail.status()).toBe(200)
    const detailHtml = rendered(await detail.text())
    expect(detailHtml).toContain('Abrir no YouTube')
    expect(detailHtml).not.toContain('Abrir Diário Oficial')
    expect(detailHtml).not.toContain('Abrir fonte')
  })

  test('a VOD-only speech offers the on-click resolution instead of a player', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('sovod')
    const speech = await createSpeech(campaign, { marker })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const results = await request.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(results.status()).toBe(200)
    // C182 — a VOD-only speech still gets a frame at the middle of the trecho,
    // with no YouTube cover anywhere.
    const resultsHtml = rendered(await results.text())
    expect(resultsHtml).toContain(`/campanha/comunicacao/acervo/${speech.id}/poster`)
    expect(resultsHtml).not.toContain('i.ytimg.com')

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}`)
    expect(detail.status()).toBe(200)
    const html = rendered(await detail.text())
    expect(html).toContain('Assistir o trecho')
    expect(html).toContain('Baixar vídeo (MP4)')
    // C166 — no YouTube means no excerpt link: the honest notice replaces it
    // while the selection door stays offered.
    expect(html).toContain('Selecionar trecho')
    expect(html).toContain('Compartilhar por link exige o vídeo no YouTube')
    // C178 — no YouTube id means no cover and no exit block.
    expect(html).not.toContain('Abrir no YouTube')
    expect(html).not.toContain('Se o vídeo não abrir aqui')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('<iframe')
    // The stored link is an eligibility signal, never a rendered URL.
    expect(html).not.toContain('vod.camara.leg.br')
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

  test('theme mode degrades honestly to the exact search without the key (C192)', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('temadeg')
    await createSpeech(campaign, { marker })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    // The e2e environment blanks DEEPSEEK_API_KEY (playwright.config.ts), so the
    // expansion is unavailable and the page must fall back with the notice.
    const themed = await request.get(`/campanha/comunicacao/acervo?q=${marker}&mode=tema`)
    expect(themed.status()).toBe(200)
    const themedHtml = rendered(await themed.text())
    expect(themedHtml).toContain('Modo de busca')
    expect(themedHtml).toContain('Termo exato')
    expect(themedHtml).toContain('Por tema')
    expect(themedHtml).toContain('data-testid="speech-theme-fallback"')
    expect(themedHtml).toContain('A busca por tema está indisponível agora.')
    expect(themedHtml).toContain('Tentar por tema novamente')
    expect(themedHtml).toContain('Resultados por termo exato')
    expect(themedHtml).toContain('data-testid="speech-theme-fallback"')
    // The exact results still render and keep the highlighted term.
    expect(themedHtml).toContain(marker)
    expect(themedHtml).toContain('<mark')
    // No theme badge is fabricated.
    expect(themedHtml).not.toContain('Por que apareceu')

    // The default mode stays untouched: no mode param means no notice.
    const exact = await request.get(`/campanha/comunicacao/acervo?q=${marker}`)
    expect(exact.status()).toBe(200)
    const exactHtml = rendered(await exact.text())
    expect(exactHtml).toContain(marker)
    expect(exactHtml).not.toContain('A busca por tema está indisponível agora.')
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

  test('a speech without video renders the unavailable block instead of a player', async ({
    campaign,
    campaignRequest,
  }) => {
    const marker = campaign.fixtures.value('semvod')
    const speech = await createSpeech(campaign, { marker, withVideo: false })

    const user = await campaign.fixtures.createCampaignUser('communicator')
    const request = await campaignRequest(user, user.password)

    const detail = await request.get(`/campanha/comunicacao/acervo/${speech.id}`)
    const html = rendered(await detail.text())
    expect(html).toContain('Vídeo indisponível neste momento')
    expect(html).toContain('Abrir Diário Oficial')
    // No stored VOD means nothing to resolve: no MP4 button and no retry.
    expect(html).not.toContain('Baixar vídeo (MP4)')
    expect(html).not.toContain('Tentar novamente')
    // C178 — without a YouTube id there is no cover and no exit block.
    expect(html).not.toContain('Abrir no YouTube')
    expect(html).not.toContain('Se o vídeo não abrir aqui')
  })

  test.describe('POST /campanha/comunicacao/acervo/resolver-vod (C162)', () => {
    const endpoint = '/campanha/comunicacao/acervo/resolver-vod'

    test('rejects a request without a campaign session', async ({ campaign }) => {
      const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
      try {
        const response = await anonymous.post(endpoint, { data: { speechId: 1 } })
        expect(response.status()).toBe(401)
      } finally {
        await anonymous.dispose()
      }
    })

    test('rejects a cross-origin request before any read', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('origem')
      const speech = await createSpeech(campaign, { marker })
      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.post(endpoint, {
        data: { speechId: speech.id },
        headers: { Origin: 'https://evil.example' },
      })
      expect(response.status()).toBe(403)
      expect(await response.text()).toContain('Requisição inválida.')
    })

    test('refuses an actor outside the catalog gate', async ({ campaign, campaignRequest }) => {
      const marker = campaign.fixtures.value('assessor')
      const speech = await createSpeech(campaign, { marker })
      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const request = await campaignRequest(advisor, advisor.password)

      const response = await request.post(endpoint, { data: { speechId: speech.id } })
      expect(response.status()).toBe(400)
      expect(await response.text()).toContain('Você não tem acesso ao acervo de falas.')
    })

    test('refuses a speech without a stored VOD without calling the Câmara', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('inelegivel')
      const speech = await createSpeech(campaign, { marker, withVideo: false })
      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.post(endpoint, { data: { speechId: speech.id } })
      expect(response.status()).toBe(400)
      expect(await response.text()).toContain('não tem trecho de vídeo')
    })
  })

  test.describe('GET /campanha/comunicacao/acervo/:id/poster (C182)', () => {
    // Only the network-free paths are asserted here: a resolvable speech would
    // ask the real Câmara, which the browserless suite must never do.
    test('falls back to the YouTube cover without Câmara coordinates', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('poster')
      const speech = await createSpeech(campaign, {
        marker,
        withCoordinates: false,
        youtubeUrl: `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
      })
      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.get(`/campanha/comunicacao/acervo/${speech.id}/poster`, {
        maxRedirects: 0,
      })
      expect(response.status()).toBe(302)
      expect(response.headers()['location']).toContain(
        `i.ytimg.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`,
      )
    })

    test('answers 404 without any media and refuses an actor outside the catalog', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('poster404')
      const bare = await createSpeech(campaign, { marker, withCoordinates: false })

      const communicator = await campaign.fixtures.createCampaignUser('communicator')
      const communicatorRequest = await campaignRequest(communicator, communicator.password)
      const notFound = await communicatorRequest.get(
        `/campanha/comunicacao/acervo/${bare.id}/poster`,
        { maxRedirects: 0 },
      )
      expect(notFound.status()).toBe(404)

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      const denied = await advisorRequest.get(`/campanha/comunicacao/acervo/${bare.id}/poster`, {
        maxRedirects: 0,
      })
      expect(denied.status()).toBe(404)
    })
  })

  test.describe('uploaded recordings (C199)', () => {
    const createRecording = async (
      campaign: { fixtures: CampaignE2EOwnership },
      input: {
        marker: string
        status?: 'processing' | 'ready' | 'failed'
        withSegments?: boolean
        segments?: {
          startSeconds: number
          endSeconds: number
          text: string
          speakerKey?: string | null
        }[]
        speakerLabels?: { speakerKey: string; label: string }[]
      },
    ) => {
      const bytes = Buffer.from(`recording-${input.marker}`)
      const media = await campaign.fixtures.payload.create({
        collection: 'recordingMedia',
        data: { alt: `Arquivo ${input.marker}` },
        file: {
          data: bytes,
          mimetype: 'video/mp4',
          name: `${input.marker}.mp4`,
          size: bytes.length,
        },
      })
      const recording = await campaign.fixtures.payload.create({
        collection: 'recording',
        data: {
          title: `Gravação ${input.marker}`,
          status: input.status ?? 'ready',
          recordedAt: '2026-09-01T00:00:00.000Z',
          media: media.id,
          ...(input.speakerLabels ? { speakerLabels: input.speakerLabels } : {}),
        },
        depth: 0,
      })

      if (input.segments) {
        for (const [index, segment] of input.segments.entries()) {
          await campaign.fixtures.payload.create({
            collection: 'recordingSegment',
            data: hookFilledCreateData<'recordingSegment'>({
              recording: recording.id,
              order: index + 1,
              startSeconds: segment.startSeconds,
              endSeconds: segment.endSeconds,
              text: segment.text,
              speakerKey: segment.speakerKey ?? null,
            }),
            depth: 0,
          })
        }
        await campaign.fixtures.payload.update({
          collection: 'recording',
          id: recording.id,
          data: {
            searchText: normalizeForSearch(input.segments.map((segment) => segment.text).join(' ')),
          },
          depth: 0,
        })
      } else if (input.withSegments ?? true) {
        await campaign.fixtures.payload.create({
          collection: 'recordingSegment',
          data: hookFilledCreateData<'recordingSegment'>({
            recording: recording.id,
            order: 1,
            startSeconds: 12,
            endSeconds: 20,
            text: `A plenária discutiu a merenda ${input.marker} com a comunidade.`,
          }),
          depth: 0,
        })
        await campaign.fixtures.payload.update({
          collection: 'recording',
          id: recording.id,
          data: {
            searchText: normalizeForSearch(
              `A plenária discutiu a merenda ${input.marker} com a comunidade.`,
            ),
          },
          depth: 0,
        })
      }

      return { recording, media, bytes }
    }

    test('the recordings source renders the row, the excerpt and the switcher', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacao')
      const { recording } = await createRecording(campaign, { marker })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.get(`/campanha/comunicacao/acervo?source=enviadas&q=${marker}`)
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      expect(html).toContain('Gravações enviadas')
      expect(html).toContain('aria-current="page"')
      expect(html).toContain(`Gravação ${marker}`)
      expect(html).toContain('Pronto')
      expect(html).toContain('<mark')
      expect(html).toContain(`?t=12`)
      expect(html).toContain(`/campanha/comunicacao/acervo/gravacoes/${recording.id}`)

      const miss = await request.get('/campanha/comunicacao/acervo?source=enviadas&q=zzzznada')
      expect(rendered(await miss.text())).toContain('Nenhuma gravação encontrada para')

      // The alias segment resolves to the source instead of being swallowed by
      // the speech detail regex (the route gate streams, so the redirect may
      // arrive as a meta tag — `assertCampaignRedirect` accepts both).
      await assertCampaignRedirect(
        request,
        '/campanha/comunicacao/acervo/gravacoes',
        '/campanha/comunicacao/acervo?source=enviadas',
      )
    })

    test('the detail renders the private player, the clickable transcript and the download', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaodetalhe')
      const { recording } = await createRecording(campaign, { marker })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}?t=12&q=${marker}`,
      )
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      expect(html).toContain(`Gravação ${marker}`)
      expect(html).toContain(`/campanha/comunicacao/acervo/gravacoes/${recording.id}/arquivo`)
      expect(html).toContain('data-start-seconds="12"')
      expect(html).toContain('<mark')
      expect(html).toContain('Baixar')
      expect(html).toContain('Apagar')
      expect(html).toContain('Voltar ao acervo')
    })

    test('the private file answers only the acervo roles, with range and download', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaofile')
      const { recording, bytes } = await createRecording(campaign, { marker })

      const communicator = await campaign.fixtures.createCampaignUser('communicator')
      const communicatorRequest = await campaignRequest(communicator, communicator.password)

      const full = await communicatorRequest.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}/arquivo`,
      )
      expect(full.status()).toBe(200)
      expect(full.headers()['content-type']).toBe('video/mp4')
      expect(full.headers()['cache-control']).toBe('private, no-store')
      expect(Buffer.from(await full.body())).toEqual(bytes)

      const partial = await communicatorRequest.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}/arquivo`,
        { headers: { Range: 'bytes=0-3' } },
      )
      expect(partial.status()).toBe(206)

      const download = await communicatorRequest.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}/arquivo?download=1`,
      )
      expect(download.headers()['content-disposition']).toContain('attachment')

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      const denied = await advisorRequest.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}/arquivo`,
      )
      expect(denied.status()).toBe(404)
    })

    test('the upload route refuses cross-origin and advisor actors', async ({
      campaign,
      campaignRequest,
    }) => {
      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const uploadUrl = '/campanha/comunicacao/acervo/gravacoes/enviar?title=Teste&filename=t.mp4'

      const crossOrigin = await request.post(uploadUrl, {
        headers: { Origin: 'https://evil.example' },
      })
      expect(crossOrigin.status()).toBe(403)

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      const denied = await advisorRequest.post(uploadUrl)
      expect(denied.status()).toBe(403)
    })

    test('the grouped detail renders the speaker blocks, the warning and the identify action', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaofalantes')
      const { recording } = await createRecording(campaign, {
        marker,
        segments: [
          {
            startSeconds: 12,
            endSeconds: 20,
            text: `A plenária discutiu a merenda ${marker}.`,
            speakerKey: 'speaker-1',
          },
          {
            startSeconds: 21,
            endSeconds: 30,
            text: 'O relator respondeu em seguida.',
            speakerKey: 'speaker-2',
          },
        ],
        speakerLabels: [{ speakerKey: 'speaker-1', label: 'Dep. Jorge Solla' }],
      })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const response = await request.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}?t=12&q=${marker}`,
      )
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())

      expect(html).toContain('Transcrição por falante')
      expect(html).toContain('Dep. Jorge Solla')
      expect(html).toContain('Identificação feita pela equipe')
      expect(html).toContain('Falante 2')
      expect(html).toContain('Agrupamento sem identificação')
      expect(html).toContain('Editar identificação')
      expect(html).toContain('Identificar falante')
      expect(html).toContain('A separação por falante pode estar imprecisa')
      expect(html).toContain('data-start-seconds="12"')
      expect(html).toContain('data-start-seconds="21"')
      expect(html).toContain('<mark')
    })

    test('the "Pessoa" facet filters the list and the card shows the chip', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaopessoa')
      const { recording } = await createRecording(campaign, {
        marker,
        segments: [
          {
            startSeconds: 12,
            endSeconds: 20,
            text: `A plenária discutiu a merenda ${marker}.`,
            speakerKey: 'speaker-1',
          },
        ],
        speakerLabels: [{ speakerKey: 'speaker-1', label: `Dep. ${marker}` }],
      })
      const { recording: other } = await createRecording(campaign, {
        marker: `${marker}outra`,
        withSegments: false,
      })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const response = await request.get(
        `/campanha/comunicacao/acervo?source=enviadas&person=${encodeURIComponent(`dep. ${marker}`)}`,
      )
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())

      expect(html).toContain(`Gravação ${marker}`)
      expect(html).not.toContain(`Gravação ${marker}outra`)
      expect(html).toContain('Pessoa:')
      expect(html).toContain('aparece nesta gravação')
      expect(html).toContain(`/campanha/comunicacao/acervo/gravacoes/${recording.id}`)
      expect(html).not.toContain(`/campanha/comunicacao/acervo/gravacoes/${other.id}`)
    })

    test('labels a cluster through the JSON route and denies the non-acervo roles', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaorotular')
      const { recording } = await createRecording(campaign, {
        marker,
        segments: [
          {
            startSeconds: 12,
            endSeconds: 20,
            text: 'Fala única do agrupamento.',
            speakerKey: 'speaker-1',
          },
        ],
      })
      const endpoint = `/campanha/comunicacao/acervo/gravacoes/${recording.id}/falantes`

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const response = await request.post(endpoint, {
        data: { recordingId: recording.id, speakerKey: 'speaker-1', label: `Dep. ${marker}` },
      })
      expect(response.status()).toBe(200)
      expect((await response.json()).status).toBe('success')

      const updated = await campaign.fixtures.payload.findByID({
        collection: 'recording',
        id: recording.id,
        depth: 0,
      })
      expect(updated.speakerNames).toEqual([`Dep. ${marker}`])

      const unknown = await request.post(endpoint, {
        data: { recordingId: recording.id, speakerKey: 'speaker-9', label: 'Fantasma' },
      })
      expect(unknown.status()).toBe(400)

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      const denied = await advisorRequest.post(endpoint, {
        data: { recordingId: recording.id, speakerKey: 'speaker-1', label: 'Negado' },
      })
      // The JSON mutation wrapper maps a safe domain message to 400 (same
      // envelope as the other `/campanha/**` mutation routes).
      expect(denied.status()).toBe(400)
    })

    test('a recording without diarization keeps the plain transcript', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('gravacaoSemFalantes')
      const { recording } = await createRecording(campaign, { marker })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const response = await request.get(
        `/campanha/comunicacao/acervo/gravacoes/${recording.id}?t=12&q=${marker}`,
      )
      const html = rendered(await response.text())

      expect(html).toContain('data-start-seconds="12"')
      expect(html).not.toContain('Transcrição por falante')
      expect(html).not.toContain('A separação por falante pode estar imprecisa')
    })
  })

  test.describe('content pieces (C211)', () => {
    const createPiece = async (
      campaign: { fixtures: CampaignE2EOwnership },
      input: {
        marker: string
        status?: 'rascunho' | 'publicado'
        processingStatus?: 'processando' | 'pronto' | 'falhou'
        type?: 'video' | 'foto' | 'texto' | 'audio' | 'card'
        origin?: 'arquivo' | 'instagram' | 'youtube'
        withMedia?: boolean
        sourceUrl?: string
      },
    ) => {
      const bytes = Buffer.from(`content-piece-${input.marker}`)
      const media =
        input.withMedia === false
          ? null
          : await campaign.fixtures.payload.create({
              collection: 'contentMedia',
              data: { alt: `Arquivo ${input.marker}` },
              file: {
                data: bytes,
                mimetype: 'video/mp4',
                name: `${input.marker}.mp4`,
                size: bytes.length,
              },
            })
      const piece = await campaign.fixtures.payload.create({
        collection: 'contentPiece',
        data: {
          title: `Peça ${input.marker}`,
          type: input.type ?? 'video',
          status: input.status ?? 'rascunho',
          processingStatus: input.processingStatus ?? 'pronto',
          origin: input.origin ?? 'arquivo',
          ...(media ? { media: media.id } : {}),
          ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        },
        depth: 0,
      })
      return { piece, media, bytes }
    }

    test('the list renders the row, the states and the search', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('peca')
      const { piece } = await createPiece(campaign, { marker, status: 'publicado' })
      const failed = await createPiece(campaign, {
        marker: campaign.fixtures.value('pecafalhou'),
        processingStatus: 'falhou',
      })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.get(`/campanha/comunicacao/conteudos?q=${marker}`)
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      expect(html).toContain('Conteúdos')
      expect(html).toContain('Enviar peças')
      expect(html).toContain('Adicionar por link')
      expect(html).toContain(`Peça ${marker}`)
      expect(html).toContain('Pronto')
      expect(html).toContain('Publicado')
      expect(html).toContain(`/campanha/comunicacao/conteudos/${piece.id}`)
      expect(html).toContain('aria-current="page"')

      // A failed piece offers the retry action in the list.
      const failedResponse = await request.get(`/campanha/comunicacao/conteudos?processing=falhou`)
      const failedHtml = rendered(await failedResponse.text())
      expect(failedHtml).toContain(`Peça ${failed.piece.title.replace('Peça ', '')}`)
      expect(failedHtml).toContain('Reprocessar')

      const miss = await request.get('/campanha/comunicacao/conteudos?q=zzzznada')
      expect(rendered(await miss.text())).toContain('Nenhuma peça na Central ainda')
    })

    test('the ficha renders the catalogue and moves the kill switch', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('pecaficha')
      const { piece } = await createPiece(campaign, { marker })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const response = await request.get(`/campanha/comunicacao/conteudos/${piece.id}`)
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      expect(html).toContain(`Peça ${marker}`)
      expect(html).toContain('Publicar')
      expect(html).toContain('Transcrição / texto')
      expect(html).toContain('Sem cidade')
      expect(html).toContain(`/campanha/comunicacao/conteudos/${piece.id}/arquivo`)

      const publish = await request.post(`/campanha/comunicacao/conteudos/${piece.id}/publicacao`, {
        data: { contentPieceId: piece.id, published: true },
      })
      expect(publish.status()).toBe(200)
      expect(((await publish.json()) as { piece: { status: string } }).piece.status).toBe(
        'publicado',
      )

      const published = await campaign.fixtures.payload.findByID({
        collection: 'contentPiece',
        id: piece.id,
        depth: 0,
      })
      expect(published.slug).toBe(`peca-${marker.toLowerCase()}`)

      const unpublished = await request.post(
        `/campanha/comunicacao/conteudos/${piece.id}/publicacao`,
        { data: { contentPieceId: piece.id, published: false } },
      )
      expect(unpublished.status()).toBe(200)

      const afterUnpublish = await campaign.fixtures.payload.findByID({
        collection: 'contentPiece',
        id: piece.id,
        depth: 0,
      })
      // The kill switch preserves the file and the public URL.
      expect(afterUnpublish.status).toBe('rascunho')
      expect(afterUnpublish.slug).toBe(`peca-${marker.toLowerCase()}`)
      expect(afterUnpublish.media).toBeTruthy()
    })

    test('the list and the ficha show the anonymous circulation counters', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('pecacirc')
      const draftMarker = campaign.fixtures.value('pecacircrascunho')
      const offAirMarker = campaign.fixtures.value('pecacircoff')
      const { piece } = await createPiece(campaign, { marker, status: 'publicado' })
      await createPiece(campaign, { marker: draftMarker })
      const offAir = await createPiece(campaign, { marker: offAirMarker, status: 'publicado' })

      for (const type of ['abertura', 'abertura', 'download', 'compartilhar_link'] as const) {
        await campaign.fixtures.payload.create({
          collection: 'contentEvent',
          data: { type, subjectType: 'peca', subjectId: String(piece.id) },
          overrideAccess: true,
        })
      }
      // Unpublished AFTER circulating: the history stays visible.
      await campaign.fixtures.payload.update({
        collection: 'contentPiece',
        id: offAir.piece.id,
        data: { status: 'rascunho' },
        overrideAccess: true,
      })
      await campaign.fixtures.payload.create({
        collection: 'contentEvent',
        data: { type: 'abertura', subjectType: 'peca', subjectId: String(offAir.piece.id) },
        overrideAccess: true,
      })

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const list = rendered(
        await (await request.get(`/campanha/comunicacao/conteudos?q=${marker}`)).text(),
      )
      expect(list).toContain('Circulação')
      expect(list).toMatch(/Aberturas<\/span><span[^>]*>2<\/span>/)
      expect(list).toMatch(/Downloads<\/span><span[^>]*>1<\/span>/)
      expect(list).toMatch(/WhatsApp<\/span><span[^>]*>0<\/span>/)
      expect(list).toMatch(/Link<\/span><span[^>]*>1<\/span>/)

      const draftList = rendered(
        await (await request.get(`/campanha/comunicacao/conteudos?q=${draftMarker}`)).text(),
      )
      expect(draftList).toContain('Sem dados — ainda não publicada')

      const offAirList = rendered(
        await (await request.get(`/campanha/comunicacao/conteudos?q=${offAirMarker}`)).text(),
      )
      expect(offAirList).toContain('Histórico de quando esteve publicada · peça fora do ar')

      const ficha = rendered(
        await (await request.get(`/campanha/comunicacao/conteudos/${piece.id}`)).text(),
      )
      expect(ficha).toContain('Circulação')
      expect(ficha).toMatch(/Aberturas<\/dt><dd[^>]*>2<\/dd>/)
      expect(ficha).toMatch(/Downloads<\/dt><dd[^>]*>1<\/dd>/)
      expect(ficha).toMatch(/WhatsApp<\/dt><dd[^>]*>0<\/dd>/)
      expect(ficha).toMatch(/Link copiado<\/dt><dd[^>]*>1<\/dd>/)
      expect(ficha).toContain('compare os sinais sem somá-los')
      expect(ficha).toContain('sem IP persistido, cookie de identidade ou rastreio entre peças')

      for (const pieceId of [piece.id, offAir.piece.id]) {
        await campaign.fixtures.payload
          .delete({
            collection: 'contentEvent',
            where: { subjectId: { equals: String(pieceId) } },
            overrideAccess: true,
          })
          .catch(() => undefined)
      }
    })

    test('the private file answers only the Central roles, with range and download', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('pecafile')
      const { piece, bytes } = await createPiece(campaign, { marker })

      const communicator = await campaign.fixtures.createCampaignUser('communicator')
      const communicatorRequest = await campaignRequest(communicator, communicator.password)

      const full = await communicatorRequest.get(
        `/campanha/comunicacao/conteudos/${piece.id}/arquivo`,
      )
      expect(full.status()).toBe(200)
      expect(full.headers()['content-type']).toBe('video/mp4')
      expect(Buffer.from(await full.body())).toEqual(bytes)

      const partial = await communicatorRequest.get(
        `/campanha/comunicacao/conteudos/${piece.id}/arquivo`,
        { headers: { Range: 'bytes=0-3' } },
      )
      expect(partial.status()).toBe(206)

      const download = await communicatorRequest.get(
        `/campanha/comunicacao/conteudos/${piece.id}/arquivo?download=1`,
      )
      expect(download.headers()['content-disposition']).toContain('attachment')

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      expect(
        (await advisorRequest.get(`/campanha/comunicacao/conteudos/${piece.id}/arquivo`)).status(),
      ).toBe(404)

      const anonymous = await playwrightRequest.newContext({ baseURL: campaign.baseURL })
      try {
        expect(
          (await anonymous.get(`/campanha/comunicacao/conteudos/${piece.id}/arquivo`)).status(),
        ).toBe(404)
      } finally {
        await anonymous.dispose()
      }
    })

    test('the upload and link routes refuse cross-origin and advisor actors', async ({
      campaign,
      campaignRequest,
    }) => {
      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)
      const uploadUrl = '/campanha/comunicacao/conteudos/enviar?filename=t.mp4'

      expect(
        (await request.post(uploadUrl, { headers: { Origin: 'https://evil.example' } })).status(),
      ).toBe(403)
      expect(
        (
          await request.post('/campanha/comunicacao/conteudos/link', {
            headers: { Origin: 'https://evil.example' },
            data: { url: 'https://youtu.be/VIDEO1' },
          })
        ).status(),
      ).toBe(403)

      const advisor = await campaign.fixtures.createCampaignUser('advisor')
      const advisorRequest = await campaignRequest(advisor, advisor.password)
      expect((await advisorRequest.post(uploadUrl)).status()).toBe(403)

      // The JSON route maps the domain refusal through the shared ladder: the
      // safe message reaches the client as a 400 (same as the cut routes).
      const deniedLink = await advisorRequest.post('/campanha/comunicacao/conteudos/link', {
        data: { url: 'https://youtu.be/VIDEO1' },
      })
      expect(deniedLink.status()).toBe(400)
      expect(((await deniedLink.json()) as { message: string }).message).toContain(
        'não tem acesso à Central de Conteúdos',
      )
    })

    test('the link route creates a peça-link and refuses the duplicate', async ({
      campaign,
      campaignRequest,
    }) => {
      const marker = campaign.fixtures.value('pecalink')
      const url = `https://www.instagram.com/reel/${marker}/`

      const user = await campaign.fixtures.createCampaignUser('communicator')
      const request = await campaignRequest(user, user.password)

      const created = await request.post('/campanha/comunicacao/conteudos/link', {
        data: { url: `${url}?igsh=abc` },
      })
      expect(created.status()).toBe(200)
      const body = (await created.json()) as { piece: { id: number; origin: string } }
      expect(body.piece.origin).toBe('instagram')

      const row = await campaign.fixtures.payload.findByID({
        collection: 'contentPiece',
        id: body.piece.id,
        depth: 0,
      })
      expect(row.sourceUrl).toBe(url)

      const duplicate = await request.post('/campanha/comunicacao/conteudos/link', {
        data: { url },
      })
      expect(duplicate.status()).toBe(400)
      expect(((await duplicate.json()) as { message: string }).message).toContain(
        'já está na Central',
      )

      const invalid = await request.post('/campanha/comunicacao/conteudos/link', {
        data: { url: 'https://twitter.com/x/status/1' },
      })
      expect(invalid.status()).toBe(400)
      expect(((await invalid.json()) as { message: string }).message).toContain(
        'Cole um link do Instagram ou do YouTube',
      )
    })
  })
})
