import { randomUUID } from 'node:crypto'

import type { APIRequestContext, Page } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
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
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const doc = ((await response.json()) as { doc: { id: number; slug: string } }).doc
  createdPieceIds.push(doc.id)
  return { id: doc.id, slug: doc.slug }
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

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdPieceIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/contentPiece/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/contentMedia/${id}`, { headers }).catch(() => undefined)
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
    await createPiece(request, headers, { title: photoTitle, type: 'foto' })

    const media = mediaRequests(page)

    const response = await page.goto('/conteudos')
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Uma mensagem sua pode conquistar mais um voto.' }),
    ).toBeVisible()
    await expect(page.getByText('Central de Conteúdos').first()).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(2)
    await expect(page.locator('article[data-content-piece-invite]')).toHaveCount(1)

    // The video mounts no media element and fetches nothing before the play
    // (the photo preview is the only media the catalogue loads on its own).
    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.locator('audio')).toHaveCount(0)
    expect(media.filter((url) => url.includes(video.slug))).toHaveLength(0)

    // Play mounts only the tapped piece and fetches only its media.
    await page.getByRole('button', { name: `Reproduzir ${videoTitle}` }).click()
    await expect(page.locator('video')).toHaveCount(1)
    await expect.poll(() => media.filter((url) => url.includes(video.slug)).length).toBe(1)

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
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: videoTitle, exact: true })).toBeVisible()
    // A filtered board never shows the card invite.
    await expect(page.locator('article[data-content-piece-invite]')).toHaveCount(0)

    await page.goto(`/conteudos?q=${marker}`)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(2)

    await page.goto(`/conteudos?tipo=video&q=${marker}`)
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Remover filtro Tipo: Vídeo/ })).toBeVisible()

    await page.goto('/conteudos?q=zzz-nao-existe')
    await expect(
      page.getByRole('heading', { name: 'Nenhuma peça com esses filtros' }),
    ).toBeVisible()
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
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      new RegExp(photoTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
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

  test('flips the kill switch, the discovery and the piece page without a deploy', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryPiece(request, headers)
    const title = `Peça do kill switch ${uniqueMarker()}`
    const piece = await createPiece(request, headers, { title, type: 'video' })

    await page.goto('/conteudos')
    await expect(page.getByRole('link', { name: 'Conteúdos' })).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)

    await setPieceStatus(request, headers, piece.id, 'rascunho')

    await page.goto('/conteudos')
    await expect(
      page.getByRole('heading', { name: 'As primeiras peças estão a caminho' }),
    ).toBeVisible()
    await expect(page.locator('article[data-content-piece]')).toHaveCount(0)
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

    await setPieceStatus(request, headers, piece.id, 'publicado')
    await page.goto('/conteudos')
    await expect(page.locator('article[data-content-piece]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Conteúdos' })).toBeVisible()
  })
})
