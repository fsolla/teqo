import type { Page } from '@playwright/test'

import type { CampaignUser } from '../../src/payload-types.js'
import { expect, test, type CampaignE2EFixture } from './fixtures/campaignE2EFixtures.js'

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const DESKTOP_VIEWPORT = { width: 1280, height: 900 }

/**
 * Dynamic campaign pages stream their content (awaited `searchParams`), so
 * right after `page.goto` the DOM can hold a transient hidden `#S:*` copy of
 * the page shell while the stream settles. All class-based locators below
 * filter `visible: true` so assertions never match that transient duplicate
 * (role-based locators already exclude it).
 */
const settleStream = (page: Page) =>
  page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0, undefined, {
    timeout: 15_000,
  })

const seedUpdates = async (
  campaign: CampaignE2EFixture,
): Promise<CampaignUser & { password: string }> => {
  const { fixtures } = campaign
  const coordinator = await fixtures.createCampaignUser('coordinator')
  const municipality = await fixtures.claimMunicipality()
  for (let i = 0; i < 8; i += 1) {
    await fixtures.payload.create({
      collection: 'municipalityUpdate',
      data: {
        municipality: municipality.id,
        author: coordinator.id,
        polarity: i % 2 === 0 ? 'boa' : 'ruim',
        body: `Fato de campo C106 #${i + 1} em ${municipality.name}`,
      },
      depth: 0,
    })
  }
  return coordinator
}

const scrollFeedToBottom = (page: Page) =>
  page.evaluate(() => {
    document.querySelector('[data-slot="campaign-content-scroll"]')?.scrollTo(0, 1e5)
  })

test.describe('C106 — atualizações mobile sem moldura', () => {
  test.setTimeout(90_000)

  test('mobile: strip sem label/moldura e sticky, criar no header, cards edge-to-edge', async ({
    campaign,
    page,
  }) => {
    const coordinator = await seedUpdates(campaign)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/atualizacoes`)
    await settleStream(page)

    const strip = page.locator('.campaign-updates-filter-strip').filter({ visible: true })
    const feedList = page.locator('ul.campaign-updates-feed-list').filter({ visible: true })

    // Label visualmente oculta (sr-only clip), mas presente no a11y tree.
    await expect(strip.locator('label')).toHaveCSS('position', 'absolute')
    await expect(strip.locator('label')).toHaveCSS('width', '1px')

    // Filtro sem moldura e sticky sob a top bar, separado por uma linha.
    await expect(strip).toHaveCSS('position', 'sticky')
    await expect(strip).toHaveCSS('top', '0px')
    await expect(strip).toHaveCSS('border-bottom-width', '1px')
    await expect(strip.locator('[data-slot="campaign-omnibox-field"]')).toHaveCSS(
      'border-top-width',
      '0px',
    )

    // "Nova atualização" com texto some; o icon entra no header mobile.
    await expect(strip.getByRole('button', { name: 'Nova atualização' })).toBeHidden()
    const headerCreate = page.locator(
      '[data-slot="campaign-mobile-top-bar"] button[aria-label="Nova atualização"]',
    )
    await expect(headerCreate).toBeVisible()

    // Cards edge-to-edge, sem moldura, com a linha entre eles.
    await expect(feedList).toHaveCSS('margin-left', '-16px')
    const firstCard = feedList.locator('li').first()
    await expect(firstCard).toHaveCSS('border-top-width', '0px')
    await expect(firstCard).toHaveCSS('border-radius', '0px')
    await expect(firstCard).toHaveCSS('border-bottom-width', '1px')
    await expect(firstCard).toContainText('Fato de campo C106 #8')

    // O filtro permanece visível o tempo todo: preso à top bar durante a rolagem.
    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"]')
    await scrollFeedToBottom(page)
    await expect
      .poll(async () => (await strip.boundingBox())?.y)
      .toBe(Math.round((await topBar.boundingBox())?.height ?? 56))
    const scrolled = await page.evaluate(
      () => document.querySelector('[data-slot="campaign-content-scroll"]')?.scrollTop ?? 0,
    )
    expect(scrolled).toBeGreaterThan(100)

    // O icon no header abre o mesmo bottom sheet de criação.
    await headerCreate.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Nova atualização', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Registrar atualização' })).toBeVisible()
  })

  test('mobile: empty state aponta para a ação de criar sem citar o botão', async ({
    campaign,
    page,
  }) => {
    const coordinator = await seedUpdates(campaign)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/atualizacoes`)
    await settleStream(page)

    await page.getByRole('combobox', { name: 'Filtrar atualizações' }).fill('zzz')
    await page.getByRole('combobox', { name: 'Filtrar atualizações' }).press('Enter')

    await expect(page.getByText('Nenhuma atualização encontrada')).toBeVisible()
    await expect(page.getByText('Ajuste o filtro ou registre um novo fato de campo.')).toBeVisible()
  })

  test('desktop: label, botão com texto e cards com moldura ficam como estão', async ({
    campaign,
    page,
  }) => {
    const coordinator = await seedUpdates(campaign)
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/atualizacoes`)
    await settleStream(page)

    const strip = page.locator('.campaign-updates-filter-strip').filter({ visible: true })

    // Sem sticky e sem linha separadora no desktop.
    await expect(strip).toHaveCSS('position', 'static')
    await expect(strip).toHaveCSS('border-bottom-width', '0px')

    // Label e botão com texto seguem visíveis.
    await expect(strip.locator('label')).toHaveCSS('position', 'static')
    await expect(strip.getByRole('button', { name: 'Nova atualização' })).toBeVisible()

    // Nenhum icon de criar nos headers.
    await expect(page.locator('header button[aria-label="Nova atualização"]').first()).toBeHidden()

    // Cards mantêm a moldura arredondada e o gap.
    const firstCard = page.locator('ul.campaign-updates-feed-list li').first()
    await expect(firstCard).toHaveCSS('border-top-width', '1px')
    await expect(firstCard).toHaveCSS('border-radius', '12px')
  })
})
