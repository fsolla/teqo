import { randomUUID } from 'node:crypto'

import type { APIRequestContext, Page } from '@playwright/test'
import sharp from 'sharp'

import {
  FACE_INDEX_CONSENT_KEY,
  FACE_SEARCH_CONSENT_KEY,
} from '../../src/lib/campaignConsentKeys.js'
import { FACE_SEARCH_MODEL, faceStubDescriptorFromBytes } from '../../src/lib/faceSearch.js'
import { hashConsentContent } from '../../src/utilities/consentContentHash.js'
import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { waitForStreamSettled } from './fixtures/campaignE2EFixtures'
import { expect, test } from './fixtures/e2eTest'

/**
 * C234 — the selfie search over real HTTP: the entry gated by the album flag,
 * the Consent fail-closed, the A/C answer (only the enrolled subject's approved
 * photos, never a third-party name), the honest empty and the opt-out by
 * matched descriptor. The engine is the deterministic stub
 * (`NEXT_PUBLIC_FACE_SEARCH_STUB=1`): the fixture bytes derive the descriptor
 * the seeded subject carries, so no model is ever downloaded.
 *
 * Rows are seeded through the deployed REST API (admin session) so the server
 * process runs the real hooks. Serial: this spec owns its faceSubject/Consent
 * rows and flips the same `photoAlbum` global as the C233 spec (the project
 * depends on `frontendFotos`).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const REMOVAL_CHANNEL = 'https://example.org/acervo/remocao'

type Headers = Record<string, string>

const createdPhotoIds: number[] = []
const createdSubjectIds: number[] = []
const createdConsentKeys = new Set<string>()

const uniqueMarker = () => randomUUID().slice(0, 8)

const fixtureConsentText = (label: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: `Consentimento de teste C234 (${label}).`, version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

const jpegWithFill = (marker: string): Promise<Buffer> => {
  const byte = Number.parseInt(marker.slice(0, 2), 16) % 200
  return sharp({
    create: {
      width: 96,
      height: 96,
      channels: 3,
      background: { r: 30 + byte, g: 120, b: 40 + (byte % 60) },
    },
  })
    .jpeg()
    .toBuffer()
}

const setAlbum = async (
  request: APIRequestContext,
  headers: Headers,
  data: { published: boolean; removalChannelUrl: string | null; selfieSearchEnabled: boolean },
): Promise<void> => {
  const response = await request.post(`${BASE_URL}/api/globals/photoAlbum`, { headers, data })
  expect(response.ok(), await response.text()).toBeTruthy()
}

const createPhoto = async (
  request: APIRequestContext,
  headers: Headers,
  caption: string,
): Promise<number> => {
  const marker = uniqueMarker()
  const response = await request.post(`${BASE_URL}/api/archivePhoto`, {
    headers,
    multipart: {
      _payload: JSON.stringify({
        flickrId: `c234-e2e-${marker}`,
        alt: `Foto de teste C234 ${marker}: ${caption}`,
        publicationStatus: 'approved',
        takenAt: '2026-09-12 10:20:30',
        catalog: { caption, people: ['Jorge Solla'] },
      }),
      file: {
        name: `c234-${marker}.jpg`,
        mimeType: 'image/jpeg',
        buffer: await jpegWithFill(marker),
      },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdPhotoIds.push(id)
  return id
}

const ensureConsent = async (
  request: APIRequestContext,
  headers: Headers,
  key: string,
): Promise<{ id: number; text: unknown }> => {
  const existing = await request.get(
    `${BASE_URL}/api/consent?limit=1&depth=0&where[key][equals]=${encodeURIComponent(key)}`,
    { headers },
  )
  expect(existing.ok(), await existing.text()).toBeTruthy()
  const found = ((await existing.json()) as { docs: { id: number; text: unknown }[] }).docs[0]
  if (found) return found

  const created = await request.post(`${BASE_URL}/api/consent`, {
    headers,
    data: { key, text: fixtureConsentText(key) },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  createdConsentKeys.add(key)
  const doc = ((await created.json()) as { doc: { id: number; text: unknown } }).doc
  return { id: doc.id, text: doc.text }
}

const createSubject = async (
  request: APIRequestContext,
  headers: Headers,
  data: { vector: number[]; consentId: number; consentHash: string; matchedPhotos: number[] },
): Promise<number> => {
  const response = await request.post(`${BASE_URL}/api/faceSubject`, {
    headers,
    data: {
      label: `Pessoa de teste ${uniqueMarker()}`,
      consent: data.consentId,
      consentHash: data.consentHash,
      model: FACE_SEARCH_MODEL,
      vector: data.vector,
      enrolledAt: new Date().toISOString(),
      status: 'active',
      matchedPhotos: data.matchedPhotos,
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdSubjectIds.push(id)
  return id
}

const faceSubjectById = async (
  request: APIRequestContext,
  headers: Headers,
  id: number,
): Promise<{ status: string; vector: unknown }> => {
  const response = await request.get(`${BASE_URL}/api/faceSubject/${id}?depth=0`, { headers })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as { status: string; vector: unknown }
}

/** Consent card → pick screen with the given fixture, ready for the primary action. */
const reachPickWithFixture = async (
  page: Page,
  fixture: { name: string; mimeType: string; buffer: Buffer },
  { firstPick = false }: { firstPick?: boolean } = {},
) => {
  if (firstPick) {
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Concordar e escolher minha selfie' }).click()
  }
  await page.locator('input[type="file"]').setInputFiles(fixture)
}

test.describe.configure({ mode: 'serial' })

test.describe('Frontend busca por selfie (C234)', () => {
  let headers: Headers
  let indexConsent: { id: number; text: unknown }
  let indexConsentHash: string
  let subjectId: number
  let linkedPhoto: number
  let draftLinkedPhoto: number
  let otherPhoto: number
  const marker = uniqueMarker()

  type SelfieFixture = { name: string; mimeType: string; buffer: Buffer }
  const selfieA: SelfieFixture = {
    name: 'selfie-a.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(0),
  }
  const selfieB: SelfieFixture = {
    name: 'selfie-b.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(0),
  }

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    headers = await adminHeaders(request, BASE_URL)

    selfieA.buffer = await jpegWithFill('11')
    selfieB.buffer = await jpegWithFill('77')

    await ensureConsent(request, headers, FACE_SEARCH_CONSENT_KEY)
    indexConsent = await ensureConsent(request, headers, FACE_INDEX_CONSENT_KEY)
    indexConsentHash = hashConsentContent(indexConsent.text)

    await setAlbum(request, headers, {
      published: true,
      removalChannelUrl: REMOVAL_CHANNEL,
      selfieSearchEnabled: true,
    })

    linkedPhoto = await createPhoto(request, headers, `Plenária encontrada ${marker}`)
    otherPhoto = await createPhoto(request, headers, `Outra foto aprovada ${marker}`)
    draftLinkedPhoto = await createPhoto(request, headers, `Rascunho do índice ${marker}`)
    await request.patch(`${BASE_URL}/api/archivePhoto/${draftLinkedPhoto}`, {
      headers,
      data: { publicationStatus: 'draft' },
    })

    subjectId = await createSubject(request, headers, {
      vector: faceStubDescriptorFromBytes(new Uint8Array(selfieA.buffer)),
      consentId: indexConsent.id,
      consentHash: indexConsentHash,
      matchedPhotos: [linkedPhoto, draftLinkedPhoto],
    })
  })

  test.afterAll(async ({ request }) => {
    const cleanupHeaders = await adminHeaders(request, BASE_URL).catch(() => null)
    if (cleanupHeaders) {
      for (const id of createdSubjectIds.splice(0)) {
        await request
          .delete(`${BASE_URL}/api/faceSubject/${id}`, { headers: cleanupHeaders })
          .catch(() => undefined)
      }
      for (const id of createdPhotoIds.splice(0)) {
        await request
          .delete(`${BASE_URL}/api/archivePhoto/${id}`, { headers: cleanupHeaders })
          .catch(() => undefined)
      }
      for (const key of createdConsentKeys) {
        const lookup = await request
          .get(
            `${BASE_URL}/api/consent?limit=1&depth=0&where[key][equals]=${encodeURIComponent(key)}`,
            {
              headers: cleanupHeaders,
            },
          )
          .catch(() => null)
        const doc = lookup ? ((await lookup.json()) as { docs: { id: number }[] }).docs[0] : null
        if (doc) {
          await request
            .delete(`${BASE_URL}/api/consent/${doc.id}`, { headers: cleanupHeaders })
            .catch(() => undefined)
        }
      }
      await setAlbum(request, cleanupHeaders, {
        published: true,
        removalChannelUrl: REMOVAL_CHANNEL,
        selfieSearchEnabled: false,
      }).catch(() => undefined)
    }
  })

  test('gates the entry on the album flag and the flow on the explicit consent', async ({
    page,
  }) => {
    await page.goto('/fotos')
    await waitForStreamSettled(page)
    const entry = page.getByRole('link', { name: 'Começar busca por selfie' })
    await expect(entry).toBeVisible()
    await entry.click()
    await page.waitForURL('**/fotos/encontre')
    await waitForStreamSettled(page)

    await expect(
      page.getByRole('heading', { name: 'Sua face é um dado biométrico sensível' }),
    ).toBeVisible()
    const primary = page.getByRole('button', { name: 'Concordar e escolher minha selfie' })
    await expect(primary).toBeDisabled()
    await page.getByRole('checkbox').check()
    await expect(primary).toBeEnabled()
  })

  test('finds only the approved photos of the matched subject, without third-party names', async ({
    page,
  }) => {
    // `slow` keeps the processing state on screen long enough to be asserted.
    await page.addInitScript(() => {
      ;(window as unknown as { __faceSearchStub?: string }).__faceSearchStub = 'slow'
    })
    await page.goto('/fotos/encontre')
    await waitForStreamSettled(page)
    await reachPickWithFixture(page, selfieA, { firstPick: true })
    await page.getByRole('button', { name: 'Usar esta selfie' }).click()

    await expect(
      page.getByRole('heading', { name: 'Procurando você nas fotos aprovadas…' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Estas são as fotos em que encontramos você.' }),
    ).toBeVisible()

    const card = page.locator(`a[data-photo-id="${linkedPhoto}"]`)
    await expect(card).toBeVisible()
    await expect(card.getByText(`Plenária encontrada ${marker}`)).toBeVisible()
    // The draft is linked to the subject but is not public; the other approved
    // photo does not contain the enrolled face.
    await expect(page.locator(`a[data-photo-id="${draftLinkedPhoto}"]`)).toHaveCount(0)
    await expect(page.locator(`a[data-photo-id="${otherPhoto}"]`)).toHaveCount(0)
    // The result card never carries the album's "Quem aparece" line.
    await expect(card.getByText('Jorge Solla')).toHaveCount(0)
    await expect(page.getByText(/nota de semelhança/)).toBeVisible()
  })

  test('shows the honest empty state for a face that is not in the index', async ({ page }) => {
    await page.goto('/fotos/encontre')
    await waitForStreamSettled(page)
    await reachPickWithFixture(page, selfieB, { firstPick: true })
    await page.getByRole('button', { name: 'Usar esta selfie' }).click()

    await expect(page.getByRole('heading', { name: 'Não encontramos fotos suas' })).toBeVisible()
    await expect(page.getByText(/pessoas parecidas/)).toBeVisible()
  })

  test('shows the no-match opt-out state with the configured removal channel', async ({ page }) => {
    await page.goto('/fotos/encontre')
    await waitForStreamSettled(page)
    // The presence screen is reached from the result band (the person is in the
    // index); the leave attempt then uses a selfie that does not match.
    await reachPickWithFixture(page, selfieA, { firstPick: true })
    await page.getByRole('button', { name: 'Usar esta selfie' }).click()
    await page.getByRole('button', { name: 'Gerenciar minha presença' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('input[type="file"]').setInputFiles(selfieB)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Confirmar saída do índice' }).click()

    await expect(
      page.getByRole('heading', { name: 'Não encontramos sua presença no índice' }),
    ).toBeVisible()
    const channel = page.getByRole('link', { name: 'Pedir remoção de uma foto' })
    await expect(channel).toBeVisible()
    await expect(channel).toHaveAttribute('href', REMOVAL_CHANNEL)
  })

  test('serves the opt-out by matched descriptor and stops answering afterwards', async ({
    page,
    request,
  }) => {
    await page.goto('/fotos/encontre')
    await waitForStreamSettled(page)
    await reachPickWithFixture(page, selfieA, { firstPick: true })
    await page.getByRole('button', { name: 'Usar esta selfie' }).click()
    await page.getByRole('button', { name: 'Gerenciar minha presença' }).click()

    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('input[type="file"]').setInputFiles(selfieA)
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByRole('heading', { name: 'Confirmar saída do índice?' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar saída do índice' }).click()
    await expect(page.getByRole('heading', { name: 'Pronto — você saiu do índice' })).toBeVisible()

    const subject = await faceSubjectById(request, headers, subjectId)
    expect(subject.status).toBe('removed')
    expect(subject.vector).toBeNull()
  })

  test('fails the engine honestly when the local processing breaks', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __faceSearchStub?: string }).__faceSearchStub = 'error'
    })
    await page.goto('/fotos/encontre')
    await waitForStreamSettled(page)
    await reachPickWithFixture(page, selfieA, { firstPick: true })
    await page.getByRole('button', { name: 'Usar esta selfie' }).click()

    await expect(
      page.getByRole('heading', { name: 'Não foi possível processar a busca' }),
    ).toBeVisible()
    await expect(page.getByText(/não foi enviada nem guardada/)).toBeVisible()
  })

  test('closes the page when the query Consent disappears', async ({ page, request }) => {
    const lookup = await request.get(
      `${BASE_URL}/api/consent?limit=1&depth=0&where[key][equals]=${FACE_SEARCH_CONSENT_KEY}`,
      { headers },
    )
    const doc = ((await lookup.json()) as { docs: { id: number }[] }).docs[0]
    expect(doc).toBeDefined()
    await request.delete(`${BASE_URL}/api/consent/${doc!.id}`, { headers })

    try {
      await page.goto('/fotos/encontre')
      await waitForStreamSettled(page)
      await expect(
        page.getByRole('heading', { name: 'A busca por selfie está indisponível' }),
      ).toBeVisible()
    } finally {
      await ensureConsent(request, headers, FACE_SEARCH_CONSENT_KEY)
    }
  })

  test('removes the entry from the album when the feature flag is off', async ({
    page,
    request,
  }) => {
    await setAlbum(request, headers, {
      published: true,
      removalChannelUrl: REMOVAL_CHANNEL,
      selfieSearchEnabled: false,
    })
    try {
      await page.goto('/fotos')
      await waitForStreamSettled(page)
      await expect(page.getByRole('link', { name: 'Começar busca por selfie' })).toHaveCount(0)

      // Through the API context on purpose: the browser would log the
      // document's own 404 and trip the console-error guard (same choice as
      // the C233 kill-switch test).
      expect((await request.get(`${BASE_URL}/fotos/encontre`)).status()).toBe(404)
    } finally {
      await setAlbum(request, headers, {
        published: true,
        removalChannelUrl: REMOVAL_CHANNEL,
        selfieSearchEnabled: true,
      })
    }
  })
})
