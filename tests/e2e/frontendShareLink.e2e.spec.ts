import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { request as playwrightRequest } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S19 — share links over real HTTP: `jorgesolla1313.com.br/<slug>` serves the
 * configured Open Graph card (the WhatsApp crawler reads the raw HTML) and hands
 * the visitor to the destination without an interstice (inline script; meta
 * refresh when JS is off). Unpublished and unknown slugs answer the same 404,
 * and the kill switch flips without a deploy (404 → 200 after republishing).
 *
 * Links and media are seeded through the deployed REST API (admin session) so
 * the server process runs the real cache hooks; a Local API call from the runner
 * would throw on `revalidateTag` (same reason as the speech-cut spec).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// 1×1 opaque PNG — enough for the upload (no dimensions are enforced on purpose).
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const createdShareLinkIds: number[] = []
const createdMediaIds: number[] = []

/** Reads a meta tag by one attribute and returns its `content` (attribute-order tolerant). */
const metaContent = (html: string, attribute: string, value: string): string | null => {
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    if (!tag.includes(`${attribute}="${value}"`)) continue
    return tag.match(/content="([^"]*)"/)?.[1] ?? null
  }
  return null
}

const createMedia = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  alt: string,
): Promise<number> => {
  const response = await request.post(`${BASE_URL}/api/media`, {
    headers,
    // Payload multipart carries the document fields in `_payload` (JSON).
    multipart: {
      _payload: JSON.stringify({ alt }),
      file: {
        name: `share-link-${randomUUID().slice(0, 8)}.png`,
        mimeType: 'image/png',
        buffer: TEST_PNG,
      },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const mediaId = ((await response.json()) as { doc: { id: number } }).doc.id
  createdMediaIds.push(mediaId)
  return mediaId
}

const createShareLink = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  data: {
    title: string
    slug: string
    destination: string
    description: string
    published: boolean
    image?: number
  },
): Promise<number> => {
  const response = await request.post(`${BASE_URL}/api/shareLink`, { headers, data })
  expect(response.ok(), await response.text()).toBeTruthy()
  const id = ((await response.json()) as { doc: { id: number } }).doc.id
  createdShareLinkIds.push(id)
  return id
}

const setShareLinkPublished = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  id: number,
  published: boolean,
): Promise<void> => {
  const response = await request.patch(`${BASE_URL}/api/shareLink/${id}`, {
    headers,
    data: { published },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.afterAll(async ({ request }) => {
  const headers = await adminHeaders(request, BASE_URL).catch(() => null)
  if (!headers) return
  for (const id of createdShareLinkIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/shareLink/${id}`, { headers }).catch(() => undefined)
  }
  for (const id of createdMediaIds.splice(0)) {
    await request.delete(`${BASE_URL}/api/media/${id}`, { headers }).catch(() => undefined)
  }
})

test.describe('Frontend share links (S19)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test('serves the configured card and hands the visitor straight to the destination', async ({
    browser,
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const mediaId = await createMedia(request, headers, 'Miniatura da plenária')
    const slug = `plenaria-saude-${randomUUID().slice(0, 8)}`
    const title = 'Plenária da Saúde em Feira de Santana'
    const description = 'Participe da plenária sobre saúde nesta quinta-feira.'
    const destination = `${BASE_URL}/artigos`
    await createShareLink(request, headers, {
      title,
      slug,
      destination,
      description,
      published: true,
      image: mediaId,
    })

    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      const response = await anonymous.get(`/${slug}`)
      expect(response.status()).toBe(200)
      const html = await response.text()

      expect(metaContent(html, 'property', 'og:title')).toBe(title)
      expect(metaContent(html, 'property', 'og:description')).toBe(description)
      // The canonical origin comes from the site URL (prod mode inlines the
      // canonical HTTPS origin), so derive it from the served HTML itself.
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]
      expect(canonical).toMatch(new RegExp(`^https?://[^/]+/${slug}$`))
      expect(metaContent(html, 'property', 'og:url')).toBe(canonical)
      expect(metaContent(html, 'property', 'og:image')).toMatch(/^http[^"]*\/api\/media\/file\//)
      expect(metaContent(html, 'name', 'robots')).toBe('noindex, nofollow')
      expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image')
      expect(metaContent(html, 'http-equiv', 'refresh')).toBe(`0;url=${destination}`)
      expect(html).toContain(`window.location.replace("${destination}")`)
      // The card never leaks the raw destination.
      expect(metaContent(html, 'property', 'og:description')).not.toBe(destination)
    } finally {
      await anonymous.dispose()
    }

    await page.goto(`/${slug}`, { waitUntil: 'commit' }).catch(() => undefined)
    await expect(page).toHaveURL(destination)

    const noJsContext = await browser.newContext({ javaScriptEnabled: false })
    try {
      const noJsPage = await noJsContext.newPage()
      await noJsPage.goto(`/${slug}`, { waitUntil: 'commit' }).catch(() => undefined)
      await expect(noJsPage).toHaveURL(destination)
    } finally {
      await noJsContext.close()
    }
  })

  test('answers the same 404 for an unpublished link and an unknown slug', async ({ request }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const slug = `rascunho-${randomUUID().slice(0, 8)}`
    await createShareLink(request, headers, {
      title: 'Rascunho que não deve aparecer',
      slug,
      destination: 'https://meet.google.com/abc-defg-hij',
      description: 'Ainda não publicado.',
      published: false,
    })

    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      const unpublished = await anonymous.get(`/${slug}`)
      const unknown = await anonymous.get(`/nao-existe-${randomUUID().slice(0, 8)}`)

      expect(unpublished.status()).toBe(404)
      expect(unknown.status()).toBe(404)

      const unpublishedHtml = await unpublished.text()
      const unknownHtml = await unknown.text()
      expect(unpublishedHtml).not.toContain('Rascunho que não deve aparecer')
      expect(unknownHtml).not.toContain('Rascunho que não deve aparecer')
      // The same not-found screen either way (never reveals whether it existed).
      expect(unpublishedHtml).toContain('This page could not be found')
      expect(unknownHtml).toContain('This page could not be found')
    } finally {
      await anonymous.dispose()
    }
  })

  test('flips the kill switch without a deploy (404 and back)', async ({ request }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const slug = `kill-switch-${randomUUID().slice(0, 8)}`
    const id = await createShareLink(request, headers, {
      title: 'Plenária com kill switch',
      slug,
      destination: `${BASE_URL}/artigos`,
      description: 'Publicado, despublicado e republicado.',
      published: true,
    })

    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      expect((await anonymous.get(`/${slug}`)).status()).toBe(200)

      await setShareLinkPublished(request, headers, id, false)
      expect((await anonymous.get(`/${slug}`)).status()).toBe(404)

      await setShareLinkPublished(request, headers, id, true)
      expect((await anonymous.get(`/${slug}`)).status()).toBe(200)
    } finally {
      await anonymous.dispose()
    }
  })
})
