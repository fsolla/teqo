import { devices, type Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

const municipalityOmnibox = (page: Page) =>
  page.getByRole('combobox', { name: 'Filtrar municípios' })

const omniboxFontSize = (page: Page) =>
  municipalityOmnibox(page).evaluate((element) => getComputedStyle(element).fontSize)

/**
 * B183 — Safari iOS auto-zooms any focused form control whose computed
 * font-size is below 16px, and a standalone PWA does not always restore the
 * scale when the keyboard closes. The fix is one CSS rule for touch phones
 * (`(pointer: coarse) and (hover: none)`), so these specs pin the computed
 * size contract: 16px on a touch device, unchanged 14px on desktop.
 */
test.describe('B183 — inputs no touch ficam no limiar de 16px do auto-zoom iOS', () => {
  // The project pins Desktop Chromium, so spread only the mobile-emulation
  // bits of the iPhone descriptor (its `defaultBrowserType: 'webkit'` would
  // force a new worker inside a describe group).
  test.use({
    userAgent: devices['iPhone 13'].userAgent,
    viewport: devices['iPhone 13'].viewport,
    deviceScaleFactor: devices['iPhone 13'].deviceScaleFactor,
    isMobile: devices['iPhone 13'].isMobile,
    hasTouch: devices['iPhone 13'].hasTouch,
  })

  test('omnibox de municípios computa 16px em dispositivo touch', async ({ campaign, page }) => {
    const coordinator = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Coordenadora touch'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)

    const omnibox = municipalityOmnibox(page)
    await expect(omnibox).toBeVisible()
    await expect.poll(() => omniboxFontSize(page)).toBe('16px')
  })
})

test.describe('B183 — desktop preserva o tamanho atual', () => {
  test('omnibox de municípios continua em 14px', async ({ campaign, page }) => {
    const coordinator = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Coordenadora desktop'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)

    const omnibox = municipalityOmnibox(page)
    await expect(omnibox).toBeVisible()
    await expect.poll(() => omniboxFontSize(page)).toBe('14px')
  })
})
