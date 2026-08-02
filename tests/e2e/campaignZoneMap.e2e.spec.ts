import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B8 F2 — Salvador used to be one polygon carrying the whole city's votes, so
 * the choropleth could not answer "which piece of Salvador is weak / is mine".
 * This pins the two halves of that fix: the zone mesh is drawn (one path per
 * ZE, the city's own polygon left underneath as a non-interactive base) and a
 * zone is addressable on its own — the readout names it and opens it.
 */
test('the dashboard map paints Salvador zone by zone and opens one', async ({ campaign, page }) => {
  const { fixtures } = campaign
  const coordinator = await fixtures.createCampaignUser('coordinator', {
    name: fixtures.value('Coordenadora Mapa'),
  })
  const password = coordinator.password

  await campaign.login(page, coordinator.email!, password)
  await page.goto('/campanha/quadro')

  await expect(page.getByRole('heading', { name: 'Mapa dos Municípios' })).toBeVisible({
    timeout: 60_000,
  })
  await page.waitForSelector('path.leaflet-interactive', { timeout: 60_000 })

  // 417 municípios + 19 Salvador zones; Salvador's own polygon is the one path
  // that stays out of the pointer's way.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const paths = Array.from(document.querySelectorAll('.leaflet-overlay-pane path'))
          return {
            total: paths.length,
            interactive: paths.filter((path) => path.classList.contains('leaflet-interactive'))
              .length,
          }
        }),
      { timeout: 30_000 },
    )
    .toEqual({ total: 436, interactive: 435 })

  // Insertion order is z-order, so the zone mesh is the tail of the pane.
  await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('.leaflet-overlay-pane path'))
    paths.at(-1)?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  })

  const readout = page.locator('div[aria-live="polite"]').first()
  await expect(readout).toContainText(/Salvador — ZE \d+/)

  await readout.getByRole('link', { name: 'Abrir município' }).click()
  // B145: entity identity lives in the shell header, not a body h1.
  await expect(page).toHaveURL(/\/campanha\/municipios\/salvador-ze-\d+$/)
  await expect(page.locator('[data-slot="campaign-page-chrome-title"]')).toBeVisible()
})
