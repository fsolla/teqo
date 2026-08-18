import type { APIRequestContext, Page } from '@playwright/test'

import { seedTestUser, testUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

const swipeLeft = async (
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) => {
  const cdp = await page.context().newCDPSession(page)
  const y = Math.round(box.y + box.height / 2)
  const startX = Math.round(box.x + box.width * 0.82)
  const endX = Math.round(box.x + box.width * 0.12)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y }],
  })
  for (let step = 1; step <= 5; step += 1) {
    const x = Math.round(startX + ((endX - startX) * step) / 5)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(25)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('Frontend', () => {
  test('can go on homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Jorge Solla/)

    const heading = page.getByRole('heading', {
      level: 1,
      name: 'MAIS SAÚDE MAIS FUTURO',
    })

    await expect(heading).toBeVisible()
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute(
      'href',
      'https://apoiar.me/jorgesolla',
    )
  })

  test('animates the flags navigation and gives pointer feedback on campaign buttons', async ({
    page,
  }) => {
    await page.goto('/')

    const scrollContainer = page.locator('[data-theme="campaign-site"]')
    const secondaryCta = page.locator('[data-cta="secondary"]')

    await expect(scrollContainer).toHaveCSS('scroll-behavior', 'smooth')
    await secondaryCta.hover()
    await expect
      .poll(() => secondaryCta.evaluate((element) => getComputedStyle(element).transform))
      .toContain('1.05')

    const box = await secondaryCta.boundingBox()
    if (!box) throw new Error('O CTA secundário não ficou visível para testar o clique.')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect(secondaryCta).toHaveCSS('opacity', '0.8')
    await page.mouse.move(0, 0)
    await page.mouse.up()

    await secondaryCta.click()
    await expect(page).toHaveURL(/#bandeiras$/)
    await expect(page.locator('#bandeiras')).toBeInViewport()
  })

  test('keeps breathing room between the wrapped hero subtitle and CTAs on iPhone SE', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)

    const hero = page.locator('[data-home-section="hero"]')
    const subtitleBox = await hero.locator('p').first().boundingBox()
    const actionsBox = await hero.locator('[data-cta="secondary"]').locator('..').boundingBox()
    if (!subtitleBox || !actionsBox) throw new Error('O conteúdo principal do hero não foi medido.')

    expect(actionsBox.y - (subtitleBox.y + subtitleBox.height)).toBeGreaterThanOrEqual(16)
  })

  test('adapts the campaign first fold fluidly across the reference viewport sizes', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)

    const measureFirstFold = async (width: number, height: number) => {
      await page.setViewportSize({ width, height })

      return page.evaluate(() => {
        const hero = document.querySelector<HTMLElement>('[data-home-section="hero"]')
        const proof = document.querySelector<HTMLElement>('[data-home-section="proof"]')
        const scrollContainer = document.querySelector<HTMLElement>('[data-theme="campaign-site"]')
        if (!hero || !proof || !scrollContainer)
          throw new Error('A primeira dobra não foi montada.')

        const box = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector)
          if (!element) throw new Error(`Elemento responsivo ausente: ${selector}`)
          const bounds = element.getBoundingClientRect()
          return { x: bounds.x, y: bounds.y, width: bounds.width }
        }
        const heroBounds = hero.getBoundingClientRect()

        return {
          heroHeight: heroBounds.height,
          firstFoldHeight: heroBounds.height + proof.getBoundingClientRect().height,
          horizontalOverflow: scrollContainer.scrollWidth - scrollContainer.clientWidth,
          title: box('.campaign-hero-title'),
          portrait: box('.campaign-hero-portrait'),
          secondaryAction: box('[data-cta="secondary"]'),
        }
      })
    }

    const penpotBoards = [
      {
        width: 393,
        height: 852,
        heroHeight: 745,
        firstFoldHeight: 833,
        title: [-5, 462, 392],
        portrait: [-6, 53, 422],
        secondaryAction: [108, 652, 145],
      },
      {
        width: 768,
        height: 1024,
        heroHeight: 901,
        firstFoldHeight: 1024,
        title: [121, 497, 537],
        portrait: [193, 88, 422],
        secondaryAction: [214, 774, 158],
      },
      {
        width: 1024,
        height: 900,
        heroHeight: 543,
        firstFoldHeight: 691,
        title: [585, 106, 392],
        portrait: [153, 26, 465],
        secondaryAction: [637, 349, 158],
      },
      {
        width: 1280,
        height: 800,
        heroHeight: 676,
        firstFoldHeight: 800,
        title: [738, 127, 392],
        portrait: [239, 84, 533],
        secondaryAction: [790, 370, 158],
      },
      {
        width: 1366,
        height: 768,
        heroHeight: 627,
        firstFoldHeight: 768,
        title: [762, 106, 392],
        portrait: [325, 9, 555],
        secondaryAction: [814, 349, 158],
      },
      {
        width: 1920,
        height: 1080,
        heroHeight: 871,
        firstFoldHeight: 1080,
        title: [1093, 190, 607],
        portrait: [524, 91, 702],
        secondaryAction: [1325, 556, 174],
      },
    ]

    for (const board of penpotBoards) {
      const measured = await measureFirstFold(board.width, board.height)
      expect(Math.abs(measured.heroHeight - board.heroHeight)).toBeLessThanOrEqual(2)
      expect(Math.abs(measured.firstFoldHeight - board.firstFoldHeight)).toBeLessThanOrEqual(2)
      expect(measured.horizontalOverflow).toBeLessThanOrEqual(1)

      for (const key of ['title', 'portrait', 'secondaryAction'] as const) {
        const [x, y, width] = board[key]
        expect(Math.abs(measured[key].x - x)).toBeLessThanOrEqual(8)
        expect(Math.abs(measured[key].y - y)).toBeLessThanOrEqual(2)
        expect(Math.abs(measured[key].width - width)).toBeLessThanOrEqual(2)
      }
    }

    const compact = [
      await measureFirstFold(393, 852),
      await measureFirstFold(580, 900),
      await measureFirstFold(768, 1024),
    ]
    expect(compact[1].heroHeight).toBeGreaterThan(compact[0].heroHeight)
    expect(compact[1].heroHeight).toBeLessThan(compact[2].heroHeight)

    const standardDesktop = [
      await measureFirstFold(1024, 900),
      await measureFirstFold(1152, 900),
      await measureFirstFold(1280, 800),
    ]
    expect(standardDesktop[1].heroHeight).toBeGreaterThan(standardDesktop[0].heroHeight)
    expect(standardDesktop[1].heroHeight).toBeLessThan(standardDesktop[2].heroHeight)

    const wideDesktop = [
      await measureFirstFold(1366, 768),
      await measureFirstFold(1600, 900),
      await measureFirstFold(1920, 1080),
    ]
    expect(wideDesktop[1].heroHeight).toBeGreaterThan(wideDesktop[0].heroHeight)
    expect(wideDesktop[1].heroHeight).toBeLessThan(wideDesktop[2].heroHeight)

    const aspectBoundary = [
      await measureFirstFold(1280, 747),
      await measureFirstFold(1280, 746),
      await measureFirstFold(1920, 1121),
      await measureFirstFold(1920, 1120),
    ]
    expect(Math.abs(aspectBoundary[0].heroHeight - aspectBoundary[1].heroHeight)).toBeLessThan(2)
    expect(Math.abs(aspectBoundary[2].heroHeight - aspectBoundary[3].heroHeight)).toBeLessThan(2)
  })

  test('anchors the desktop portraits to the hero floor without height-dependent scaling', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)

    const measureComposition = async (width: number, height: number) => {
      await page.setViewportSize({ width, height })

      return page.evaluate(() => {
        const bounds = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector)
          if (!element) throw new Error(`Elemento da composição ausente: ${selector}`)
          return element.getBoundingClientRect()
        }
        const hero = bounds('[data-home-section="hero"]')
        const stage = bounds('.campaign-hero-stage')
        const portrait = bounds('.campaign-hero-portrait')
        const lula = bounds('.campaign-hero-ally--lula')
        const wagner = bounds('.campaign-hero-ally--wagner')
        const title = bounds('.campaign-hero-title')

        return {
          portrait: { left: portrait.left, width: portrait.width },
          portraitBottomGap: hero.bottom - portrait.bottom,
          lulaBottomGap: hero.bottom - lula.bottom,
          wagnerBottomGap: hero.bottom - wagner.bottom,
          portraitTitleGap: title.left - portrait.right,
          stageWidth: stage.width,
        }
      })
    }

    const short = await measureComposition(1340, 70)
    const regular = await measureComposition(1340, 700)

    expect(Math.abs(short.portrait.width - regular.portrait.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(short.portrait.left - regular.portrait.left)).toBeLessThanOrEqual(1)

    for (const composition of [short, regular]) {
      expect(Math.abs(composition.portraitBottomGap)).toBeLessThanOrEqual(1)
      expect(Math.abs(composition.lulaBottomGap)).toBeLessThanOrEqual(1)
      expect(Math.abs(composition.wagnerBottomGap)).toBeLessThanOrEqual(1)
    }

    const ultraWide = await measureComposition(2358, 1030)
    expect(Math.abs(ultraWide.portraitBottomGap)).toBeLessThanOrEqual(1)
    expect(Math.abs(ultraWide.lulaBottomGap)).toBeLessThanOrEqual(1)
    expect(Math.abs(ultraWide.wagnerBottomGap)).toBeLessThanOrEqual(1)
    expect(ultraWide.portraitTitleGap).toBeLessThanOrEqual(64)
    expect(ultraWide.stageWidth).toBeLessThanOrEqual(1920)
  })

  test('keeps the hero readable with WCAG text spacing overrides', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await page.addStyleTag({
      content: `
        [data-home-section="hero"] :is(h1, p, a, small, span, strong) {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        [data-home-section="hero"] p { margin-bottom: 2em !important; }
      `,
    })

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 393, height: 852 },
      { width: 768, height: 1024 },
      { width: 1024, height: 597 },
      { width: 1366, height: 768 },
      { width: 1600, height: 600 },
      { width: 1920, height: 840 },
    ]) {
      await page.setViewportSize(viewport)
      const spacing = await page.evaluate(() => {
        const element = (selector: string) => {
          const match = document.querySelector<HTMLElement>(selector)
          if (!match) throw new Error(`Elemento ausente no teste de espaçamento: ${selector}`)
          return match
        }
        const bounds = (selector: string) => {
          return element(selector).getBoundingClientRect()
        }
        const hero = bounds('[data-home-section="hero"]')
        const title = bounds('.campaign-hero-title')
        const copy = bounds('.campaign-hero-copy')
        const actions = bounds('.campaign-hero-actions')
        const accolades = bounds('.campaign-hero-accolades')
        const secondaryAction = element('[data-cta="secondary"]')
        const primaryAction = element('[data-cta="primary"]')
        const scrollContainer = document.querySelector<HTMLElement>('[data-theme="campaign-site"]')
        if (!scrollContainer) throw new Error('Container da campanha ausente.')

        const overlapArea = (first: DOMRect, second: DOMRect) =>
          Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left)) *
          Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))

        return {
          titleCopyGap: copy.top - title.bottom,
          copyActionsGap: actions.top - copy.bottom,
          actionsBottomGap: hero.bottom - actions.bottom,
          accoladesBottomGap: hero.bottom - accolades.bottom,
          actionsAccoladesOverlap: overlapArea(actions, accolades),
          primaryActionOverflow: primaryAction.scrollHeight - primaryAction.clientHeight,
          secondaryActionOverflow: secondaryAction.scrollHeight - secondaryAction.clientHeight,
          horizontalOverflow: scrollContainer.scrollWidth - scrollContainer.clientWidth,
        }
      })

      expect(spacing.titleCopyGap).toBeGreaterThanOrEqual(0)
      expect(spacing.copyActionsGap).toBeGreaterThanOrEqual(0)
      expect(spacing.actionsBottomGap).toBeGreaterThanOrEqual(44)
      expect(spacing.accoladesBottomGap).toBeGreaterThanOrEqual(0)
      expect(spacing.actionsAccoladesOverlap).toBe(0)
      expect(spacing.primaryActionOverflow).toBeLessThanOrEqual(0)
      expect(spacing.secondaryActionOverflow).toBeLessThanOrEqual(0)
      expect(spacing.horizontalOverflow).toBeLessThanOrEqual(1)
    }
  })

  test('auto-advances and keeps carousel controls synchronized', async ({ page }) => {
    await page.goto('/')

    const problemCarousel = page.getByRole('region', {
      name: 'Bandeiras que tornam esta eleição decisiva',
    })
    const firstProblem = problemCarousel.getByRole('listitem', { name: '1 de 3' })
    const secondProblem = problemCarousel.getByRole('listitem', { name: '2 de 3' })

    await expect(firstProblem).toHaveAttribute('aria-current', 'true')
    await expect(secondProblem).toHaveAttribute('aria-current', 'true', { timeout: 6_000 })

    const flagCarousel = page.getByRole('region', { name: 'Bandeiras da campanha' })
    const educationChip = flagCarousel.getByRole('button', { name: 'Educação' })
    await educationChip.click()
    await expect(educationChip).toHaveAttribute('aria-current', 'true')
  })

  test('supports a real horizontal touch swipe on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 })
    await page.goto('/')

    const overlayBox = await page.locator('[data-mobile-hero-overlay]').boundingBox()
    expect(overlayBox?.x).toBe(0)
    expect(overlayBox?.width).toBe(430)

    const mobileSpacing = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
      const problemSection = rect('[data-home-section="problem"]')
      const problemLead = rect('#problem-title + p')
      const problemCarousel = rect('[data-home-section="problem"] [data-carousel]')
      const flagsSection = rect('[data-home-section="flags"]')
      const flagsCarousel = rect('[data-home-section="flags"] [data-carousel]')

      return {
        leadGap:
          problemLead && problemCarousel ? problemCarousel.top - problemLead.bottom : undefined,
        problemBottomGap:
          problemSection && problemCarousel
            ? problemSection.bottom - problemCarousel.bottom
            : undefined,
        flagsBottomGap:
          flagsSection && flagsCarousel ? flagsSection.bottom - flagsCarousel.bottom : undefined,
      }
    })
    expect(mobileSpacing.leadGap).toBeLessThan(40)
    expect(mobileSpacing.problemBottomGap).toBeGreaterThanOrEqual(40)
    expect(mobileSpacing.flagsBottomGap).toBeGreaterThanOrEqual(40)

    const carousel = page.getByRole('region', { name: 'Bandeiras da campanha' })
    await carousel.focus()
    const track = carousel.locator('[data-carousel-track]')
    await track.scrollIntoViewIfNeeded()
    const box = await track.boundingBox()
    if (!box) throw new Error('O trilho das bandeiras não ficou visível para o swipe.')

    await swipeLeft(page, box)

    await expect(carousel.getByRole('button', { name: 'Educação' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})

/**
 * S1 — content section on the campaign home. Runs serially: the empty-state
 * test depends on the suite's default DB (no posts) and must execute before
 * the full-state test creates posts. Posts/tags are created through the
 * deployed REST API so the server process runs the real `afterChange` cache
 * hooks (a Local API call from the runner would throw on `revalidateTag`),
 * and cleanup busts the `posts` tag through the revalidate endpoint.
 */
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

  test.beforeAll(async () => {
    await seedTestUser()
  })

  const adminHeaders = async (request: APIRequestContext): Promise<Record<string, string>> => {
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(login.ok()).toBeTruthy()
    const { token } = await login.json()
    return { cookie: `payload-token=${token}` }
  }

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

  // ISR serves the stale page while it regenerates after a revalidateTag
  // (slower under the parallel suite), and a navigation that lands on it never
  // refreshes its DOM. Poll the server HTML positively until it converges to
  // the expected section state; the navigation that follows then always lands
  // on the fresh page.
  const waitForHomeSectionState = async (
    request: APIRequestContext,
    expected: 'present' | 'absent',
    attempts = 12,
  ) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await request.get(`${baseURL}/`).catch(() => undefined)
      if (response?.ok()) {
        const html = await response.text()
        const present = html.includes('data-home-section="contents"')
        if (present === (expected === 'present')) return
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    throw new Error(
      `A home não convergiu para o estado "${expected}" da seção de conteúdos após ${attempts}s.`,
    )
  }

  test('hides the content section while no articles are visible', async ({ page, request }) => {
    // The dev server persists its `posts` cache to .next-e2e/cache/fetch-cache
    // between runs, so an earlier full-state run could leave it populated.
    // Busting first makes the empty state deterministic on every rerun.
    await request
      .post(`${baseURL}/api/revalidate?tag=posts`, {
        headers: { 'x-revalidate-secret': revalidateSecret },
      })
      .catch(() => undefined)
    await waitForHomeSectionState(request, 'absent')

    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('[data-home-section="contents"]')).toHaveCount(0)
    await expect(page.getByText('A caminhada, em tempo real')).toHaveCount(0)

    const proof = await page.locator('[data-home-section="proof"]').boundingBox()
    const problem = await page.locator('[data-home-section="problem"]').boundingBox()
    expect(proof).not.toBeNull()
    expect(problem).not.toBeNull()
    expect(problem!.y - (proof!.y + proof!.height)).toBeLessThanOrEqual(1)
  })

  test('renders the article bento and the one-per-screen mobile carousel', async ({
    page,
    request,
  }) => {
    await seedTestUser()
    const headers = await adminHeaders(request)

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
      // The create hooks revalidated the `posts` tag in the server process;
      // wait until the regenerated page actually shows the section.
      await waitForHomeSectionState(request, 'present')
      await page.goto('/')
      const section = page.locator('[data-home-section="contents"]')
      await expect(section).toBeVisible()

      await expect(
        section.getByRole('heading', { name: 'A caminhada, em tempo real' }),
      ).toBeVisible()
      await expect(section.getByText('Acompanhe de perto')).toBeVisible()
      await expect(
        section.getByText(
          'Bastidores, caravanas e as lutas do mandato: conteúdo atualizado, direto das redes.',
        ),
      ).toBeVisible()
      await expect(section.getByRole('link', { name: /Ver artigos/ })).toHaveAttribute(
        'href',
        '/artigos',
      )

      const bentoCards = section.locator(
        'a[href^="/artigo/"], a[href^="/noticia/"], a[href^="/campanha/"], a[href^="/evento/"]',
      )
      await expect(bentoCards.filter({ visible: true })).toHaveCount(5)
      for (const badge of ['Artigo', 'Notícia', 'Campanha', 'Evento']) {
        await expect(section.getByText(badge, { exact: true }).first()).toBeVisible()
      }
      await expect(section.getByText('E2e Artigo em destaque').first()).toBeVisible()
      await expect(section.getByText('E2e Conteúdo oculto')).toHaveCount(0)
      await expect(section.getByText('E2e Oculta', { exact: false })).toHaveCount(0)

      const featured = section.getByRole('link', { name: /E2e Artigo em destaque/ })
      const featuredHref = await featured.getAttribute('href')
      expect(featuredHref).toBe(`/artigo/${categorySlug}/e2e-artigo-destaque-${runSuffix}`)

      const firstCard = bentoCards.first()
      await expect(firstCard).toBeVisible()
      await expect(firstCard.locator('h3')).toHaveText('E2e Artigo em destaque')
      await expect(firstCard.locator('span').last()).toContainText(categoryName)

      await featured.click()
      await expect(page).toHaveURL(new RegExp(`${featuredHref}$`))
      await page.goBack()

      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/')
      const carousel = page.getByRole('region', { name: 'Artigos recentes' })
      await expect(carousel).toBeVisible()
      await expect(carousel.getByText('E2e Conteúdo oculto')).toHaveCount(0)

      const track = carousel.locator('[data-carousel-track]')
      await track.scrollIntoViewIfNeeded()
      const trackBox = await track.boundingBox()
      if (!trackBox) throw new Error('O trilho do carrossel de conteúdo não ficou visível.')

      const slides = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('[data-carousel="contents"] [data-carousel-index]'),
        ).map((slide) => slide.getBoundingClientRect().width),
      )
      expect(slides).toHaveLength(5)
      expect(slides.every((width) => Math.abs(width - slides[0]) < 1)).toBe(true)

      await swipeLeft(page, trackBox)
      await expect(carousel.getByText('2 de 5 · deslize para ver os próximos')).toBeVisible()

      await carousel.getByRole('button', { name: 'Ir para o conteúdo 4 de 5' }).click()
      await expect(carousel.getByText('4 de 5 · deslize para ver os próximos')).toBeVisible()
    } finally {
      const headers2 = await adminHeaders(request).catch(() => undefined)
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

        // Converge the persisted dev cache back to the empty state so the
        // next run starts deterministic (fail-closed on delete, too).
        await waitForHomeSectionState(request, 'absent')
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/')
        await expect(page.locator('[data-home-section="contents"]')).toHaveCount(0)
      }
    }
  })
})
