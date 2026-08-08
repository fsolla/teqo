import { expect, test } from './fixtures/campaignE2EFixtures.js'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('Mobile bottom nav (B164)', () => {
  test('staff sees five-item bottom nav', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Nav'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')
    await expect(bottomNav).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Início' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Municípios' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Atualizações' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Agenda' })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: 'Mais' })).toBeVisible()
  })

  test('highlights active item and navigates on tap', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Nav Ativa'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')

    // Início is active on /campanha
    await expect(bottomNav.getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Navigate to Municípios — active state moves
    await bottomNav.getByRole('link', { name: 'Municípios' }).click()
    await expect(page).toHaveURL(/\/campanha\/municipios\/?$/)
    await expect(bottomNav.getByRole('link', { name: 'Municípios' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(bottomNav.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('Mais opens overflow drawer with secondary destinations', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Drawer'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')
    await bottomNav.getByRole('button', { name: 'Mais' }).click()

    const drawer = page.locator('[data-slot="drawer-content"]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Quadro', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Conceitos' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Perfil' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('leader does not see the bottom nav', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Líder Nav'),
      username: phone,
    })
    await campaign.login(page, phone, leader.password)
    await page.goto('/campanha/contatos')

    await expect(page.locator('[aria-label="Navegação principal"]')).toHaveCount(0)
  })

  test('hidden on desktop viewport', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Desktop'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/campanha')

    // CSS-hidden, but still in DOM
    await expect(page.locator('[aria-label="Navegação principal"]')).toBeHidden()
    // Sidebar trigger is visible on desktop
    await expect(page.getByRole('button', { name: /abrir ou fechar/i })).toBeVisible()
  })

  test('FAB sits above the bottom nav on mobile', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora FAB'),
    })
    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/municipios')

    const fab = page.getByRole('button', { name: 'Ações rápidas' })
    await expect(fab).toBeVisible()
    await expect(page.locator('[aria-label="Navegação principal"]')).toBeVisible()

    const fabBox = await fab.boundingBox()
    const navBox = await (await page.locator('[aria-label="Navegação principal"]')).boundingBox()
    if (fabBox && navBox) {
      expect(fabBox.y).toBeLessThan(navBox.y)
    }
  })
})
