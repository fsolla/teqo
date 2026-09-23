import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { request as playwrightRequest } from '@playwright/test'
import { Client } from 'pg'

import {
  formatBahiaCivilDate,
  formatBahiaEventDateLabel,
  parseBahiaDateTimeInput,
} from '../../src/lib/campaignTime.js'
import { formatICalDate } from '../../src/lib/ical.js'
import { adminHeaders } from '../helpers/adminApi'
import { metaContent } from '../helpers/metaContent'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S19 — share links over real HTTP: `jorgesolla1313.com.br/<slug>` serves the
 * configured Open Graph card (the WhatsApp crawler reads the raw HTML) and hands
 * the visitor to the destination without an interstice (inline script; meta
 * refresh when JS is off). Unpublished and unknown slugs answer the same 404,
 * and the kill switch flips without a deploy (404 → 200 after republishing).
 *
 * S29 — the announcement mode: while no destination is on air the link serves
 * the event page (disabled "Entrar", Bahia date, `.ics`); flagging a destination
 * live turns the link back into the S19 redirect, and the already-open page
 * activates/swaps the button through the fresh poll without a reload.
 *
 * Links and media are seeded through the deployed REST API (admin session) so
 * the server process runs the real cache hooks; a Local API call from the runner
 * would throw on `revalidateTag` (same reason as the speech-cut spec).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const isProdMode = Boolean(process.env.CI) || process.env.E2E_PROD === '1'

/**
 * The announcement fixture starts today at 19:00 in Bahia civil time (B196: an
 * e2e fixture date never hardcodes a literal — a fixed instant expires).
 */
const ANNOUNCEMENT_STARTS_AT = (() => {
  const startsAt = parseBahiaDateTimeInput(`${formatBahiaCivilDate(new Date())}T19:00`)
  if (!startsAt) throw new Error('Falha ao montar a data da fixture de anúncio.')
  return startsAt
})()

// 1×1 opaque PNG — enough for the upload (no dimensions are enforced on purpose).
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const createdShareLinkIds: number[] = []
const createdMediaIds: number[] = []

type DestinationInput = { label: string; url: string; live?: boolean }

type ShareLinkInput = {
  title: string
  slug: string
  destinations: DestinationInput[]
  description: string
  published: boolean
  mode?: 'direct' | 'announcement'
  startsAt?: string
  location?: string
  image?: number
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
  data: ShareLinkInput,
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

/** Replaces the destination pool — the "swap the live destination" admin action. */
const setShareLinkDestinations = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  id: number,
  destinations: DestinationInput[],
): Promise<void> => {
  const response = await request.patch(`${BASE_URL}/api/shareLink/${id}`, {
    headers,
    data: { destinations },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

/**
 * Flags one pre-registered destination as on air through the test database.
 * This is deliberately NOT the REST PATCH: the collection hook revalidates the
 * `shareLinks` tag, and the dev server answers a revalidation with a route
 * refresh (HMR router-cache invalidation) that races the very assertion this
 * test makes — the open page would be re-rendered into the live redirect. The
 * direct write isolates the poll contract, which is what this test owns; the
 * REST write path is covered by the redirect assertion at the end. The URL is
 * the isolated test database (`assertTestDatabase` in playwright.config).
 */
const flagLiveDestination = async (linkId: number, label: string): Promise<void> => {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      'update share_link_destinations set live = (label = $2) where _parent_id = $1',
      [linkId, label],
    )
  } finally {
    await client.end()
  }
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
      destinations: [{ label: 'Google Meet', url: destination, live: true }],
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
      destinations: [
        { label: 'Google Meet', url: 'https://meet.google.com/abc-defg-hij', live: true },
      ],
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
      destinations: [{ label: 'Google Meet', url: `${BASE_URL}/artigos`, live: true }],
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

test.describe('Frontend share-link announcement (S29)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  const createAnnouncementLink = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    overrides: Partial<ShareLinkInput> = {},
  ): Promise<{ id: number; slug: string }> => {
    const slug = overrides.slug ?? `anuncio-${randomUUID().slice(0, 8)}`
    const id = await createShareLink(request, headers, {
      title: 'Plenária da saúde',
      destinations: [
        { label: 'Google Meet', url: `${BASE_URL}/artigos` },
        { label: 'YouTube', url: `${BASE_URL}/jingles` },
      ],
      description: 'Encontro online da campanha.',
      published: true,
      mode: 'announcement',
      startsAt: ANNOUNCEMENT_STARTS_AT,
      location: 'Online',
      ...overrides,
      slug,
    })
    return { id, slug }
  }

  test('serves the announcement page (disabled Entrar, Bahia date, .ics) pre-broadcast', async ({
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const { slug } = await createAnnouncementLink(request, headers)

    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      const response = await anonymous.get(`/${slug}`)
      expect(response.status()).toBe(200)
      const html = await response.text()

      // The OG card is the same as S19, always noindex, and no interstice.
      expect(metaContent(html, 'property', 'og:title')).toBe('Plenária da saúde')
      expect(metaContent(html, 'name', 'robots')).toBe('noindex, nofollow')
      expect(metaContent(html, 'http-equiv', 'refresh')).toBeNull()
      expect(html).not.toContain('window.location.replace')

      // Honest pre-broadcast state: visible but disabled, with the warning.
      expect(html).toContain('A transmissão ainda não começou.')
      expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Entrar/)
      expect(html).toContain(formatBahiaEventDateLabel(ANNOUNCEMENT_STARTS_AT))
      expect(html).toContain('Horário da Bahia')
      expect(html).toContain('Online')

      const ics = await anonymous.get(`/${slug}/evento.ics`)
      expect(ics.status()).toBe(200)
      expect(ics.headers()['content-type']).toContain('text/calendar')
      expect(ics.headers()['content-disposition']).toContain(`filename="${slug}.ics"`)
      const body = await ics.text()
      expect(body).toContain('BEGIN:VEVENT')
      expect(body).toContain(`DTSTART:${formatICalDate(ANNOUNCEMENT_STARTS_AT)}`)
      expect(body).toContain(`UID:${slug}@teqo.jorgesolla.com.br`)
    } finally {
      await anonymous.dispose()
    }
  })

  test('fails closed: no .ics without a start date, no page for a direct link without a live target', async ({
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const { slug: noDateSlug } = await createAnnouncementLink(request, headers, {
      slug: `sem-data-${randomUUID().slice(0, 8)}`,
      startsAt: undefined,
    })

    // A `direct` link without a live destination cannot even be created.
    const invalid = await request.post(`${BASE_URL}/api/shareLink`, {
      headers,
      data: {
        title: 'Direto inválido',
        slug: `direto-invalido-${randomUUID().slice(0, 8)}`,
        destinations: [{ label: 'Meet', url: 'https://meet.google.com/abc' }],
        description: 'x',
        published: true,
        mode: 'direct',
      },
    })
    expect(invalid.ok()).toBe(false)

    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      const ics = await anonymous.get(`/${noDateSlug}/evento.ics`)
      expect(ics.status()).toBe(404)

      const unknownIcs = await anonymous.get(`/nao-existe-${randomUUID().slice(0, 8)}/evento.ics`)
      expect(unknownIcs.status()).toBe(404)

      // The announcement page itself still answers 200 without a date.
      expect((await anonymous.get(`/${noDateSlug}`)).status()).toBe(200)
    } finally {
      await anonymous.dispose()
    }
  })

  test('activates the Entrar button and swaps the destination without a reload', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, BASE_URL)
    const first = `${BASE_URL}/artigos`
    const second = `${BASE_URL}/jingles`
    const { id, slug } = await createAnnouncementLink(request, headers, {
      slug: `troca-${randomUUID().slice(0, 8)}`,
      destinations: [
        { label: 'Google Meet', url: first },
        { label: 'YouTube', url: second },
      ],
    })

    // Warm the poll route before the browser mounts it: in dev the first
    // compile of a route triggers a Fast Refresh that reloads the open page —
    // mid-assertion, and after the flag is flipped that reload would serve the
    // live redirect. In CI's prod build this GET is a cheap warm-up.
    await request.get(`${BASE_URL}/api/share-link/${slug}/live`)

    await page.goto(`/${slug}`)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    await expect(page.getByText('A transmissão ainda não começou.')).toBeVisible()

    // Dev-only settle: the first browser mount compiles the route chunks and
    // Next pushes a Fast Refresh (a same-URL reload) right after — if the flag
    // flips before that reload lands, the reload serves the live redirect and
    // preempts the activation assertion. The prod build (CI, E2E_PROD) has no
    // compile and needs no wait.
    if (!isProdMode) await page.waitForTimeout(6_000)

    // The team flags the Meet as live; the open page refetches on wake.
    await flagLiveDestination(id, 'Google Meet')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    // Dev-mode cold compile of the poll route can blow the 10s default; in
    // CI's prod build the response is immediate.
    await expect(page.getByText('Destino no ar')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', first)
    await expect(page.getByRole('article').getByText('Google Meet')).toBeVisible()
    await expect(page.getByText('A transmissão começou.')).toBeVisible()

    // The Meet fills up: swapping the live destination updates the open page.
    await flagLiveDestination(id, 'YouTube')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', second)
    await expect(page.getByRole('article').getByText('YouTube')).toBeVisible()

    // Whoever arrives later goes straight to the destination on air — the same
    // state written through the admin REST API (the collection hook path).
    await setShareLinkDestinations(request, headers, id, [
      { label: 'Google Meet', url: first },
      { label: 'YouTube', url: second, live: true },
    ])
    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL })
    try {
      const response = await anonymous.get(`/${slug}`)
      expect(response.status()).toBe(200)
      expect(metaContent(await response.text(), 'http-equiv', 'refresh')).toBe(`0;url=${second}`)
    } finally {
      await anonymous.dispose()
    }
  })
})
