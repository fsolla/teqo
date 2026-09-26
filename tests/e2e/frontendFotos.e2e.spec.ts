import { randomUUID } from 'node:crypto'

import type { APIRequestContext, Page } from '@playwright/test'
import sharp from 'sharp'

import { getMunicipalityCatalogEntry } from '../../src/lib/municipalityCatalog.js'
import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * C233 — the public photo album over real HTTP: only approved photos list, the
 * facets/term filter the strip, the overlay opens from `?foto=`, the media
 * (thumbnail and download) goes through the same-origin private proxy, an
 * `approved→removed` edit pulls the photo down immediately and the
 * `photoAlbum.published` kill switch closes the route without a deploy.
 *
 * Photos and the global are seeded through the deployed REST API (admin
 * session) so the server process runs the real cache hooks; a Local API call
 * from the runner would throw on `revalidateTag` (same reason as the S21/S27
 * specs).
 *
 * The tests are serial: only this spec owns archive photo rows.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const REMOVAL_CHANNEL = 'https://example.org/acervo/remocao'

// Read-only catalog lookups (never pinned/written rows — see the allocator
// guard): the spec only mutates its own archive photos. A missing catalog entry
// is a broken fixture and fails loudly instead of deep-linking an empty slug.
const catalogEntry = (slug: string) => {
  const entry = getMunicipalityCatalogEntry(slug)
  if (!entry) throw new Error(`município fora do catálogo: ${slug}`)
  return entry
}
const feira = catalogEntry('feira-de-santana')
const camacari = catalogEntry('camacari')
const feiraSlug = feira.slug
const camacariSlug = camacari.slug
const camacariName = camacari.name
const feiraName = getMunicipalityCatalogEntry('feira-de-santana')?.name ?? ''

type Headers = Record<string, string>

const createdPhotoIds: number[] = []

const uniqueMarker = () => randomUUID().slice(0, 8)

const createTestJpeg = (): Promise<Buffer> =>
  sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 174, g: 22, b: 3 } },
  })
    .jpeg()
    .toBuffer()

const setAlbum = async (
  request: APIRequestContext,
  headers: Headers,
  data: { published: boolean; removalChannelUrl: string | null },
): Promise<void> => {
  const response = await request.post(`${BASE_URL}/api/globals/photoAlbum`, { headers, data })
  expect(response.ok(), await response.text()).toBeTruthy()
}

const setPhotoStatus = async (
  request: APIRequestContext,
  headers: Headers,
  id: number,
  publicationStatus: 'draft' | 'approved' | 'removed',
): Promise<void> => {
  const response = await request.patch(`${BASE_URL}/api/archivePhoto/${id}`, {
    headers,
    data: { publicationStatus },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

const createPhoto = async (
  request: APIRequestContext,
  headers: Headers,
  data: {
    caption: string
    scene: 'plenaria' | 'visita' | 'reuniao'
    people: string[]
    municipality?: number
    takenAt: string
    status?: 'draft' | 'approved'
  },
): Promise<number> => {
  const marker = uniqueMarker()
  const response = await request.post(`${BASE_URL}/api/archivePhoto`, {
    headers,
    multipart: {
      _payload: JSON.stringify({
        flickrId: `c233-e2e-${marker}`,
        alt: `Foto de teste ${marker}: ${data.caption}`,
        publicationStatus: 'draft',
        takenAt: data.takenAt,
        catalog: {
          caption: data.caption,
          description: `${data.caption} (${marker})`,
          scene: data.scene,
          people: data.people,
          ...(data.municipality ? { municipality: data.municipality } : {}),
        },
      }),
      file: { name: `c233-${marker}.jpg`, mimeType: 'image/jpeg', buffer: await createTestJpeg() },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdPhotoIds.push(id)
  if (data.status === 'approved') await setPhotoStatus(request, headers, id, 'approved')
  return id
}

const municipalityId = async (
  request: APIRequestContext,
  headers: Headers,
  slug: string,
): Promise<number> => {
  const response = await request.get(
    `${BASE_URL}/api/municipality?limit=1&depth=0&where[slug][equals]=${slug}`,
    { headers },
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { docs: { id: number }[] }).docs[0]?.id
  if (id == null) throw new Error(`município ausente no seed: ${slug}`)
  return id
}

/** Dynamic pages stream a transient hidden `S:` copy of the shell; wait it out. */
const waitForSettledPage = async (page: Page) => {
  await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)
}

test.describe.configure({ mode: 'serial' })

test.describe('Frontend Álbum de Fotos (C233)', () => {
  let headers: Headers
  let feiraId: number
  let camacariId: number
  let approvedFeira: number
  let approvedCamacari: number
  let draftPhoto: number
  let removedPhoto: number
  const marker = uniqueMarker()

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    headers = await adminHeaders(request, BASE_URL)
    await setAlbum(request, headers, { published: true, removalChannelUrl: REMOVAL_CHANNEL })

    feiraId = await municipalityId(request, headers, 'feira-de-santana')
    camacariId = await municipalityId(request, headers, camacariSlug)

    approvedFeira = await createPhoto(request, headers, {
      caption: `Plenária da saúde ${marker}`,
      scene: 'plenaria',
      people: ['Jorge Solla'],
      municipality: feiraId,
      takenAt: '2026-09-12 10:20:30',
      status: 'approved',
    })
    approvedCamacari = await createPhoto(request, headers, {
      caption: `Visita ao posto ${marker}`,
      scene: 'visita',
      people: ['Rui Costa'],
      municipality: camacariId,
      takenAt: '2026-09-08 09:00:00',
      status: 'approved',
    })
    draftPhoto = await createPhoto(request, headers, {
      caption: `Rascunho interno ${marker}`,
      scene: 'reuniao',
      people: ['Jorge Solla'],
      municipality: feiraId,
      takenAt: '2026-09-10 09:00:00',
    })
    removedPhoto = await createPhoto(request, headers, {
      caption: `Removida a pedido ${marker}`,
      scene: 'reuniao',
      people: ['Jorge Solla'],
      municipality: feiraId,
      takenAt: '2026-09-11 09:00:00',
      status: 'approved',
    })
    await setPhotoStatus(request, headers, removedPhoto, 'removed')
  })

  test.afterAll(async ({ request }) => {
    const cleanupHeaders = await adminHeaders(request, BASE_URL).catch(() => null)
    if (cleanupHeaders) {
      for (const id of createdPhotoIds.splice(0)) {
        await request
          .delete(`${BASE_URL}/api/archivePhoto/${id}`, { headers: cleanupHeaders })
          .catch(() => undefined)
      }
      await setAlbum(request, cleanupHeaders, {
        published: true,
        removalChannelUrl: REMOVAL_CHANNEL,
      }).catch(() => undefined)
    }
  })

  test('lists only approved photos with the curated context', async ({ page, request }) => {
    const response = await page.goto('/fotos')
    expect(response?.status()).toBe(200)
    await waitForSettledPage(page)

    const feiraCard = page.locator(`a[data-photo-id="${approvedFeira}"]`)
    const camacariCard = page.locator(`a[data-photo-id="${approvedCamacari}"]`)

    await expect(feiraCard).toBeVisible()
    await expect(camacariCard).toBeVisible()
    await expect(feiraCard.getByText(`Plenária da saúde ${marker}`)).toBeVisible()
    await expect(feiraCard.getByText(`12 set 2026 · ${feiraName} · Plenária`)).toBeVisible()
    await expect(feiraCard.getByText('Jorge Solla')).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${draftPhoto}"]`)).toHaveCount(0)
    await expect(page.locator(`a[data-photo-id="${removedPhoto}"]`)).toHaveCount(0)

    // The image is the same-origin proxy thumbnail, with the curated alt.
    const thumbnail = feiraCard.locator('img')
    await expect(thumbnail).toHaveAttribute('src', `/fotos/${approvedFeira}/midia?tamanho=grade`)
    await expect(thumbnail).toHaveAttribute('alt', new RegExp(`^Foto de teste .*${marker}`))

    const thumbnailResponse = await request.get(
      `${BASE_URL}/fotos/${approvedFeira}/midia?tamanho=grade`,
    )
    expect(thumbnailResponse.status()).toBe(200)
    expect(thumbnailResponse.headers()['content-type']).toBe('image/jpeg')
    expect(thumbnailResponse.headers()['x-robots-tag']).toBe('noindex')
    expect(thumbnailResponse.headers()['cache-control']).toContain('no-store')

    // The draft and the removed photo answer the same silent 404 on their door.
    for (const id of [draftPhoto, removedPhoto]) {
      const denied = await request.get(`${BASE_URL}/fotos/${id}/midia?tamanho=grade`)
      expect(denied.status()).toBe(404)
    }
  })

  test('filters by município, atividade, pessoa and term, and shows the honest no-results', async ({
    page,
  }) => {
    await page.goto(`/fotos?municipio=${camacariSlug}`)
    await waitForSettledPage(page)
    await expect(page.getByRole('heading', { name: `Fotos em ${camacariName}` })).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedCamacari}"]`)).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedFeira}"]`)).toHaveCount(0)

    await page.goto('/fotos?atividade=plenaria')
    await waitForSettledPage(page)
    await expect(page.getByRole('heading', { name: 'Fotos de Plenária' })).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedFeira}"]`)).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedCamacari}"]`)).toHaveCount(0)

    await page.goto('/fotos?pessoa=rui-costa')
    await waitForSettledPage(page)
    await expect(page.getByRole('heading', { name: 'Fotos com Rui Costa' })).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedCamacari}"]`)).toBeVisible()

    await page.goto(`/fotos?q=${encodeURIComponent(marker)}`)
    await waitForSettledPage(page)
    await expect(page.getByRole('heading', { name: `Resultados para “${marker}”` })).toBeVisible()
    await expect(page.locator(`a[data-photo-id="${approvedFeira}"]`)).toBeVisible()

    await page.goto(`/fotos?municipio=${camacariSlug}&atividade=plenaria`)
    await waitForSettledPage(page)
    const noResults = page.locator('[data-album-no-results]')
    await expect(noResults.getByText('Nada encontrado com esses filtros')).toBeVisible()
    await expect(noResults.getByRole('link', { name: 'Limpar filtros' })).toBeVisible()
  })

  test('opens the photo in the overlay and downloads it with the legible name', async ({
    page,
    request,
  }) => {
    await page.goto(`/fotos?municipio=${feiraSlug}&foto=${approvedFeira}`)
    await waitForSettledPage(page)

    const dialog = page.getByRole('dialog', { name: /Plenária da saúde/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Registro aprovado')).toBeVisible()
    await expect(dialog.getByText('12 de setembro de 2026')).toBeVisible()
    await expect(dialog.getByText('Feira de Santana · Bahia')).toBeVisible()
    await expect(dialog.getByText('Plenária', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Jorge Solla', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Peça a remoção desta imagem' })).toHaveAttribute(
      'href',
      REMOVAL_CHANNEL,
    )

    const download = await request.get(`${BASE_URL}/fotos/${approvedFeira}/midia?download=1`)
    expect(download.status()).toBe(200)
    expect(download.headers()['content-disposition']).toContain('attachment')
    expect(download.headers()['content-disposition']).toContain(
      `jorge-solla-1313-foto-${approvedFeira}.jpg`,
    )

    await page.getByRole('link', { name: /Voltar ao álbum/ }).click()
    await waitForSettledPage(page)
    await expect(page).toHaveURL(new RegExp(`/fotos\\?municipio=${feiraSlug}$`))
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('pulls a removed photo down immediately, without a deploy', async ({ page, request }) => {
    await page.goto('/fotos')
    await waitForSettledPage(page)
    await expect(page.locator(`a[data-photo-id="${approvedFeira}"]`)).toBeVisible()

    await setPhotoStatus(request, headers, approvedFeira, 'removed')

    await page.goto('/fotos')
    await waitForSettledPage(page)
    await expect(page.locator(`a[data-photo-id="${approvedFeira}"]`)).toHaveCount(0)
    await expect(page.locator(`a[data-photo-id="${approvedCamacari}"]`)).toBeVisible()

    const denied = await request.get(`${BASE_URL}/fotos/${approvedFeira}/midia?tamanho=grade`)
    expect(denied.status()).toBe(404)
  })

  test('shows the removal channel at the foot of the album', async ({ page }) => {
    await page.goto('/fotos')
    await waitForSettledPage(page)

    await expect(page.getByText('Aparece em alguma foto?')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir remoção de uma foto' })).toHaveAttribute(
      'href',
      REMOVAL_CHANNEL,
    )
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Fotos' })).toBeVisible()
  })

  test('flips the kill switch and closes the whole route without a deploy', async ({ request }) => {
    await setAlbum(request, headers, { published: false, removalChannelUrl: REMOVAL_CHANNEL })
    const state = await request.get(`${BASE_URL}/api/globals/photoAlbum`, { headers })
    expect(((await state.json()) as { published: boolean }).published).toBe(false)
    // Through the API context on purpose: the browser would log the document's
    // own 404 and trip the console-error guard (same choice as the S27 spec).
    expect((await request.get(`${BASE_URL}/fotos`)).status()).toBe(404)

    await setAlbum(request, headers, { published: true, removalChannelUrl: REMOVAL_CHANNEL })
    expect((await request.get(`${BASE_URL}/fotos`)).status()).toBe(200)
  })
})
