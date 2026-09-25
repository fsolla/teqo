import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import type { APIRequestContext, Page } from '@playwright/test'
import sharp from 'sharp'

import { loadMunicipalityGeometryModule } from '../../src/lib/bahiaGeometries.js'
import { getMunicipalityCatalogEntry } from '../../src/lib/municipalityCatalog.js'
import { slugify } from '../../src/lib/slug.js'
import { adminHeaders } from '../helpers/adminApi'
import { interiorPointOf } from '../helpers/featureBounds'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S27 — the public Central de Conteúdos over real HTTP: the published pieces
 * of C211 list with the five facets, the media is only fetched on the play,
 * the share sheet carries the editable vote message with no recipient, the
 * download name is legible and the kill switch flips the page, the discovery
 * link and the piece page without a deploy.
 *
 * Pieces and media are seeded through the deployed REST API (admin session) so
 * the server process runs the real cache hooks; a Local API call from the
 * runner would throw on `revalidateTag` (same reason as the S21 spec).
 *
 * The tests are serial: the empty-state assertions need a global window with
 * zero published pieces, and only this spec owns content piece rows.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// 1×1 opaque PNG — enough for the photo upload.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TEST_MP4 = Buffer.from('fixture-content-piece-video-bytes')

type Headers = Record<string, string>

const createdPieceIds: number[] = []
const createdMediaIds: number[] = []
const createdContactIds: number[] = []
const createdLeadershipIds: number[] = []

const uniqueMarker = () => randomUUID().slice(0, 8)

const mediaFor = (type: 'video' | 'foto' | 'texto') => {
  if (type === 'video') return { mimetype: 'video/mp4', buffer: TEST_MP4, extension: 'mp4' }
  if (type === 'foto') return { mimetype: 'image/png', buffer: TEST_PNG, extension: 'png' }
  return {
    mimetype: 'text/plain',
    buffer: Buffer.from('Peça voto pra Solla 1313.'),
    extension: 'txt',
  }
}

const createContentMedia = async (
  request: APIRequestContext,
  headers: Headers,
  name: string,
  mimetype: string,
  buffer: Buffer,
): Promise<number> => {
  const response = await request.post(`${BASE_URL}/api/contentMedia`, {
    headers,
    multipart: {
      _payload: JSON.stringify({ alt: name }),
      file: { name, mimeType: mimetype, buffer },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdMediaIds.push(id)
  return id
}

const createPiece = async (
  request: APIRequestContext,
  headers: Headers,
  data: {
    title: string
    type: 'video' | 'foto' | 'texto' | 'audio' | 'card'
    withMedia?: boolean
    origin?: 'arquivo' | 'instagram' | 'youtube'
    sourceUrl?: string
    /** S39 — the home sample resolves the município name from this relation. */
    municipality?: number
    /** S37 — the campaign leaders and curated figures this piece carries. */
    leaders?: number[]
    publicFigures?: string[]
  },
): Promise<{ id: number; slug: string }> => {
  const mediaKind = data.type === 'video' || data.type === 'foto' ? data.type : 'texto'
  const mediaSpec = mediaFor(mediaKind)
  const media =
    data.withMedia === false
      ? null
      : await createContentMedia(
          request,
          headers,
          `${data.title.replace(/\s+/g, '-')}.${mediaSpec.extension}`,
          mediaSpec.mimetype,
          mediaSpec.buffer,
        )

  const response = await request.post(`${BASE_URL}/api/contentPiece`, {
    headers,
    data: {
      title: data.title,
      type: data.type,
      status: 'publicado',
      origin: data.origin ?? 'arquivo',
      ...(media ? { media } : {}),
      ...(data.sourceUrl ? { sourceUrl: data.sourceUrl } : {}),
      ...(data.municipality ? { municipality: data.municipality } : {}),
      ...(data.leaders ? { leaders: data.leaders } : {}),
      ...(data.publicFigures ? { publicFigures: data.publicFigures } : {}),
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const doc = ((await response.json()) as { doc: { id: number; slug: string } }).doc
  createdPieceIds.push(doc.id)
  return { id: doc.id, slug: doc.slug }
}

/**
 * S37 — a real leadership record (contact + municipality link) for the public
 * "Lideranças" facet: the piece references the record, only the name is public.
 */
const createLeadershipWithContact = async (
  request: APIRequestContext,
  headers: Headers,
  name: string,
): Promise<{ leadershipId: number }> => {
  const contactResponse = await request.post(`${BASE_URL}/api/contact`, {
    headers,
    data: { name },
  })
  expect(contactResponse.ok(), await contactResponse.text()).toBeTruthy()
  const contactId = ((await contactResponse.json()) as { doc: { id: number } }).doc.id
  createdContactIds.push(contactId)

  const municipalityResponse = await request.get(
    `${BASE_URL}/api/municipality?limit=1&depth=0&sort=name`,
    { headers },
  )
  expect(municipalityResponse.ok(), await municipalityResponse.text()).toBeTruthy()
  const municipalityId = ((await municipalityResponse.json()) as { docs: { id: number }[] })
    .docs[0]!.id

  const leadershipResponse = await request.post(`${BASE_URL}/api/leadership`, {
    headers,
    data: { contact: contactId, municipalities: [municipalityId] },
  })
  expect(leadershipResponse.ok(), await leadershipResponse.text()).toBeTruthy()
  const leadershipId = ((await leadershipResponse.json()) as { doc: { id: number } }).doc.id
  createdLeadershipIds.push(leadershipId)
  return { leadershipId }
}

const setPieceStatus = async (
  request: APIRequestContext,
  headers: Headers,
  id: number,
  status: 'rascunho' | 'publicado',
): Promise<void> => {
  const response = await request.patch(`${BASE_URL}/api/contentPiece/${id}`, {
    headers,
    data: { status },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

/** Zero published pieces globally so the empty-state assertions stay deterministic. */
const unpublishEveryPiece = async (request: APIRequestContext, headers: Headers) => {
  const listed = await request.get(`${BASE_URL}/api/contentPiece?limit=0&depth=0`, { headers })
  expect(listed.ok(), await listed.text()).toBeTruthy()
  const { docs } = (await listed.json()) as { docs: { id: number; status?: string | null }[] }
  for (const doc of docs) {
    if (doc.status === 'publicado') await setPieceStatus(request, headers, doc.id, 'rascunho')
  }
}

const mediaRequests = (page: Page) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/\/conteudos\/.+\/midia/.test(request.url())) requests.push(request.url())
  })
  return requests
}

/**
 * C226 — the still is a separate door (`/frame`, a sibling of `/midia`), so the
 * S27 pin above keeps meaning "no file before the play" while this one means
 * "the image is asked for before the play".
 */
const frameRequests = (page: Page) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/\/conteudos\/.+\/frame/.test(request.url())) requests.push(request.url())
  })
  return requests
}

/**
 * C226 — the still door is stubbed like the other third-party routes: what
 * depends on ffmpeg (the extraction) would otherwise decide whether this spec
 * sees a rendered frame or the honest neutral slot, differently on a developer
 * machine and in CI. The server contract (200 vs 404, the kill switch) is
 * pinned where it belongs, in the int spec; here the card's own behavior —
 * asking for the still before the play and dropping it after — is the subject.
 */
const stubContentPieceFrames = async (page: Page): Promise<void> => {
  // A real 16:9 JPEG (the browser rejects a truncated one, and the card's own
  // fallback would then hide a bug this spec is here to catch).
  const still = await sharp({
    create: { width: 320, height: 180, channels: 3, background: { r: 24, g: 78, b: 146 } },
  })
    .jpeg()
    .toBuffer()
  await page.route('**/conteudos/*/frame', (route) =>
    route.fulfill({ body: still, contentType: 'image/jpeg' }),
  )
}

/**
 * C106/S28 — dynamic pages stream a transient hidden `S:` copy of the shell in
 * the production build (the theme path reads `next/headers`, and any heavy
 * render can defer behind `loading.tsx`). Wait for the stream to be collected
 * before asserting with strict locators.
 */
const waitForSettledPage = async (page: Page) => {
  await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)
}

/**
 * S39 — the home is ISR and the section is gated by the same listing tag as the
 * catalogue; poll the server HTML until the kill switch converged (the
 * navigation that follows always lands on the fresh page).
 */
const waitForHomeSection = async (
  request: APIRequestContext,
  expected: 'present' | 'absent',
  attempts = 12,
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await request.get(`${BASE_URL}/`).catch(() => undefined)
    if (response?.ok()) {
      const html = await response.text()
      const present = html.includes('data-home-section="content-pieces"')
      if ((expected === 'present') === present) return
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`A seção da Central não convergiu para "${expected}" em ${attempts}s.`)
}

test.describe.configure({ mode: 'serial' })

// C226 — the still of a video piece is asked for before the play and answers
// 404 until the self-heal lands (the fixtures here are not decodifiable video,
// and the extraction needs ffmpeg). The browser logs that refusal, so the spec
// declares the door: the frame's own 200/404 contract is pinned in the int spec
// and the rendered still in the lazy test below.
test.use({ expectedRequestFailurePaths: [/\/conteudos\/.+\/frame$/] })

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdPieceIds.splice(0)) {
    // C213 — the anonymous events of the piece go with it (the spec owns both).
    await request
      .delete(`${BASE_URL}/api/contentEvent?where[subjectId][equals]=${id}`, { headers })
      .catch(() => undefined)
    await request.delete(`${BASE_URL}/api/contentPiece/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/contentMedia/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdLeadershipIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/leadership/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdContactIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/contact/${id}`, { headers }).catch(() => undefined)
  }
})

test.describe('Frontend Central de Conteúdos (S27)', () => {
  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
  })

  test('lists the published pieces, keeps the media lazy and shares the vote', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const videoTitle = `Fim da escala ${uniqueMarker()}`
    const photoTitle = `Solla no SUS ${uniqueMarker()}`
    const video = await createPiece(request, headers, { title: videoTitle, type: 'video' })
    const photo = await createPiece(request, headers, { title: photoTitle, type: 'foto' })

    const media = mediaRequests(page)
    const frames = frameRequests(page)
    await stubContentPieceFrames(page)

    const response = await page.goto('/conteudos')
    expect(response?.status()).toBe(200)
    await waitForSettledPage(page)
    await expect(
      page.getByRole('heading', { name: 'Uma mensagem sua pode conquistar mais um voto.' }),
    ).toBeVisible()
    await expect(page.getByText('Central de Conteúdos').first()).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(2)
    // S38 — the six models are items of the same board: the card item and the
    // pieces share one grid (no section of their own, no invite tile).
    await expect(page.locator('[data-card-model]')).toHaveCount(6)
    // The video piece shares the full-card grid with the models (the photo is a
    // compact row below): the models are items of the board, not a section.
    const board = page.locator('[data-card-model]').first().locator('xpath=..')
    await expect(board.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(board.locator('[data-card-model]')).toHaveCount(6)
    await expect(page.locator('[data-card-model="time-de-voce"]')).toHaveAttribute(
      'href',
      '/cards?model=time-de-voce',
    )
    await expect(
      page.locator('[data-card-model="minha-colinha"]').getByText('santinho'),
    ).toBeVisible()

    // The video mounts no media element and fetches nothing before the play
    // (the photo preview is the only media the catalogue loads on its own).
    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.locator('audio')).toHaveCount(0)
    expect(media.filter((url) => url.includes(video.slug))).toHaveLength(0)

    // C226 — the still is a lightweight image asked for BEFORE the play, and it
    // is a different door from the file: a photo piece never asks for one.
    const still = page.locator('article[data-content-piece] img[src$="/frame"]')
    await expect(still).toHaveCount(1)
    await expect
      .poll(() => frames.filter((url) => url.includes(video.slug)).length)
      .toBeGreaterThan(0)
    expect(frames.filter((url) => url.includes(photo.slug))).toHaveLength(0)
    // The still really rendered (a card never shows a broken image) and the
    // play button is still the point of highest contrast over it.
    await expect
      .poll(() => still.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: `Reproduzir ${videoTitle}` })).toBeVisible()

    // Play mounts only the tapped piece and fetches only its media. The still
    // leaves the slot: the player takes the same 16:9 box (cena 03).
    await page.getByRole('button', { name: `Reproduzir ${videoTitle}` }).click()
    await expect(page.locator('video')).toHaveCount(1)
    await expect.poll(() => media.filter((url) => url.includes(video.slug)).length).toBe(1)
    await expect(page.locator('article[data-content-piece] img[src$="/frame"]')).toHaveCount(0)

    // The download carries the legible name built from the slug.
    await expect(page.getByRole('link', { name: `Baixar ${videoTitle}` })).toHaveAttribute(
      'download',
      `jorge-solla-1313-${video.slug}.mp4`,
    )

    // The share sheet: editable vote message, wa.me without recipient.
    await page.getByRole('button', { name: `Compartilhar ${videoTitle}` }).click()
    const sheet = page.getByRole('dialog', { name: 'Compartilhar peça' })
    await expect(sheet).toBeVisible()
    const message = sheet.getByLabel('Mensagem para compartilhar')
    await expect(message).toHaveValue(new RegExp(videoTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    const whatsApp = sheet.getByRole('link', { name: 'Abrir no WhatsApp' })
    const href = await whatsApp.getAttribute('href')
    expect(href).toContain('https://wa.me/?text=')
    expect(new URL(href!).pathname).toBe('/')
    expect(decodeURIComponent(href!)).toContain(`/conteudos/${video.slug}`)
    await message.fill('Mensagem revisada pela pessoa.')
    await expect(whatsApp).toHaveAttribute('href', /Mensagem\+revisada/)

    // "A mídia" falls back to the download of the same file where the device
    // cannot share files (headless Linux has no Web Share API).
    const [downloadEvent] = await Promise.all([
      page.waitForEvent('download'),
      sheet.getByRole('button', { name: 'A mídia' }).click(),
    ])
    expect(downloadEvent.suggestedFilename()).toBe(`jorge-solla-1313-${video.slug}.mp4`)

    await sheet.getByRole('button', { name: 'Fechar', exact: true }).click()
    await expect(sheet).toHaveCount(0)
  })

  test('filters by facet and term and shows the honest no-results state', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const marker = uniqueMarker()
    const videoTitle = `Debate na rádio ${marker}`
    const video = await createPiece(request, headers, { title: videoTitle, type: 'video' })
    await createPiece(request, headers, { title: `Card do giro ${marker}`, type: 'foto' })

    await page.goto(`/conteudos?tipo=video`)
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: videoTitle, exact: true })).toBeVisible()
    // A filtered board never shows the card models that the facet excludes.
    await expect(page.locator('[data-card-model]')).toHaveCount(0)

    await page.goto(`/conteudos?q=${marker}`)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(2)

    await page.goto(`/conteudos?tipo=video&q=${marker}`)
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Remover filtro Tipo: Vídeo/ })).toBeVisible()

    await page.goto('/conteudos?q=zzz-nao-existe')
    await waitForSettledPage(page)
    await expect(page.getByText('Busca: “zzz-nao-existe”')).toBeVisible()
    const clear = page.getByRole('link', { name: 'Limpar filtros' })
    await expect(clear).toHaveAttribute('href', '/conteudos')
    await clear.click()
    await expect(page).toHaveURL(/\/conteudos$/)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(2)

    // The video card link opens the piece page with the back link.
    await page.getByRole('link', { name: videoTitle, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/conteudos/${video.slug}$`))
    await expect(page.getByRole('heading', { name: videoTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar à Central' })).toBeVisible()
  })

  test('lists the card models by nickname, filters by Tipo Card and routes to the studio (S38)', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    await createPiece(request, headers, {
      title: `Peça do catálogo ${uniqueMarker()}`,
      type: 'video',
    })

    // The nickname search finds the models that answer to it (no JS: querystring).
    await page.goto('/conteudos?q=santinho')
    await waitForSettledPage(page)
    await expect(page.locator('[data-card-model]')).toHaveCount(2)
    await expect(page.locator('[data-card-model="time-de-voce"]')).toBeVisible()
    await expect(page.locator('[data-card-model="minha-colinha"]')).toBeVisible()

    await page.goto('/conteudos?q=foto+de+perfil')
    await waitForSettledPage(page)
    await expect(page.locator('[data-card-model]')).toHaveCount(2)
    await expect(page.locator('[data-card-model="perfil-quadrado"]')).toBeVisible()
    await expect(page.locator('[data-card-model="perfil-retangular"]')).toBeVisible()

    // Tipo Card brings the six models and the published piece leaves the board.
    await page.goto('/conteudos?tipo=card')
    await waitForSettledPage(page)
    await expect(page.locator('[data-card-model]')).toHaveCount(6)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(0)

    // A geographic facet removes the models: they are not territorial.
    await page.goto('/conteudos?cidade=salvador')
    await waitForSettledPage(page)
    await expect(page.locator('[data-card-model]')).toHaveCount(0)

    // The item routes to the studio with the model chosen and counts the opening
    // through the anonymous beacon (never a piece event).
    await page.goto('/conteudos?tipo=card')
    await waitForSettledPage(page)
    const openingBeacon = page.waitForRequest((candidate) => {
      if (!candidate.url().includes('/api/content-events')) return false
      try {
        const body = candidate.postDataJSON() as { type?: string; cardModelId?: string } | null
        return body?.type === 'abertura' && body?.cardModelId === 'minha-colinha'
      } catch {
        return false
      }
    })
    await page.locator('[data-card-model="minha-colinha"]').click()
    await expect(page).toHaveURL(/\/cards\?model=minha-colinha$/)
    await openingBeacon
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('offers the theme mode and degrades honestly without the provider key', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const marker = uniqueMarker()
    const title = `Saúde do trabalhador ${marker}`
    await createPiece(request, headers, { title, type: 'video' })

    // The e2e build blanks DEEPSEEK_API_KEY (same as the C192 spec), so the
    // theme mode always degrades: the exact results stay and the notice explains.
    const response = await page.goto(`/conteudos?q=${marker}&mode=tema`)
    expect(response?.status()).toBe(200)
    await waitForSettledPage(page)
    await expect(page.getByRole('heading', { name: `Resultados para “${marker}”` })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Termo exato' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Por tema' })).toBeDisabled()
    await expect(page.getByText('Busca por tema indisponível agora.')).toBeVisible()
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
    await expect(page.getByText('Por que apareceu')).toHaveCount(0)

    // A mode without a query has nothing to expand: no notice, exact is active.
    await page.goto('/conteudos?mode=tema')
    await waitForSettledPage(page)
    await expect(page.getByText('Busca por tema indisponível agora.')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'Termo exato' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Por tema' })).toBeEnabled()

    // Changing the mode submits the GET form with the query in force.
    await page.goto(`/conteudos?q=${marker}`)
    await waitForSettledPage(page)
    await page.getByRole('radio', { name: 'Por tema' }).check()
    await expect(page).toHaveURL(new RegExp(`q=${marker}&mode=tema$`))
    // The URL commits before the new document renders: wait for the page's own
    // content and for the streamed copy to be collected before the strict locator.
    await expect(page.getByRole('heading', { name: `Resultados para “${marker}”` })).toHaveCount(1)
    await waitForSettledPage(page)
    await expect(page.getByText('Busca por tema indisponível agora.')).toBeVisible()

    // Enter on the field searches without JS (the canonical block has no button).
    await page.goto('/conteudos')
    await waitForSettledPage(page)
    const field = page.getByRole('searchbox', { name: 'Buscar peças' })
    await field.fill(marker)
    await field.press('Enter')
    await expect(page).toHaveURL(new RegExp(`q=${marker}&mode=exato$`))
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
  })

  test('opens the piece page with OG preview and the same actions', async ({ page, request }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const photoTitle = `Solla em defesa do SUS ${uniqueMarker()}`
    const photo = await createPiece(request, headers, { title: photoTitle, type: 'foto' })

    const response = await page.goto(`/conteudos/${photo.slug}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: photoTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: `Baixar ${photoTitle}` })).toHaveAttribute(
      'download',
      `jorge-solla-1313-${photo.slug}.png`,
    )
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
      'content',
      new RegExp(photoTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      'content',
      new RegExp(`/conteudos/${photo.slug}/midia$`),
    )

    await page.getByRole('button', { name: `Compartilhar ${photoTitle}` }).click()
    const sheet = page.getByRole('dialog', { name: 'Compartilhar peça' })
    await expect(sheet.getByLabel('Mensagem para compartilhar')).toHaveValue(
      /Fiz\/achei esse material do Solla 1313/,
    )
  })

  test('shares a link piece by the platform URL with no download action', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const linkTitle = `Post no Instagram ${uniqueMarker()}`
    const shortcode = uniqueMarker().toUpperCase()
    const link = await createPiece(request, headers, {
      title: linkTitle,
      type: 'video',
      withMedia: false,
      origin: 'instagram',
      sourceUrl: `https://www.instagram.com/reel/${shortcode}/`,
    })

    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: `Baixar ${linkTitle}` })).toHaveCount(0)

    await page.getByRole('button', { name: `Compartilhar ${linkTitle}` }).click()
    const sheet = page.getByRole('dialog', { name: 'Compartilhar peça' })
    await expect(sheet.getByRole('button', { name: 'A mídia' })).toHaveCount(0)
    const href = await sheet.getByRole('link', { name: 'Abrir no WhatsApp' }).getAttribute('href')
    expect(decodeURIComponent(href!)).toContain(`https://www.instagram.com/reel/${shortcode}/`)

    await page.goto(`/conteudos/${link.slug}`)
    await expect(page.getByText('A mídia permanece na plataforma original.')).toBeVisible()
    await expect(
      page.getByText('O compartilhamento usa o link da publicação no Instagram.'),
    ).toBeVisible()
  })

  test('counts the anonymous circulation of the piece', async ({ page, request, context }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const title = `Circulação anônima ${uniqueMarker()}`
    const piece = await createPiece(request, headers, { title, type: 'video' })

    const eventCount = async (type: string): Promise<number> => {
      const response = await request.get(
        `${BASE_URL}/api/contentEvent?limit=0&depth=0&where[and][0][subjectId][equals]=${piece.id}&where[and][1][type][equals]=${type}`,
        { headers },
      )
      expect(response.ok(), await response.text()).toBeTruthy()
      return ((await response.json()) as { totalDocs: number }).totalDocs
    }

    const beaconFor = (type: string) =>
      page.waitForRequest((candidate) => {
        if (!candidate.url().includes('/api/content-events')) return false
        try {
          return (candidate.postDataJSON() as { type?: string } | null)?.type === type
        } catch {
          return false
        }
      })

    // Abertura: the piece page mount beacons once, carrying the public slug.
    const openBeacon = beaconFor('abertura')
    await page.goto(`/conteudos/${piece.slug}`)
    expect((await openBeacon).postDataJSON()).toEqual({ type: 'abertura', pieceSlug: piece.slug })
    await expect.poll(() => eventCount('abertura')).toBe(1)

    // Download: the SERVER counts the full file request (the click alone would
    // count a cancelled download).
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: `Baixar ${title}` }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`jorge-solla-1313-${piece.slug}.mp4`)
    await expect.poll(() => eventCount('download')).toBe(1)

    // WhatsApp and link stay apart, each counted on its own control.
    await page.getByRole('button', { name: `Compartilhar ${title}` }).click()
    const sheet = page.getByRole('dialog', { name: 'Compartilhar peça' })
    await context.route('https://wa.me/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/html' }),
    )
    const whatsAppBeacon = beaconFor('compartilhar_whatsapp')
    await sheet.getByRole('link', { name: 'Abrir no WhatsApp' }).click()
    await whatsAppBeacon

    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const linkBeacon = beaconFor('compartilhar_link')
    await sheet.getByRole('button', { name: 'Copiar link' }).click()
    await linkBeacon

    await expect.poll(() => eventCount('compartilhar_whatsapp')).toBe(1)
    await expect.poll(() => eventCount('compartilhar_link')).toBe(1)

    // The stored event is the subject only: no IP, cookie, user-agent or any
    // other visitor identifier — the privacy contract, pinned row by row.
    // (`variant` is the S32 state-deputy slug sub-key: a public catalog slug,
    // never a visitor identifier.)
    const listed = await request.get(
      `${BASE_URL}/api/contentEvent?limit=1&depth=0&where[subjectId][equals]=${piece.id}`,
      { headers },
    )
    const doc = ((await listed.json()) as { docs: Record<string, unknown>[] }).docs[0]!
    expect(Object.keys(doc).sort()).toEqual([
      'createdAt',
      'id',
      'subjectId',
      'subjectType',
      'type',
      'updatedAt',
      'variant',
    ])
  })

  test('flips the kill switch, the discovery and the piece page without a deploy', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const title = `Peça do kill switch ${uniqueMarker()}`
    const piece = await createPiece(request, headers, { title, type: 'video' })

    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(page.getByRole('link', { name: 'Conteúdos' })).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.locator('[data-card-model]')).toHaveCount(6)

    await setPieceStatus(request, headers, piece.id, 'rascunho')

    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(
      page.getByRole('heading', { name: 'As primeiras peças estão a caminho' }),
    ).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(0)
    // S38 — an empty Central is the honest empty state, never a board of cards.
    await expect(page.locator('[data-card-model]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Conteúdos' })).toHaveCount(0)
    await expect
      .poll(async () =>
        (await (await request.get(`${BASE_URL}/conteudos`)).text()).includes('noindex, nofollow'),
      )
      .toBe(true)

    // The raw HTTP status is the 404 contract and the honest copy is in the
    // body (the browser is not navigated to the 404 URL: the failure guard
    // fails a test on the expected resource error).
    const unpublished = await request.get(`/conteudos/${piece.slug}`)
    expect(unpublished.status()).toBe(404)
    expect(await unpublished.text()).toContain('Esta peça não está disponível')

    // C226 — the still door closes with the file door: an unpublished piece
    // stops exposing its derived frame exactly the same way.
    expect((await request.get(`/conteudos/${piece.slug}/midia`)).status()).toBe(404)
    expect((await request.get(`/conteudos/${piece.slug}/frame`)).status()).toBe(404)

    await setPieceStatus(request, headers, piece.id, 'publicado')
    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Conteúdos' })).toBeVisible()
  })

  test('shows the Central sample on the home and hides it with the kill switch', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    await createPiece(request, headers, { title: `Peça da home ${uniqueMarker()}`, type: 'foto' })
    await createPiece(request, headers, { title: `Vídeo da home ${uniqueMarker()}`, type: 'video' })

    await waitForHomeSection(request, 'present')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/?e2e=${Date.now()}`)
    const section = page.locator('[data-home-section="content-pieces"]')
    await expect(section).toBeVisible()
    // S39 — the sample sits between the cards and the newsletter (the home spec
    // keeps this pin agnostic because the section is conditional).
    const order = await page
      .locator('[data-home-section]')
      .evaluateAll((sections) => sections.map((s) => s.getAttribute('data-home-section')))
    expect(order.indexOf('cards')).toBeLessThan(order.indexOf('content-pieces'))
    expect(order.indexOf('content-pieces')).toBeLessThan(order.indexOf('newsletter'))
    await expect(section.getByRole('heading', { name: 'Peça voto pra Solla 1313' })).toBeVisible()
    await expect(section.getByRole('link', { name: /Ver todas as peças/ })).toHaveAttribute(
      'href',
      '/conteudos',
    )
    await expect(section.locator('article[data-content-piece]')).toHaveCount(2)
    // Nothing plays on its own: the video mounts no media element before the tap.
    await expect(section.locator('video, audio')).toHaveCount(0)
    // Cena 02 — the sample never overflows the phone.
    const overflow = await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-theme="campaign-site"]')
      return container ? container.scrollWidth - container.clientWidth : 0
    })
    expect(overflow).toBeLessThanOrEqual(1)

    await unpublishEveryPiece(request, headers)
    await waitForHomeSection(request, 'absent')
    await page.goto(`/?e2e=${Date.now()}`)
    await expect(page.locator('[data-home-section="content-pieces"]')).toHaveCount(0)
  })

  test('samples the visitor município on the home when the permission is granted', async ({
    page,
    request,
    context,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)

    const entry = getMunicipalityCatalogEntry('feira-de-santana')
    if (!entry || entry.kind !== 'municipio') throw new Error('Catálogo sem Feira de Santana.')
    const geometry = await loadMunicipalityGeometryModule()
    const feature = geometry.features.find(
      (candidate) => candidate.properties.codarea === entry.ibgeCode,
    )
    if (!feature) throw new Error('Malha municipal sem Feira de Santana.')
    const point = interiorPointOf(feature)

    const listed = await request.get(
      `${BASE_URL}/api/municipality?where[slug][equals]=${entry.slug}&limit=1&depth=0`,
      { headers },
    )
    expect(listed.ok(), await listed.text()).toBeTruthy()
    const { docs } = (await listed.json()) as { docs: { id: number }[] }
    const municipality = docs[0]
    if (!municipality) throw new Error('Município não semeado no banco de teste.')

    const title = `Peça de Feira de Santana ${uniqueMarker()}`
    await createPiece(request, headers, { title, type: 'foto', municipality: municipality.id })
    await waitForHomeSection(request, 'present')

    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: point.lat, longitude: point.lng })

    await page.goto(`/?e2e=${Date.now()}`)
    const section = page.locator('[data-home-section="content-pieces"]')
    await expect(section.locator('[data-sample-tag="municipality"]')).toBeVisible()
    // Exact: the sr-only live region announces "Peças do seu município".
    await expect(section.getByText('Do seu município', { exact: true })).toBeVisible()
    await expect(section.getByRole('link', { name: title })).toBeVisible()
  })
  test('filters by who appears in the piece and removes a name when unpublished (S37)', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const marker = uniqueMarker()
    const leaderName = `Maria Silva ${marker}`
    const personSlug = slugify(leaderName)
    const title = `Giro com a liderança ${marker}`
    const { leadershipId } = await createLeadershipWithContact(request, headers, leaderName)
    const piece = await createPiece(request, headers, {
      title,
      type: 'video',
      leaders: [leadershipId],
      publicFigures: ['dra elaine'],
    })

    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    // The card's metadata line leads with who appears in the piece.
    await expect(
      page.locator('article[data-content-piece]').getByText(leaderName, { exact: true }),
    ).toBeVisible()

    // The one "Lideranças" facet unions the leader name and the curated figure.
    await page.locator('summary').filter({ hasText: 'Lideranças' }).first().click()
    await expect(
      page.getByText('Em peças publicadas').filter({ visible: true }).first(),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dra. Elaine', exact: true })).toBeVisible()
    await page.getByRole('link', { name: leaderName, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`lideranca=${personSlug}$`))
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(
      page
        .getByRole('link', { name: /Remover filtro Lideranças/ })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()

    // Searching the name finds the piece (the haystack carries it).
    await page.goto(`/conteudos?q=${encodeURIComponent(leaderName)}`)
    await waitForSettledPage(page)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)

    // Unpublishing the last piece with the name removes it from the facet.
    await setPieceStatus(request, headers, piece.id, 'rascunho')
    await page.goto('/conteudos')
    await waitForSettledPage(page)
    await expect(page.locator('summary').filter({ hasText: 'Lideranças' })).toHaveCount(0)
  })

  /**
   * S36 regression (production report 2026-09-25): the negative lockup ships
   * with a transparent frame and the header crops it with a fixed window. A
   * window with a different aspect ratio than the ink clips the base of
   * "SOLLA" (that was the shipped S36: a 188x50 window over a 187.4x67.6 ink,
   * 18px lost at the bottom). The real asset is measured with sharp and the
   * rendered ink box must fit inside the crop window at both breakpoints.
   */
  test('keeps the whole brand ink inside the header crop, both breakpoints (S36)', async ({
    page,
  }) => {
    const assetPath = join(process.cwd(), 'public/campaign-kit/jorge-solla-negativo.png')
    const canvas = await sharp(assetPath).metadata()
    const { info: ink } = await sharp(assetPath).trim().toBuffer({ resolveWithObject: true })
    const assetInk = {
      canvasWidth: canvas.width!,
      left: -ink.trimOffsetLeft!,
      top: -ink.trimOffsetTop!,
      width: ink.width,
      height: ink.height,
    }

    const measureAt = async (viewport: { width: number; height: number }) => {
      await page.setViewportSize(viewport)
      await page.goto('/conteudos')
      await waitForSettledPage(page)
      const logo = page.locator('header img[alt="Jorge Solla"]')
      await expect(logo).toBeVisible()
      return logo.evaluate((node, box) => {
        const image = node as HTMLImageElement
        const crop = image.parentElement!.getBoundingClientRect()
        const rendered = image.getBoundingClientRect()
        const scale = rendered.width / box.canvasWidth
        return {
          crop: { top: crop.top, right: crop.right, bottom: crop.bottom, left: crop.left },
          ink: {
            top: rendered.top + box.top * scale,
            right: rendered.left + (box.left + box.width) * scale,
            bottom: rendered.top + (box.top + box.height) * scale,
            left: rendered.left + box.left * scale,
          },
        }
      }, assetInk)
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const { crop, ink: renderedInk } = await measureAt(viewport)
      const at = `@${viewport.width}px`
      expect(renderedInk.top, `ink top clipped ${at}`).toBeGreaterThanOrEqual(crop.top - 0.5)
      expect(renderedInk.left, `ink left clipped ${at}`).toBeGreaterThanOrEqual(crop.left - 0.5)
      expect(renderedInk.bottom, `ink bottom clipped ${at}`).toBeLessThanOrEqual(crop.bottom + 0.5)
      expect(renderedInk.right, `ink right clipped ${at}`).toBeLessThanOrEqual(crop.right + 0.5)
    }
  })
})
