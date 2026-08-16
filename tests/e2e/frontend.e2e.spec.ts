import type { Page } from '@playwright/test'

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
      name: 'UM MANDATO DO TAMANHO DA BAHIA',
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
