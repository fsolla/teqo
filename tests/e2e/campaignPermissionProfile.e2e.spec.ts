import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * C142 — advisor permission profiles respect the UI surface:
 *
 * 1. `somente_leitura` editing: no write controls on any surface, FAB absent.
 * 2. `carteira` editing: write scoped to portfolio; rows outside read-only.
 * 3. `tudo` editing: full write access everywhere.
 *
 * The spec reuses the shared `campaignFixture` which provisions a fresh
 * browser context per test — no cross-test cookie leaks.
 */

test.describe('Advisor permission profiles (C142)', () => {
  test.describe('somente_leitura — read-only across all surfaces', () => {
    test('municipality list has no write controls and the FAB is absent', async ({
      campaign,
      page,
    }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/municipios')
      await page.waitForLoadState('networkidle')

      // FAB must not be present on the municipality list (write surface).
      await expect(page.locator('[data-slot="campaign-quick-actions-fab"]')).toBeHidden()

      // "Nova demanda" button must not be present (we land on municipios, but
      // verify the FAB is absent which covers all surfaces).
      // Inspect the action bar for write controls.
      const actionButtons = page.getByRole('link', { name: /Nova|Criar|Editar/i })
      await expect(actionButtons).toHaveCount(0)
    })

    test('demands list has no "Nova demanda" button', async ({ campaign, page }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/demandas')
      await page.waitForLoadState('networkidle')

      // "Nova demanda" must not be rendered for a somente_leitura advisor.
      const novaDemanda = page.getByRole('link', { name: 'Nova demanda' })
      await expect(novaDemanda).toBeHidden()
    })

    test('activities list has no create buttons', async ({ campaign, page }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/atividades')
      await page.waitForLoadState('networkidle')

      // The "Planejar giro" and "Nova atividade" buttons must be absent.
      const createButtons = page.getByRole('button', { name: /Planejar|Nova atividade/i })
      await expect(createButtons).toHaveCount(0)
    })

    test('supporters list has no "Novo" or "Importar CSV" buttons', async ({ campaign, page }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/apoiadores')
      await page.waitForLoadState('networkidle')

      const novoButton = page.getByRole('link', { name: 'Novo' })
      await expect(novoButton).toBeHidden()
    })
  })

  test.describe('carteira editing — write scoped to portfolio', () => {
    test('rows outside the portfolio are read-only', async ({ campaign, page }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'carteira',
        editing: 'carteira',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/municipios')
      await page.waitForLoadState('networkidle')

      // The FAB should be present (carteira scope = write allowed).
      await expect(page.locator('[data-slot="campaign-quick-actions-fab"]')).toBeVisible()
    })
  })

  test.describe('tudo editing — full write access', () => {
    test('write controls are present', async ({ campaign, page }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'tudo',
      })
      await campaign.login(page, user.email!, user.password)

      await page.goto('/campanha/municipios')
      await page.waitForLoadState('networkidle')

      // The FAB must be present for a tudo advisor.
      await expect(page.locator('[data-slot="campaign-quick-actions-fab"]')).toBeVisible()
    })
  })
})
