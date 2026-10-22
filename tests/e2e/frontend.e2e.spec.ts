import type { APIRequestContext, Locator, Page } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { waitForHomeHTML } from '../helpers/homeIsr'
import { seedTestUser } from '../helpers/seedUser'
import { instagramStubUrlFor, youtubeStubUrlFor } from '../helpers/socialStub'
import { expect, test } from './fixtures/e2eTest'

test.describe('Frontend', () => {
  test('opens on the thank-you hero and leaves campaign propaganda behind', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)

    await expect(
      page.getByRole('heading', { level: 1, name: '152.049 votos de confiança' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Acompanhe o mandato' })).toHaveAttribute(
      'href',
      '/artigos',
    )

    const main = page.locator('main')
    await expect(main.getByText('1313')).toHaveCount(0)
    await expect(main.getByText(/Quero apoiar|candidato|propaganda eleitoral/i)).toHaveCount(0)

    for (const section of ['hero', 'contents', 'story', 'flags', 'photos']) {
      await expect(page.locator(`[data-home-section="${section}"]`)).toBeVisible()
    }
    await expect(page.locator('[data-home-section="proof"]')).toHaveCount(0)
    await expect(page.locator('[data-home-section="problem"]')).toHaveCount(0)
    await expect(page.locator('[data-home-section="sound"]')).toHaveCount(0)
    await expect(page.locator('[data-home-section="cards"]')).toHaveCount(0)
    await expect(page.locator('[data-home-section="content-pieces"]')).toHaveCount(0)

    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: 'Artigos' })).toHaveAttribute('href', '/artigos')
    await expect(footer.getByRole('link', { name: 'Fotos' })).toHaveAttribute('href', '/fotos')
    await expect(footer.getByText(/CNPJ|1º turno/)).toHaveCount(0)
  })

  test('desktop nav and mobile menu reach the mandate sections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(nav.getByRole('link', { name: 'Mandato' })).toHaveAttribute('href', '/artigos')
    await expect(nav.getByRole('link', { name: 'Bandeiras' })).toHaveAttribute('href', '#bandeiras')
    await expect(nav.getByRole('link', { name: 'Fotos' })).toHaveAttribute('href', '/fotos')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const trigger = page.getByRole('button', { name: /^(Abrir|Fechar) menu$/ })
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const mobileNav = page.getByRole('navigation', { name: 'Navegação móvel' })
    await expect(mobileNav).toBeVisible()
    await expect(mobileNav.getByRole('link', { name: 'Artigos' })).toHaveAttribute(
      'href',
      '/artigos',
    )

    await page.keyboard.press('Escape')
    await expect(mobileNav).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toBeFocused()
  })

  test('redirects the retired campaign routes with a permanent status', async ({ request }) => {
    for (const [from, to] of [
      ['/conteudos', '/artigos'],
      ['/jingles', '/'],
      ['/cards', '/'],
    ]) {
      const response = await request.get(from, { maxRedirects: 0 })
      expect(response.status()).toBe(308)
      expect(new URL(response.headers().location, 'http://localhost').pathname).toBe(to)
    }
  })
})

test.describe('Campaign home content section', () => {
  test.describe.configure({ mode: 'serial' })

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const revalidateSecret = process.env.REVALIDATE_SECRET ?? 'e2e-revalidate-secret'
  const runSuffix = Date.now()
  const categoryName = `E2e Conteúdos ${runSuffix}`
  const categorySlug = `e2e-conteudos-${runSuffix}`
  const hiddenTagName = `E2e Oculta ${runSuffix}`
  const hiddenTagSlug = `e2e-oculta-${runSuffix}`
  const createdPosts: number[] = []
  const createdTags: number[] = []

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    // Start every run with the social feed unconfigured so the empty-state
    // test stays deterministic even when a previous S2 run left settings or a
    // persisted snapshot behind (same reasoning as the `posts` bust below).
    const headers = await adminHeaders(request, baseURL)
    await resetSocialFeedSettings(request, headers)
    await bustSocialFeed(request)
  })

  const createTag = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    name: string,
    slug: string,
    hidden = false,
  ) => {
    const response = await request.post(`${baseURL}/api/tag`, {
      headers,
      data: { name, slug, hidden },
    })
    expect(response.ok()).toBeTruthy()
    const { doc } = await response.json()
    createdTags.push(doc.id)
    return doc
  }

  const createPost = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    data: { title: string; slug: string; type: string; category: number; publishedDate: string },
  ) => {
    const response = await request.post(`${baseURL}/api/post`, {
      headers,
      data: { ...data, _status: 'published' },
    })
    expect(response.ok()).toBeTruthy()
    const { doc } = await response.json()
    createdPosts.push(doc.id)
    return doc
  }

  /**
   * Polls the RENDERED contents section for a card/link count, scoped to
   * `[data-home-section="contents"]`. The server-HTML polls above converge on
   * the ISR response, but the page may serve a heuristic-cached body that lags
   * the server (measured in the OPS83 verify run #15: the server showed the
   * kill switch applied while the rendered section still held the Instagram
   * link). This is the source that observes the actual payload — pair it with
   * `gotoHomeFresh` so the navigation itself misses the cache.
   */
  const expectSectionCount = (locator: Locator, expected: number, timeout = 15_000) =>
    expect
      .poll(async () => locator.count(), { timeout, message: 'contents section card count' })
      .toBe(expected)

  // The home route is ISR (s-maxage 300, no max-age): Chromium applies a
  // heuristic cache to such responses and a plain goto may serve the previous
  // body even after the poll converged (measured on the S2 snapshot tests —
  // flaky in CI, deterministic in prod-mode local). Navigating with a unique
  // query param misses every cache entry (HTTP + Next router), so the page
  // always comes fresh from the server; the app ignores unknown params.
  const gotoHomeFresh = async (page: Page) => {
    await page.goto(`/?e2e=${Date.now()}`)
  }

  // ---- S2/S3 — YouTube + Instagram feed: stub + settings helpers ----

  // Same derivation as playwright.config.ts: the stubs listen on dev port +
  // 1000 (YouTube) and + 2000 (Instagram).
  const youtubeStubUrl = youtubeStubUrlFor(baseURL)
  const instagramStubUrl = instagramStubUrlFor(baseURL)

  const setYouTubeStubState = async (request: APIRequestContext, state: 'ok' | 'fail') => {
    const response = await request.post(`${youtubeStubUrl}/__stub/state`, { data: { state } })
    expect(response.ok()).toBeTruthy()
  }

  const setInstagramStubState = async (request: APIRequestContext, state: 'ok' | 'fail') => {
    const response = await request.post(`${instagramStubUrl}/__stub/state`, { data: { state } })
    expect(response.ok()).toBeTruthy()
  }

  const updateSocialFeedSettings = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    data: Record<string, unknown>,
  ) => {
    const response = await request.post(`${baseURL}/api/globals/social-feed-settings`, {
      headers,
      data,
    })
    expect(response.ok()).toBeTruthy()
  }

  // Full unconfigured state: both feeds return null and the S1 behavior is intact.
  const resetSocialFeedSettings = async (
    request: APIRequestContext,
    headers: Record<string, string>,
  ) => {
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: '',
      youtubeChannelId: '',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: '',
      instagramUserId: '',
      instagramMaxItems: 3,
      excludedItems: [],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
      instagramSyncStatus: null,
    })
  }

  const bustSocialFeed = async (request: APIRequestContext) =>
    request
      .post(`${baseURL}/api/revalidate?tag=social-feed`, {
        headers: { 'x-revalidate-secret': revalidateSecret },
      })
      .catch(() => undefined)

  // Best-effort S2 teardown: deletes the created posts/tags, resets the social
  // feed to the unconfigured state and converges the home back to the empty
  // section so the serial chain starts deterministic on the next run.
  const cleanupS2Fixtures = async (request: APIRequestContext, headers: Record<string, string>) => {
    for (const id of createdPosts) {
      await request.delete(`${baseURL}/api/post/${id}`, { headers }).catch(() => undefined)
    }
    for (const id of createdTags) {
      await request.delete(`${baseURL}/api/tag/${id}`, { headers }).catch(() => undefined)
    }
    await resetSocialFeedSettings(request, headers).catch(() => undefined)
    await bustSocialFeed(request)
    await request
      .post(`${baseURL}/api/revalidate?tag=posts`, {
        headers: { 'x-revalidate-secret': revalidateSecret },
      })
      .catch(() => undefined)
  }

  test('shows the honest board empty state while no article is visible', async ({
    page,
    request,
  }) => {
    // The dev server persists its `posts` cache between runs, so an earlier
    // full-state run could leave it populated. Busting first makes the empty
    // state deterministic on every rerun.
    const revalidate = await request.post(`${baseURL}/api/revalidate?tag=posts`, {
      headers: { 'x-revalidate-secret': revalidateSecret },
    })
    expect(revalidate).toBeOK()

    // Plain URL on purpose: the test also pins the canonical home URL.
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    const section = page.locator('[data-home-section="contents"]')
    await expect(section).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Ainda não há publicações' })).toBeVisible()
    await expect(page.locator('[data-home-section="proof"]')).toHaveCount(0)
    await expect(page.locator('[data-home-section="problem"]')).toHaveCount(0)
  })

  test('renders the 1+3 editorial board and stacks it on mobile', async ({ page, request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)

    const visibleTag = await createTag(request, headers, categoryName, categorySlug)
    const hiddenTag = await createTag(request, headers, hiddenTagName, hiddenTagSlug, true)

    const now = Date.now()
    const posts = [
      {
        title: 'E2e Artigo em destaque',
        slug: `e2e-artigo-destaque-${runSuffix}`,
        type: 'artigo',
        minutesAgo: 1,
      },
      {
        title: 'E2e Notícia recente',
        slug: `e2e-noticia-recente-${runSuffix}`,
        type: 'noticia',
        minutesAgo: 60 * 26,
      },
      {
        title: 'E2e Campanha em ação',
        slug: `e2e-campanha-${runSuffix}`,
        type: 'campanha',
        minutesAgo: 60 * 50,
      },
      {
        title: 'E2e Notícia do interior',
        slug: `e2e-noticia-interior-${runSuffix}`,
        type: 'noticia',
        minutesAgo: 60 * 74,
      },
      {
        title: 'E2e Evento da agenda',
        slug: `e2e-evento-${runSuffix}`,
        type: 'evento',
        minutesAgo: 60 * 98,
      },
      {
        title: 'E2e Conteúdo oculto',
        slug: `e2e-oculto-${runSuffix}`,
        type: 'noticia',
        minutesAgo: 60 * 122,
      },
    ]
    for (const post of posts) {
      const isHidden = post.slug.includes('oculto')
      await createPost(request, headers, {
        title: post.title,
        slug: post.slug,
        type: post.type,
        category: isHidden ? hiddenTag.id : visibleTag.id,
        publishedDate: new Date(now - post.minutesAgo * 60_000).toISOString(),
      })
    }

    try {
      await page.setViewportSize({ width: 1280, height: 900 })
      await waitForHomeHTML(request, baseURL, ['E2e Artigo em destaque', 'Acompanhe de perto'])
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()

      await expect(
        section.getByRole('heading', { name: 'O mandato, onde a Bahia acontece' }),
      ).toBeVisible()
      await expect(section.getByText('Acompanhe de perto')).toBeVisible()
      await expect(
        section.getByText('Notícias, vídeos e registros do trabalho em Brasília e nos municípios.'),
      ).toBeVisible()
      await expect(section.getByRole('link', { name: 'Todos os artigos' })).toHaveAttribute(
        'href',
        '/artigos',
      )

      const bentoCards = section.locator(
        'a[href^="/artigo/"], a[href^="/noticia/"], a[href^="/campanha/"], a[href^="/evento/"]',
      )
      await expect(bentoCards.filter({ visible: true })).toHaveCount(4)
      for (const badge of ['Artigo', 'Notícia', 'Campanha', 'Evento']) {
        await expect(section.getByText(badge, { exact: true })).toHaveCount(0)
      }
      await expect(section.getByText('E2e Artigo em destaque').first()).toBeVisible()
      await expect(section.getByText('E2e Conteúdo oculto')).toHaveCount(0)
      await expect(section.getByText('E2e Oculta', { exact: false })).toHaveCount(0)

      const featured = section.getByRole('link', { name: /E2e Artigo em destaque/ })
      const featuredHref = await featured.getAttribute('href')
      expect(featuredHref).toBe(`/artigo/${categorySlug}/e2e-artigo-destaque-${runSuffix}`)
      await expect(featured.locator('h3')).toHaveText('E2e Artigo em destaque')

      // S47 — the board sits on the cream surface and the featured story
      // carries the cover; the three side rows are text-only.
      await expect(section).toHaveCSS('background-color', 'rgb(255, 248, 242)')

      await featured.click()
      await expect(page).toHaveURL(new RegExp(`${featuredHref}$`))
      await page.goBack()

      await page.setViewportSize({ width: 390, height: 844 })
      await gotoHomeFresh(page)
      const mobileSection = page.locator('[data-home-section="contents"]')
      await expect(mobileSection).toBeVisible()
      await expect(page.locator('[data-carousel="contents"]')).toHaveCount(0)
      for (const title of [
        'E2e Artigo em destaque',
        'E2e Notícia recente',
        'E2e Campanha em ação',
        'E2e Notícia do interior',
      ]) {
        await expect(mobileSection.getByText(title).first()).toBeVisible()
      }
      await expect(mobileSection.getByText('E2e Evento da agenda')).toHaveCount(0)
      await expect(mobileSection.getByText('E2e Conteúdo oculto')).toHaveCount(0)

      // Leave the home before deleting: prefetches after the deletion would 404.
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      const headers2 = await adminHeaders(request, baseURL).catch(() => undefined)
      if (headers2) {
        for (const id of createdPosts) {
          await request
            .delete(`${baseURL}/api/post/${id}`, { headers: headers2 })
            .catch(() => undefined)
        }
        for (const id of createdTags) {
          await request
            .delete(`${baseURL}/api/tag/${id}`, { headers: headers2 })
            .catch(() => undefined)
        }
        await request
          .post(`${baseURL}/api/revalidate?tag=posts`, {
            headers: { 'x-revalidate-secret': revalidateSecret },
          })
          .catch(() => undefined)
      }
    }
  })

  test('renders the YouTube feed with exclusions and opens videos on the platform', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'ok')

    const mixTag = await createTag(request, headers, `E2e Mix ${runSuffix}`, `e2e-mix-${runSuffix}`)
    await createPost(request, headers, {
      title: 'E2e Artigo no mix',
      slug: `e2e-artigo-mix-${runSuffix}`,
      type: 'artigo',
      category: mixTag.id,
      publishedDate: new Date(Date.now() - 60 * 60_000).toISOString(),
    })
    // The newest stub video is excluded: the board must skip it and promote the
    // next eligible one to the featured slot (the acceptance's "pula para o
    // próximo elegível").
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: 'e2e-youtube-api-key',
      youtubeChannelId: 'UCe2eTestChannel',
      youtubeMaxItems: 3,
      excludedItems: [{ platform: 'youtube', itemId: 'e2evideo004' }],
      youtubeFeedSnapshot: null,
    })

    try {
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Vídeo em destaque', 'E2e Artigo no mix'],
        ['E2e Vídeo excluído'],
      )
      await page.setViewportSize({ width: 1280, height: 900 })
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()

      const featured = section.getByRole('link', { name: /E2e Vídeo em destaque/ })
      await expect(featured).toBeVisible()
      await expect(featured).toHaveAttribute('href', 'https://www.youtube.com/watch?v=e2evideo001')
      await expect(featured).toHaveAttribute('target', '_blank')
      await expect(featured).toHaveAttribute('rel', 'noopener noreferrer')
      await expect(
        section.getByText('há 30 minutos · 12,4 mil visualizações').first(),
      ).toBeVisible()
      // S47 — the board header links the platform once; cards carry no chip.
      await expect(section.getByRole('link', { name: 'YouTube', exact: true })).toHaveAttribute(
        'href',
        'https://youtube.com/@JorgeSollaDep',
      )
      await expect(section.getByText('E2e Vídeo excluído')).toHaveCount(0)

      await expect(section.getByRole('link', { name: /E2e Artigo no mix/ }).first()).toBeVisible()
      await expect(section.getByText('há 2 horas · 8,1 mil visualizações').first()).toBeVisible()
      await expect(section.getByText('987 visualizações').first()).toBeVisible()

      const channelLink = section.getByRole('link', { name: 'YouTube', exact: true })
      await expect(channelLink).toHaveAttribute('href', 'https://youtube.com/@JorgeSollaDep')
      await expect(channelLink).toHaveAttribute('target', '_blank')

      await page.setViewportSize({ width: 390, height: 844 })
      await gotoHomeFresh(page)
      // S47 — the board stacks on mobile; no carousel track is rendered.
      await expect(page.locator('[data-carousel="contents"]')).toHaveCount(0)
      await expect(page.getByText('E2e Vídeo excluído')).toHaveCount(0)

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setYouTubeStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('hides YouTube cards and keeps articles when the API fails without a snapshot', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'fail')

    const fallbackTag = await createTag(
      request,
      headers,
      `E2e Fallback ${runSuffix}`,
      `e2e-fallback-${runSuffix}`,
    )
    await createPost(request, headers, {
      title: 'E2e Artigo fallback',
      slug: `e2e-artigo-fallback-${runSuffix}`,
      type: 'noticia',
      category: fallbackTag.id,
      publishedDate: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    })
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: 'e2e-youtube-api-key',
      youtubeChannelId: 'UCe2eTestChannel',
      youtubeMaxItems: 3,
      excludedItems: [],
      youtubeFeedSnapshot: null,
    })

    try {
      // The feed is configured, so the "YouTube" link stays; without a
      // snapshot the cards are silently absent and the article carries the
      // section (page never breaks, no error shown).
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Artigo fallback', 'YouTube'],
        ['E2e Vídeo em destaque'],
      )
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()
      await expect(section.getByRole('link', { name: /E2e Artigo fallback/ })).toBeVisible()
      await expect(section.getByText('E2e Vídeo em destaque')).toHaveCount(0)
      await expect(section.getByText('E2e Vídeo de caravana')).toHaveCount(0)
      await expect(section.getByRole('link', { name: 'YouTube', exact: true })).toBeVisible()

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setYouTubeStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('keeps the last snapshot while the API is down', async ({ page, request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'ok')
    const baseSettings = {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: 'e2e-youtube-api-key',
      youtubeChannelId: 'UCe2eTestChannel',
      youtubeMaxItems: 3,
      excludedItems: [{ platform: 'youtube', itemId: 'e2evideo004' }],
      youtubeFeedSnapshot: null,
    }
    await updateSocialFeedSettings(request, headers, baseSettings)

    try {
      // Live fetch succeeds and persists the raw snapshot.
      await waitForHomeHTML(request, baseURL, ['E2e Vídeo em destaque'], ['E2e Vídeo excluído'])
      await gotoHomeFresh(page)
      await expect(page.getByRole('link', { name: /E2e Vídeo em destaque/ }).first()).toBeVisible()
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)

      // API down + a settings change: the re-execution must serve the snapshot
      // re-filtered by the CURRENT exclusions/maxItems (raw snapshot, applied
      // on read) — maxItems 2 proves the re-run read the new settings. The
      // snapshot field is OMITTED on purpose: an update merges over the
      // existing doc (Payload update semantics), so the persisted snapshot
      // survives the settings edit — exactly the production admin path.
      await setYouTubeStubState(request, 'fail')
      const { youtubeFeedSnapshot: _ignored, ...settingsWithoutSnapshot } = baseSettings
      await updateSocialFeedSettings(request, headers, {
        ...settingsWithoutSnapshot,
        youtubeMaxItems: 2,
      })
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Vídeo em destaque', 'E2e Vídeo de caravana'],
        ['E2e Vídeo de entrevista'],
      )
      await gotoHomeFresh(page)
      await expect(page.getByRole('link', { name: /E2e Vídeo em destaque/ }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: /E2e Vídeo de caravana/ })).toBeVisible()
      await expect(page.getByText('E2e Vídeo de entrevista')).toHaveCount(0)
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)

      // API back: the live feed returns with the original cap.
      await setYouTubeStubState(request, 'ok')
      await updateSocialFeedSettings(request, headers, baseSettings)
      await waitForHomeHTML(request, baseURL, ['E2e Vídeo de entrevista'], ['E2e Vídeo excluído'])
      await gotoHomeFresh(page)
      await expect(page.getByText('E2e Vídeo de entrevista').first()).toBeVisible()
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setYouTubeStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('renders the Instagram feed with exclusions and opens posts on the platform', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'ok')
    await setInstagramStubState(request, 'ok')

    const mixTag = await createTag(
      request,
      headers,
      `E2e Mix IG ${runSuffix}`,
      `e2e-mix-ig-${runSuffix}`,
    )
    await createPost(request, headers, {
      title: 'E2e Artigo no mix IG',
      slug: `e2e-artigo-mix-ig-${runSuffix}`,
      type: 'artigo',
      category: mixTag.id,
      publishedDate: new Date(Date.now() - 60 * 60_000).toISOString(),
    })
    // The newest stub post is a grid mosaic marked as excluded: the board must
    // skip it and promote the next eligible one to the featured slot.
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: '',
      youtubeChannelId: '',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: 'e2e-ig-token',
      instagramUserId: '17841400000000000',
      instagramMaxItems: 3,
      excludedItems: [{ platform: 'instagram', itemId: 'e2e-ig-grade-excluido-5' }],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
    })

    try {
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Post do muro', 'E2e Artigo no mix IG'],
        ['E2e Post de grade'],
      )
      await page.setViewportSize({ width: 1280, height: 900 })
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()

      const featured = section.getByRole('link', { name: /E2e Post do muro/ })
      await expect(featured).toBeVisible()
      await expect(featured).toHaveAttribute('href', 'https://www.instagram.com/p/e2e-ig-muro-1/')
      await expect(featured).toHaveAttribute('target', '_blank')
      await expect(featured).toHaveAttribute('rel', 'noopener noreferrer')
      // S47 — the board header links the platform once; cards carry no chip.
      await expect(section.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute(
        'href',
        'https://instagram.com/depjorgesolla',
      )
      await expect(section.getByText('há 20 minutos').first()).toBeVisible()
      await expect(section.getByText('E2e Post de grade')).toHaveCount(0)

      // The captionless grid post shows the fallback title (it enters the
      // board automatically and the assessoria excludes it item by item).
      await expect(section.getByText('Publicação no Instagram').first()).toBeVisible()
      // Instagram cards keep the approved cover image.
      await expect(featured.locator('img').first()).toBeVisible()

      // Long captions are clamped with an ellipsis so a single post cannot
      // stretch the bento row (production captions run into hundreds of
      // characters; the stub's reel caption is deliberately long).
      const longCaptionTitle = section
        .getByRole('link', { name: /E2e Reel da caravana/ })
        .locator('h3')
      await expect(longCaptionTitle).toHaveCSS('-webkit-line-clamp', '3')
      await expect(longCaptionTitle).toHaveCSS('overflow', 'hidden')

      await expect(
        section.getByRole('link', { name: /E2e Artigo no mix IG/ }).first(),
      ).toBeVisible()
      await expect(section.getByText('E2e Reel da caravana').first()).toBeVisible()

      const profileLink = section.getByRole('link', { name: 'Instagram', exact: true })
      await expect(profileLink).toHaveAttribute('href', 'https://instagram.com/depjorgesolla')
      await expect(profileLink).toHaveAttribute('target', '_blank')

      await page.setViewportSize({ width: 390, height: 844 })
      await gotoHomeFresh(page)
      // S47 — the board stacks on mobile; no carousel track is rendered.
      await expect(page.locator('[data-carousel="contents"]')).toHaveCount(0)
      await expect(page.getByText('E2e Post de grade')).toHaveCount(0)

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setInstagramStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('hides Instagram cards and keeps articles when the API fails without a snapshot', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setInstagramStubState(request, 'fail')

    const fallbackTag = await createTag(
      request,
      headers,
      `E2e Fallback IG ${runSuffix}`,
      `e2e-fallback-ig-${runSuffix}`,
    )
    await createPost(request, headers, {
      title: 'E2e Artigo fallback IG',
      slug: `e2e-artigo-fallback-ig-${runSuffix}`,
      type: 'noticia',
      category: fallbackTag.id,
      publishedDate: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    })
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: '',
      youtubeChannelId: '',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: 'e2e-ig-token',
      instagramUserId: '17841400000000000',
      instagramMaxItems: 3,
      excludedItems: [],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
    })

    try {
      // Without a snapshot there is no username to build the profile link
      // from, so the IG cards AND the "Instagram" link stay
      // silently absent and the article carries the section (page never
      // breaks, no error shown).
      await waitForHomeHTML(request, baseURL, ['E2e Artigo fallback IG'], ['E2e Post do muro'])
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()
      await expect(section.getByRole('link', { name: /E2e Artigo fallback IG/ })).toBeVisible()
      // Same rendered-DOM class as the kill-switch test (OPS83 run #15): the
      // server poll converged but the page served a stale body — poll the DOM.
      await expectSectionCount(section.getByText('E2e Post do muro'), 0)
      await expect(section.getByRole('link', { name: 'Instagram', exact: true })).toBeVisible()

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setInstagramStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('keeps the last Instagram snapshot while the API is down', async ({ page, request }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setInstagramStubState(request, 'ok')
    const baseSettings = {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: '',
      youtubeChannelId: '',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: 'e2e-ig-token',
      instagramUserId: '17841400000000000',
      instagramMaxItems: 3,
      excludedItems: [{ platform: 'instagram', itemId: 'e2e-ig-grade-excluido-5' }],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
    }
    await updateSocialFeedSettings(request, headers, baseSettings)

    try {
      // Live fetch succeeds and persists the raw snapshot (with the username).
      await waitForHomeHTML(request, baseURL, ['E2e Post do muro'], ['E2e Post de grade'])
      await gotoHomeFresh(page)
      await expect(page.getByRole('link', { name: /E2e Post do muro/ }).first()).toBeVisible()
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)

      // API down + a settings change: the re-execution must serve the snapshot
      // re-filtered by the CURRENT exclusions/maxItems (raw snapshot, applied
      // on read) — maxItems 2 proves the re-run read the new settings, and the
      // profile link survives because the username came from the snapshot. The
      // snapshot field is OMITTED on purpose: an update merges over the
      // existing doc (Payload update semantics), so the persisted snapshot
      // survives the settings edit — exactly the production admin path.
      await setInstagramStubState(request, 'fail')
      const { instagramFeedSnapshot: _ignored, ...settingsWithoutSnapshot } = baseSettings
      await updateSocialFeedSettings(request, headers, {
        ...settingsWithoutSnapshot,
        instagramMaxItems: 2,
      })
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Post do muro', 'E2e Reel da caravana', 'Instagram'],
        ['Publicação no Instagram'],
      )
      await gotoHomeFresh(page)
      await expect(page.getByRole('link', { name: /E2e Post do muro/ }).first()).toBeVisible()
      await expect(page.getByText('E2e Reel da caravana').first()).toBeVisible()
      await expect(page.getByText('Publicação no Instagram')).toHaveCount(0)
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)

      // API back: the live feed returns with the original cap.
      await setInstagramStubState(request, 'ok')
      await updateSocialFeedSettings(request, headers, baseSettings)
      await waitForHomeHTML(request, baseURL, ['Publicação no Instagram'], ['E2e Post de grade'])
      await gotoHomeFresh(page)
      await expect(page.getByText('Publicação no Instagram').first()).toBeVisible()
      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setInstagramStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('the kill switch pauses the external feed without touching articles', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'ok')
    await setInstagramStubState(request, 'ok')

    const killTag = await createTag(
      request,
      headers,
      `E2e Kill ${runSuffix}`,
      `e2e-kill-${runSuffix}`,
    )
    await createPost(request, headers, {
      title: 'E2e Artigo kill switch',
      slug: `e2e-artigo-kill-${runSuffix}`,
      type: 'noticia',
      category: killTag.id,
      publishedDate: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    })
    await updateSocialFeedSettings(request, headers, {
      enabled: false,
      youtubeEnabled: true,
      youtubeApiKey: 'e2e-youtube-api-key',
      youtubeChannelId: 'UCe2eTestChannel',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: 'e2e-ig-token',
      instagramUserId: '17841400000000000',
      instagramMaxItems: 3,
      excludedItems: [],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
    })

    try {
      // `enabled: false` pauses the whole external board: no cards AND no
      // platform links (YouTube and Instagram alike), while the article
      // section lives on.
      await waitForHomeHTML(
        request,
        baseURL,
        ['E2e Artigo kill switch'],
        ['E2e Vídeo em destaque', 'E2e Post do muro'],
      )
      // The page can serve a heuristic-cached body that lags the server poll
      // (OPS83 run #15): navigate fresh AND poll the rendered section DOM —
      // the IG link is what failed there, scoped to the same payload.
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()
      await expect(section.getByRole('link', { name: /E2e Artigo kill switch/ })).toBeVisible()
      await expectSectionCount(section.getByText('E2e Vídeo em destaque'), 0)
      await expect(section.getByRole('link', { name: 'YouTube', exact: true })).toBeVisible()
      await expectSectionCount(section.getByText('E2e Post do muro'), 0)
      await expect(section.getByRole('link', { name: 'Instagram', exact: true })).toBeVisible()

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setYouTubeStubState(request, 'ok')
      await setInstagramStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })

  test('shares every content card on WhatsApp and copies the link (S4)', async ({
    page,
    request,
    context,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request, baseURL)
    await setYouTubeStubState(request, 'ok')
    await setInstagramStubState(request, 'ok')

    const shareTagSlug = `e2e-share-${runSuffix}`
    const shareTag = await createTag(request, headers, `E2e Share ${runSuffix}`, shareTagSlug)
    const articleTitle = 'E2e Artigo do compartilhar'
    await createPost(request, headers, {
      title: articleTitle,
      slug: `e2e-artigo-compartilhar-${runSuffix}`,
      type: 'noticia',
      category: shareTag.id,
      publishedDate: new Date(Date.now() - 5 * 60_000).toISOString(),
    })
    // Both feeds on, no exclusions: the board holds one card of each source
    // (newest article featured + Instagram/YouTube from the stubs).
    await updateSocialFeedSettings(request, headers, {
      enabled: true,
      youtubeEnabled: true,
      youtubeApiKey: 'e2e-youtube-api-key',
      youtubeChannelId: 'UCe2eTestChannel',
      youtubeMaxItems: 3,
      instagramEnabled: true,
      instagramAccessToken: 'e2e-ig-token',
      instagramUserId: '17841400000000000',
      instagramMaxItems: 3,
      excludedItems: [],
      youtubeFeedSnapshot: null,
      instagramFeedSnapshot: null,
    })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    try {
      await waitForHomeHTML(request, baseURL, [
        articleTitle,
        'E2e Vídeo em destaque',
        'E2e Post do muro',
      ])
      await page.setViewportSize({ width: 1280, height: 900 })
      await gotoHomeFresh(page)
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()

      // Every card of the 1+3 board (CONTENT_SECTION_LIMIT = 4) carries
      // exactly one discreet share button.
      await expect(section.getByRole('button', { name: 'Compartilhar' })).toHaveCount(4)
      const urlBeforeShare = page.url()
      const waMessage = async (item: Locator) => {
        const href = await item.getAttribute('href')
        expect(href).toBeTruthy()
        return decodeURIComponent(href!.slice('https://wa.me/?text='.length)).replace(/\+/g, ' ')
      }

      // Article card (featured): the popover builds the per-source message with
      // the canonical absolute article link, opened in a new tab with noopener.
      const articleCard = section.getByRole('link', { name: /E2e Artigo do compartilhar/ })
      const articleShare = articleCard
        .locator('xpath=..')
        .getByRole('button', { name: 'Compartilhar' })
      await articleShare.click()
      await expect(page).toHaveURL(urlBeforeShare)
      const waItem = page.getByRole('link', { name: 'Compartilhar no WhatsApp' })
      await expect(waItem).toBeVisible()
      await expect(waItem).toHaveAttribute('target', '_blank')
      await expect(waItem).toHaveAttribute('rel', 'noopener noreferrer')
      expect(await waMessage(waItem)).toBe(
        `Olha isso do Solla: ${articleTitle} — ${baseURL}/noticia/${shareTagSlug}/e2e-artigo-compartilhar-${runSuffix}`,
      )
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

      // Copy link puts the absolute URL in the clipboard and swaps the label.
      await articleShare.click()
      await page.getByRole('button', { name: /Copiar link/ }).click()
      await expect(page.getByRole('button', { name: 'Link copiado' })).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(`${baseURL}/noticia/${shareTagSlug}/e2e-artigo-compartilhar-${runSuffix}`)
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

      // Outside click also closes the popover.
      await articleShare.click()
      await section.getByRole('heading', { name: 'O mandato, onde a Bahia acontece' }).click()
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

      // Video card: the platform URL is shared with the video opener.
      const videoCard = section.getByRole('link', { name: /E2e Vídeo em destaque/ })
      const videoShare = videoCard.locator('xpath=..').getByRole('button', { name: 'Compartilhar' })
      await videoShare.click()
      expect(await waMessage(page.getByRole('link', { name: 'Compartilhar no WhatsApp' }))).toBe(
        'Olha esse vídeo do Solla: E2e Vídeo em destaque — https://www.youtube.com/watch?v=e2evideo001',
      )
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

      // Instagram card: the post opener.
      const instagramCard = section.getByRole('link', { name: /E2e Post do muro/ })
      const instagramShare = instagramCard
        .locator('xpath=..')
        .getByRole('button', { name: 'Compartilhar' })
      await instagramShare.click()
      expect(await waMessage(page.getByRole('link', { name: 'Compartilhar no WhatsApp' }))).toBe(
        'Olha esse post do Solla: E2e Post do muro — https://www.instagram.com/p/e2e-ig-muro-1/',
      )
      await page.keyboard.press('Escape')

      // Mobile: the board stacks and every card keeps its share control (44px
      // target) with the popover fully inside the viewport.
      await page.setViewportSize({ width: 390, height: 844 })
      await gotoHomeFresh(page)
      const mobileSection = page.locator('[data-home-section="contents"]')
      await expect(mobileSection).toBeVisible()
      await expect(mobileSection.getByRole('heading', { name: articleTitle })).toBeVisible()
      await expect(page.locator('[data-carousel="contents"]')).toHaveCount(0)
      const mobileShare = mobileSection
        .getByText(articleTitle)
        .first()
        .locator('xpath=../..')
        .getByRole('button', { name: 'Compartilhar' })
      await expect(mobileShare).toBeVisible()
      await mobileShare.scrollIntoViewIfNeeded()
      const buttonBox = await mobileShare.boundingBox()
      expect(buttonBox).not.toBeNull()
      expect(buttonBox!.width).toBeGreaterThanOrEqual(44)
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44)

      await mobileShare.click()
      const mobileWaItem = page.getByRole('link', { name: 'Compartilhar no WhatsApp' })
      await expect(mobileWaItem).toBeVisible()
      const mobileWaBox = await mobileWaItem.boundingBox()
      expect(mobileWaBox).not.toBeNull()
      expect(mobileWaBox!.x).toBeGreaterThanOrEqual(0)
      expect(mobileWaBox!.x + mobileWaBox!.width).toBeLessThanOrEqual(390)
      expect(await waMessage(mobileWaItem)).toBe(
        `Olha isso do Solla: ${articleTitle} — ${baseURL}/noticia/${shareTagSlug}/e2e-artigo-compartilhar-${runSuffix}`,
      )

      await page.goto('about:blank')
      await expect(page).toHaveURL(/about:blank/)
    } finally {
      await setYouTubeStubState(request, 'ok')
      await setInstagramStubState(request, 'ok')
      await cleanupS2Fixtures(request, headers)
    }
  })
})
