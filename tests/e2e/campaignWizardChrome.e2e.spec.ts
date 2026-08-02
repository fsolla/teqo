import { WIZARD_MUNICIPALITY_STEP_TITLE } from '../../src/lib/campaignWizardCopy.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('Wizard — header mobile (B75)', () => {
  test('entry step shows wizard flow title and dismiss without sidebar trigger', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos')

    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"][data-mode="wizard"]')
    await expect(topBar).toBeVisible()
    await expect(topBar.getByText('Ajustar votos', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toHaveCount(0)
    await expect(page.getByLabel('Buscar município')).toBeVisible()
    await expect(page.getByRole('region', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sair da ação' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Voltar/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Voltar/ })).toHaveCount(0)

    await page.getByRole('link', { name: 'Sair da ação' }).click()
    await page.waitForURL(/\/campanha\/?$/)
  })

  test('continue step shows back control and municipality in wizard header', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    // Claimed, never hardcoded: parallel specs sharing one seeded municipality
    // raced each other's mutations on it (miss #73).
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/atualizar-votos?municipio=${municipality.slug}`)

    await expect(page.getByRole('main', { name: /Ação: Ajustar votos/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('textbox', { name: 'Média' })).toBeVisible()

    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"][data-mode="wizard"]')
    await expect(topBar.getByText('Ajustar votos', { exact: true })).toBeVisible()
    await expect(
      topBar.getByLabel(new RegExp(`^Município em atualização: ${municipality.name}`, 'i')),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Voltar/ })).toBeVisible()

    await page.getByRole('button', { name: /Voltar/ }).click()
    await page.waitForURL(/\/campanha\/acoes\/atualizar-votos\/?$/)
    await expect(page.getByRole('heading', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toHaveCount(0)
    await expect(page.getByLabel('Buscar município')).toBeVisible()
  })
})
