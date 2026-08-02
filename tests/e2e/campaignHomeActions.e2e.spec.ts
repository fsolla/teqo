import type { Page } from '@playwright/test'

import { WIZARD_MUNICIPALITY_STEP_TITLE } from '../../src/lib/campaignWizardCopy.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'

const staffActionLabels = [
  'Ajustar votos',
  'Registrar sinal',
  'Mudar tendência',
  'Atualizar liderança',
  'Registrar pedido',
  'Ver esquecidos',
] as const

test.describe('Início — busca global (B47)', () => {
  test('staff sees campaign search on home', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await expect(page.getByLabel('Buscar na campanha')).toBeVisible()
  })

  test('leader does not see campaign search on home', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança'),
    })

    await campaign.login(page, leader.email!, leader.password)
    await expect(page.getByLabel('Buscar na campanha')).toHaveCount(0)
  })

  test('staff focused search hides action strip on input focus (B66)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    const actionsChrome = page.locator('[data-slot="home-actions-chrome"]')
    await expect(page.getByLabel('Ações rápidas')).toBeVisible()

    await page.getByLabel('Buscar na campanha').focus()
    await expect(actionsChrome).toHaveAttribute('data-retracted', 'true', { timeout: 5000 })

    await page.getByLabel('Buscar na campanha').blur()
    await expect(actionsChrome).not.toHaveAttribute('data-retracted', 'true', { timeout: 5000 })
  })

  test('staff typing in search keeps action strip hidden after debounce', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    const actionsChrome = page.locator('[data-slot="home-actions-chrome"]')
    await expect(page.getByLabel('Ações rápidas')).toBeVisible()

    await page.getByLabel('Buscar na campanha').fill('ca')
    await expect(actionsChrome).toHaveAttribute('data-retracted', 'true', { timeout: 5000 })

    await page.getByLabel('Buscar na campanha').fill('')
    await page.getByLabel('Buscar na campanha').blur()
    await expect(actionsChrome).not.toHaveAttribute('data-retracted', 'true', { timeout: 5000 })
  })

  test('staff search shows municipality hits and opens detail (B48)', async ({
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
    const search = page.getByLabel('Buscar na campanha')
    await search.fill(municipality.name)

    const group = page.getByRole('region', { name: 'Resultados da busca' })
    await expect(group.getByRole('heading', { name: 'Municípios' })).toBeVisible({
      timeout: 15000,
    })
    // Disambiguate by href, not by name: catalog names are not prefix-unique
    // ("Conde" also matches "Condeúba" — the unanchored-regex lesson).
    await group.locator(`a[href$="/campanha/municipios/${municipality.slug}"]`).click()
    await page.waitForURL(new RegExp(`^https?://[^/]+/campanha/municipios/${municipality.slug}$`))
  })
})

test.describe('Início — catálogo de ações (B45)', () => {
  test('staff sees six home actions and can open municipalities without coverage', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await expect(page.getByLabel('Ações rápidas')).toBeVisible()

    for (const label of staffActionLabels) {
      const link = page.getByRole('link', { name: label, exact: true })
      const button = page.getByRole('button', { name: label, exact: true })
      await expect(link.or(button)).toBeVisible()
    }

    await page.getByRole('link', { name: 'Ajustar votos', exact: true }).click()
    await page.waitForURL(/\/campanha\/acoes\/atualizar-votos/)
    await expect(page.getByLabel('Buscar município')).toBeVisible()
    await expect(page.getByRole('region', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toBeVisible()

    await page.goto('/campanha')
    await page.getByRole('link', { name: 'Ver esquecidos', exact: true }).click()
    await page.waitForURL(/\/campanha\/municipios/)
    const url = new URL(page.url())
    expect(url.searchParams.get('coverage')).toBe('sem_assessor')
    expect(url.searchParams.get('sort')).toBe('votos')
  })

  test('leader sees two home actions and can open contacts', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança'),
    })

    await campaign.login(page, leader.email!, leader.password)
    await expect(page.getByLabel('Ações rápidas')).toBeVisible()

    await expect(
      page.getByRole('button', { name: 'Cadastrar apoiador', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver meus contatos', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Ver meus contatos', exact: true }).click()
    await page.waitForURL(/\/campanha\/contatos/)
    await expect(page.getByRole('heading', { name: /Meus contatos/ })).toBeVisible()
  })
})

test.describe('Wizard — busca município (B60)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('selecting a municipality advances with ?municipio= and sticky caption', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos')
    await expect(page.getByLabel('Buscar município')).toBeVisible()
    await expect(page.getByRole('region', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toBeVisible()

    const search = page.getByLabel('Buscar município')
    await search.fill(municipality.name)

    const results = page.getByRole('region', { name: WIZARD_MUNICIPALITY_STEP_TITLE })
    // Exact slug query — a substring href*= match also hits longer sibling slugs.
    const hit = results.locator(`a[href$="municipio=${municipality.slug}"]`)
    await expect(hit).toBeVisible({ timeout: 15000 })
    await hit.click()

    await page.waitForURL(
      new RegExp(
        `^https?://[^/]+/campanha/acoes/atualizar-votos\\?municipio=${municipality.slug}$`,
      ),
    )
    await expect(
      page.getByLabel(new RegExp(`^Município em atualização: ${municipality.name}`, 'i')),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible()
  })
})

test.describe('Wizard — ajuste de votos (B61 / B77)', () => {
  const wizardVoteStep = (page: Page) =>
    page.getByRole('main', { name: /Ajustar votos estimados/i })

  test('shows three scenario inputs and saves without cenario param', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/atualizar-votos?municipio=${municipality.slug}`)

    const step = wizardVoteStep(page)
    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible({
      timeout: 15000,
    })
    await expect(step.getByRole('textbox', { name: 'Pessimista' })).toBeVisible()
    await expect(step.getByRole('textbox', { name: 'Média' })).toBeVisible()
    await expect(step.getByRole('textbox', { name: 'Otimista' })).toBeVisible()

    await step.getByRole('textbox', { name: 'Pessimista' }).fill('150')
    await step.getByRole('textbox', { name: 'Média' }).fill('250')
    await step.getByRole('textbox', { name: 'Otimista' }).fill('350')
    await page.getByRole('button', { name: 'Salvar estimativas →' }).click()

    await page.waitForURL(
      new RegExp(
        `/campanha/acoes/mudar-tendencia\\?municipio=${municipality.slug}&entry=update-votes`,
      ),
    )
    await expect(page.getByText('Votos estimados atualizados.')).toBeVisible({ timeout: 15000 })
    expect(page.url()).not.toContain('cenario=')
  })

  test('incoherent estimates show inline warning without changing URL', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/atualizar-votos?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible({
      timeout: 15000,
    })

    const step = wizardVoteStep(page)
    await step.getByRole('textbox', { name: 'Pessimista' }).fill('900')
    await step.getByRole('textbox', { name: 'Média' }).fill('100')
    await page.getByRole('button', { name: 'Salvar estimativas →' }).click()

    await expect(step.getByRole('alert')).toContainText(/Pessimista/i)
    expect(page.url()).not.toContain('cenario=')
  })

  test('legacy cenario param redirects to canonical URL', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `/campanha/acoes/atualizar-votos?municipio=${municipality.slug}&cenario=pessimistic`,
    )

    await page.waitForURL(
      new RegExp(
        `^https?://[^/]+/campanha/acoes/atualizar-votos\\?municipio=${municipality.slug}$`,
      ),
    )
    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible({
      timeout: 15000,
    })
  })
})

test.describe('Wizard — atualizar liderança (B70)', () => {
  test('create leadership, save, and continue into the chain', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()
    const suffix = Date.now().toString().slice(-8).padStart(8, '0')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/atualizar-lideranca?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Quem coordena por aqui?' })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: 'Adicionar liderança' }).click()
    await expect(page.getByRole('heading', { name: 'Nova liderança' })).toBeVisible()

    await page.getByLabel('Nome').fill(`Liderança B70 ${suffix}`)
    await page.getByLabel('Celular').fill(`719${suffix}`)
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByRole('heading', { name: 'Quem coordena por aqui?' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible()

    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.waitForURL(
      new RegExp(
        `/campanha/acoes/registrar-sinal\\?municipio=${municipality.slug}&entry=update-leadership`,
      ),
    )
    await expect(page.getByRole('heading', { name: 'Que tipo de sinal?' })).toBeVisible()
  })
})

test.describe('Wizard — registrar sinal (B63)', () => {
  test('standalone flow: type grid, body step, save continues the chain', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-sinal?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Que tipo de sinal?' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Pular' })).toHaveCount(0)

    await page.getByRole('link', { name: /Invasão/i }).click()
    await page.waitForURL(/signalType=invasao/)

    await expect(page.getByRole('heading', { name: /Detalhar sinal: Invasão/i })).toBeVisible()

    const body = page.getByLabel('O que aconteceu?')
    await body.fill('Adversário marcou presença no centro do município.')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.waitForURL(
      new RegExp(
        `/campanha/acoes/mudar-tendencia\\?municipio=${municipality.slug}&entry=register-signal`,
      ),
    )
    await expect(page.getByText('Sinal registrado.')).toBeVisible()
  })

  test('info button opens drawer without advancing to body step', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-sinal?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Que tipo de sinal?' })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /Informações sobre Invasão/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/O adversário está ocupando espaço/i)).toBeVisible()
    await expect(page).not.toHaveURL(/signalType=/)

    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('embedded flow shows skip link to the next chain step', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `/campanha/acoes/registrar-sinal?municipio=${municipality.slug}&entry=update-votes`,
    )

    const skip = page.getByRole('link', { name: 'Pular' })
    await expect(skip).toBeVisible({ timeout: 15000 })
    await expect(skip).toHaveAttribute(
      'href',
      `/campanha/acoes/atualizar-lideranca?municipio=${municipality.slug}&entry=update-votes`,
    )
  })
})
