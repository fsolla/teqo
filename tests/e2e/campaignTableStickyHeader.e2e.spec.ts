import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * D7 — the B41 sticky `<th>` set resolved against the `ui/Table` wrapper, which
 * `overflow-x-auto` (and the later `overflow-x-hidden` fallback) makes a scroll
 * container in both axes; the real vertical scroll happens on the shell's
 * `CampaignContentScroll`, so the header never engaged. The fix makes the
 * wrapper `overflow-x-clip` (clip + `overflow-y: visible` does NOT create a
 * scroll container), letting the already-declared `[&_th]:sticky` resolve
 * against the page scroller. This spec pins the behavior: the computed-style
 * guard below catches a regression to any scroll-container value, and the
 * two-sided position assertion catches the engagement itself.
 */
const contentScroll = (page: Page) => page.locator('[data-slot="campaign-content-scroll"]')
// During a concurrent RSC navigation Next may briefly retain the previous
// segment beside the incoming one — the current segment is appended last
// (same convention as campaignMunicipalityResponsiveColumns). Scoped to the
// list's own container so a second table on the page is never mistaken for it.
const tableContainer = (page: Page) =>
  page
    .locator('[data-container="municipality-list"], [data-container="territory-list"]')
    .last()
    .locator('[data-slot="table-container"]')
const firstTableHeader = (page: Page) => tableContainer(page).locator('thead th').first()

const topOf = (locator: Locator) =>
  locator.evaluate((element) => element.getBoundingClientRect().top)

/**
 * A sticky `top: 0` pins against the scrollport's content box, not its border:
 * the scroll container's own padding stays glued to the top of the viewport,
 * so the header rests below it (the B184 mobile omnibox behaves the same way).
 */
const contentAreaTop = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return element.getBoundingClientRect().top + parseFloat(style.paddingTop)
  })

test.describe('D7 — sticky header das tabelas desktop', () => {
  test.setTimeout(90_000)

  for (const route of ['municipios', 'territorios']) {
    test(`${route}: o thead gruda no topo do scrollport e volta ao fluxo`, async ({
      campaign,
      page,
    }) => {
      const coordinator = await campaign.fixtures.createCampaignUser('coordinator')
      await campaign.login(page, coordinator.email!, coordinator.password)

      // 1600x900 keeps the real desktop rails (open sidebar, Sollinha) far
      // above the 48rem container threshold, so the table is never gated
      // closed by the responsive columns (same convention as the rails test
      // in campaignMunicipalityResponsiveColumns).
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/campanha/${route}`)
      await page.waitForLoadState('networkidle')

      const scrollport = contentScroll(page)
      const header = firstTableHeader(page)
      await expect(header).toBeVisible()

      // Guard: the wrapper must not be a scroll container — an auto/hidden
      // value keeps the sticky resolved against itself, where it never engages.
      await expect
        .poll(() => tableContainer(page).evaluate((element) => getComputedStyle(element).overflowX))
        .toBe('clip')

      const scrollportTop = await topOf(scrollport)
      const pinnedTop = await contentAreaTop(scrollport)
      const topBefore = await topOf(header)
      // The header sits below the pinned line while in the flow (the filters
      // region sits above the table) — without that gap there is nothing to pin.
      expect(topBefore).toBeGreaterThan(pinnedTop + 30)

      // Scroll far enough that a non-sticky header would leave the scrollport
      // entirely, while a pinned one stays between the scrollport top and the
      // content-area top (its own padding included).
      await scrollport.evaluate(
        (element, offset) => {
          element.scrollTop = offset
        },
        topBefore - pinnedTop + 200,
      )
      await expect.poll(() => topOf(header)).toBeLessThanOrEqual(pinnedTop + 2)
      await expect.poll(() => topOf(header)).toBeGreaterThanOrEqual(scrollportTop - 1)

      await scrollport.evaluate((element) => {
        element.scrollTop = 0
      })
      await expect.poll(() => topOf(header)).toBeGreaterThan(pinnedTop + 30)
    })
  }
})
