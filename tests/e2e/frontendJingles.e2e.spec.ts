import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { APIRequestContext } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S21 — the public jingles page over real HTTP: the published cards come in
 * order, opening the page downloads no audio (`preload="none"`), the player
 * plays one at a time and the download carries the legible slug-based name.
 * The kill switch (unpublish) flips the honest empty state, the header badge
 * and the footer discovery link without a deploy.
 *
 * Jingles and media are seeded through the deployed REST API (admin session) so
 * the server process runs the real cache hooks; a Local API call from the
 * runner would throw on `revalidateTag` (same reason as the S19 spec).
 *
 * The tests are serial: the empty-state assertions need a global window with
 * zero published jingles, and only this spec owns jingle rows.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// 1×1 opaque PNG — enough for the cover upload.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TEST_MP3 = readFileSync(path.resolve(process.cwd(), 'tests/fixtures/jingle-tone.mp3'))

type Headers = Record<string, string>

const createdJingleIds: number[] = []
const createdMediaIds: number[] = []

const uniqueSlug = () => `jingle-${randomUUID().slice(0, 8)}`

const createMedia = async (
  request: APIRequestContext,
  headers: Headers,
  name: string,
  mimetype: string,
  buffer: Buffer,
): Promise<number> => {
  const response = await request.post(`${BASE_URL}/api/media`, {
    headers,
    // Payload multipart carries the document fields in `_payload` (JSON).
    multipart: {
      _payload: JSON.stringify({ alt: name }),
      file: { name, mimeType: mimetype, buffer },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const mediaId = ((await response.json()) as { doc: { id: number } }).doc.id
  createdMediaIds.push(mediaId)
  return mediaId
}

const createJingle = async (
  request: APIRequestContext,
  headers: Headers,
  data: { title: string; slug: string; published?: boolean },
): Promise<number> => {
  const coverImage = await createMedia(
    request,
    headers,
    `capa-${data.slug}-${randomUUID().slice(0, 6)}.png`,
    'image/png',
    TEST_PNG,
  )
  const audio = await createMedia(
    request,
    headers,
    `audio-${data.slug}-${randomUUID().slice(0, 6)}.mp3`,
    'audio/mpeg',
    TEST_MP3,
  )
  const response = await request.post(`${BASE_URL}/api/jingle`, {
    headers,
    data: { ...data, coverImage, audio, published: data.published ?? true },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdJingleIds.push(id)
  return id
}

const setJinglePublished = async (
  request: APIRequestContext,
  headers: Headers,
  id: number,
  published: boolean,
): Promise<void> => {
  const response = await request.patch(`${BASE_URL}/api/jingle/${id}`, {
    headers,
    data: { published },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

/** Zero published globally so the empty-state assertions stay deterministic. */
const unpublishEveryJingle = async (request: APIRequestContext, headers: Headers) => {
  const listed = await request.get(`${BASE_URL}/api/jingle?limit=0&depth=0`, { headers })
  expect(listed.ok(), await listed.text()).toBeTruthy()
  const { docs } = (await listed.json()) as { docs: { id: number; published?: boolean | null }[] }
  for (const doc of docs) {
    if (doc.published) await setJinglePublished(request, headers, doc.id, false)
  }
}

const cardStates = (page: import('@playwright/test').Page) =>
  page
    .locator('article[data-jingle]')
    .evaluateAll((cards) => cards.map((card) => card.dataset.state))

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdJingleIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/jingle/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/media/${id}`, { headers }).catch(() => undefined)
  }
})

test.describe('Frontend jingles (S21)', () => {
  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, BASE_URL)
    await unpublishEveryJingle(request, headers)
  })

  test('lists the published jingles, keeps the audio lazy and plays one at a time', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const firstSlug = uniqueSlug()
    const secondSlug = uniqueSlug()
    await createJingle(request, headers, { title: 'Axé oficial', slug: firstSlug })
    await createJingle(request, headers, { title: 'Forró oficial', slug: secondSlug })

    const audioRequests: string[] = []
    page.on('request', (req) => {
      if (/\/api\/media\/file\/.*\.mp3/.test(req.url())) audioRequests.push(req.url())
    })

    const response = await page.goto('/jingles')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Jingles de Jorge Solla' })).toBeVisible()
    await expect(page.getByText('Jingles oficiais')).toBeVisible()
    await expect(page.locator('article[data-jingle]')).toHaveCount(2)

    // The card never fetches the audio before the play (gate note).
    await expect(page.locator('audio[preload="none"]')).toHaveCount(2)
    expect(audioRequests).toHaveLength(0)

    const download = page.getByRole('link', { name: 'Baixar Axé oficial em MP3' })
    await expect(download).toHaveAttribute('download', `jorge-solla-1313-${firstSlug}.mp3`)
    await expect(page.getByText(`jorge-solla-1313-${firstSlug}.mp3`)).toBeVisible()

    // Play the first: its audio is fetched now, the second one stays lazy.
    await page.getByRole('button', { name: 'Tocar jingle Axé oficial' }).click()
    await expect(page.locator('audio').first()).toHaveJSProperty('paused', false)
    await expect(page.getByText('Em reprodução')).toHaveCount(1)
    expect(audioRequests).toHaveLength(1)

    // Starting the second pauses the first (and fetches only its own audio).
    await page.getByRole('button', { name: 'Tocar jingle Forró oficial' }).click()
    await expect(page.locator('audio').nth(1)).toHaveJSProperty('paused', false)
    await expect(page.locator('audio').first()).toHaveJSProperty('paused', true)
    expect(await cardStates(page)).toEqual(['stopped', 'playing'])
    expect(audioRequests).toHaveLength(2)

    // The download keeps the legible name regardless of the stored filename.
    const [downloadEvent] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Baixar Forró oficial em MP3' }).click(),
    ])
    expect(downloadEvent.suggestedFilename()).toBe(`jorge-solla-1313-${secondSlug}.mp3`)
  })

  test('flips the kill switch and the discovery without a deploy', async ({ page, request }) => {
    const headers = await adminHeaders(request, BASE_URL)

    // With zero published jingles the page is honest and discovery is gone.
    await unpublishEveryJingle(request, headers)
    await page.goto('/jingles')
    await expect(page.getByText('Nenhum jingle publicado por enquanto')).toBeVisible()
    await expect(page.locator('article[data-jingle]')).toHaveCount(0)
    await expect(page.getByText('Jingles oficiais')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Jingles' })).toHaveCount(0)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Jingles' })).toHaveCount(0)
    expect((await request.get(`${BASE_URL}/jingles`)).status()).toBe(200)
    await expect
      .poll(async () =>
        (await (await request.get(`${BASE_URL}/jingles`)).text()).includes('noindex, nofollow'),
      )
      .toBe(true)

    // Publishing one item turns the page, the badge and the link on.
    const id = await createJingle(request, headers, {
      title: 'Pagodão oficial',
      slug: uniqueSlug(),
    })
    await page.goto('/jingles')
    await expect(page.getByRole('heading', { name: 'Pagodão oficial' })).toBeVisible()
    await expect(page.locator('article[data-jingle]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Jingles' })).toBeVisible()
    await expect(page.getByText('Jingles oficiais')).toBeVisible()
    await expect
      .poll(async () =>
        (await (await request.get(`${BASE_URL}/jingles`)).text()).includes('index, follow'),
      )
      .toBe(true)

    // Unpublishing it flips everything back without a deploy.
    await setJinglePublished(request, headers, id, false)
    await page.goto('/jingles')
    await expect(page.getByText('Nenhum jingle publicado por enquanto')).toBeVisible()
    await expect(page.locator('article[data-jingle]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Jingles' })).toHaveCount(0)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Jingles' })).toHaveCount(0)

    await setJinglePublished(request, headers, id, true)
    await page.goto('/jingles')
    await expect(page.getByRole('heading', { name: 'Pagodão oficial' })).toBeVisible()
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Jingles' })).toBeVisible()
  })
})
