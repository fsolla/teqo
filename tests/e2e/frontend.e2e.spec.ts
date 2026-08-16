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

    const hero = page.locator('[data-home-section="hero"]')
    const subtitleBox = await hero.locator('p').first().boundingBox()
    const actionsBox = await hero.locator('[data-cta="secondary"]').locator('..').boundingBox()
    if (!subtitleBox || !actionsBox) throw new Error('O conteúdo principal do hero não foi medido.')

    expect(actionsBox.y - (subtitleBox.y + subtitleBox.height)).toBeGreaterThanOrEqual(16)
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
