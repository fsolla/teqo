import { fallbackDemandTitle } from '../../src/lib/demandTitle.js'
import {
  CAMPAIGN_DEMAND_ACTIVITY_LABEL,
  CAMPAIGN_DEMAND_BODY_LABEL,
  CAMPAIGN_DEMAND_KIND_LABEL,
} from '../../src/lib/schemas/campaignDemand.js'
import { expect, test, waitForStreamSettled } from './fixtures/campaignE2EFixtures.js'

test.use({ viewport: { width: 390, height: 844 } })

test.describe('Wizard "Registrar pedido" (A5/B195)', () => {
  test('creates a demand from the final step and returns to the origin', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()
    const description = fixtures.value(
      '500 santinhos para a feira de sábado; precisa de transporte para o comício.',
    )

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-pedido?municipio=${municipality.slug}`)
    // Prod-build streams a transient hidden `div[id^="S:*"]` copy of the whole
    // wizard shell + form (OPS83/C106 artifact, #517; B195-F1 diag) — wait it
    // out before any strict-mode assertion.
    await waitForStreamSettled(page)

    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"][data-mode="wizard"]')
    await expect(topBar.getByText('Registrar pedido', { exact: true })).toBeVisible()
    await expect(
      topBar.getByLabel(new RegExp(`^Município em atualização: ${municipality.name}`, 'i')),
    ).toBeVisible()

    // No big step title, no title input, no municipality selector: the single
    // free-text field comes straight after Tipo and Atividade.
    await expect(page.getByRole('heading', { name: 'Registrar pedido' })).toHaveCount(0)
    await expect(page.getByLabel(CAMPAIGN_DEMAND_KIND_LABEL)).toBeVisible()
    // `.first()`: legacy guard from cd469857/D12 — before the S: settle gate,
    // the streamed copy duplicated the whole shell, trigger included. The kind/
    // body/fill/submit locators below stay UNscoped on purpose: a genuinely
    // duplicated form in prod must still fail here (#659).
    await expect(page.getByLabel(CAMPAIGN_DEMAND_ACTIVITY_LABEL).first()).toBeVisible()
    await expect(page.getByLabel(CAMPAIGN_DEMAND_BODY_LABEL)).toBeVisible()
    await expect(page.locator('input[name="title"]')).toHaveCount(0)
    await expect(page.locator('select[name="municipalityId"]')).toHaveCount(0)

    await page.getByLabel(CAMPAIGN_DEMAND_BODY_LABEL).fill(description)
    await page.getByRole('button', { name: 'Abrir demanda' }).click()

    await page.waitForURL(/\/campanha\/?$/)

    // The demand born from the wizard carries the derived title in the demands
    // list: without a DEEPSEEK_API_KEY in the e2e app that is the truncated
    // free text — asserted via the contract, not the fixture's length.
    await page.goto('/campanha/demandas')
    await expect(page.getByRole('link', { name: fallbackDemandTitle(description) })).toBeVisible()
  })

  test('goes back to the municipality search of its own flow', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-pedido?municipio=${municipality.slug}`)

    await expect(page.getByLabel(CAMPAIGN_DEMAND_BODY_LABEL)).toBeVisible()
    await page.getByRole('link', { name: /Voltar/ }).click()

    await page.waitForURL(/\/campanha\/acoes\/registrar-pedido\/?$/)
    await expect(page.getByLabel('Buscar município')).toBeVisible()
  })

  test('keeps the final step away from leaders', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Líder da comunidade'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, leader.email!, leader.password)
    // The leader lockdown redirects to the contacts home; the redirect aborts
    // `goto`'s load event (ERR_ABORTED), so the redirect itself is asserted
    // the same way the municipality pages do (B43).
    await page
      .goto(`${campaign.baseURL}/campanha/acoes/registrar-pedido?municipio=${municipality.slug}`)
      .catch(() => {})
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/meus-contatos`)
    await expect(page.getByLabel(CAMPAIGN_DEMAND_BODY_LABEL)).toHaveCount(0)
  })
})
