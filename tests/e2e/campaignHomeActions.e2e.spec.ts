import type { Page } from '@playwright/test'

import { WIZARD_MUNICIPALITY_STEP_TITLE } from '../../src/lib/campaignWizardCopy.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'
import {
  assertThreeColumnActionGrid,
  collectActionBoundingBoxes,
} from './helpers/actionGridGeometry.js'

const staffActionLabels = [
  'Ajustar votos',
  'Registrar atualização',
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

  test('staff focused search without curated suggestions shows the honest empty state (OPS29)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    // Advisor with no administered municipality: the suggest scope is the
    // portfolio (empty), so the empty state is deterministic even if a
    // parallel worker pins an `alta` municipality elsewhere (B126 sibling).
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessora OPS29'),
    })

    await campaign.login(page, advisor.email!, advisor.password)
    // Início renders the suggest payload server-side (initialSuggest), so this
    // also covers the SSR path — no POST needed for the empty state (OPS29).
    const search = page.getByLabel('Buscar na campanha')
    await search.focus()

    const results = page.getByRole('region', { name: 'Resultados da busca' })
    await expect(results).toContainText('Nenhuma sugestão ainda', { timeout: 10000 })
    await expect(results.getByRole('region', { name: 'Sugestões' })).toHaveCount(0)
  })
})

test.describe('Início — catálogo de ações (B45)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('staff sees six home actions and can open municipalities without coverage', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    const actionsRegion = page.getByLabel('Ações rápidas')
    await expect(actionsRegion).toBeVisible()

    for (const label of staffActionLabels) {
      const link = page.getByRole('link', { name: label, exact: true })
      const button = page.getByRole('button', { name: label, exact: true })
      await expect(link.or(button)).toBeVisible()
    }

    const overflowX = await actionsRegion.evaluate((el) => getComputedStyle(el).overflowX)
    expect(overflowX).not.toBe('auto')
    expect(overflowX).not.toBe('scroll')

    const actionList = actionsRegion.locator('ul[data-layout="grid-3"]')
    await expect(actionList).toBeVisible()
    const boxes = await collectActionBoundingBoxes(actionsRegion, staffActionLabels)
    assertThreeColumnActionGrid(boxes, 2)

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
    const hit = results.locator(
      `a[href="/campanha/acoes/atualizar-votos?municipio=${municipality.slug}"]`,
    )
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

    await page.waitForURL(/^https?:\/\/[^/]+\/campanha\/?$/)
    await expect(page.getByText('Votos estimados atualizados.')).toBeVisible({ timeout: 15000 })
    expect(page.url()).not.toContain('cenario=')
  })

  test('saving votes returns to the allowlisted origin (B110 backdrop)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `/campanha/acoes/atualizar-votos?municipio=${municipality.slug}&from=${encodeURIComponent(`/campanha/municipios/${municipality.slug}`)}`,
    )

    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible({
      timeout: 15000,
    })

    const step = wizardVoteStep(page)
    await step.getByRole('textbox', { name: 'Média' }).fill('210')
    await page.getByRole('button', { name: 'Salvar estimativas →' }).click()

    await page.waitForURL(new RegExp(`/campanha/municipios/${municipality.slug}\\/?$`))
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
  test('create leadership, save, and return to origin (B168)', async ({ campaign, page }) => {
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
    await expect(page.getByRole('button', { name: 'Concluir' })).toBeVisible()

    await page.getByRole('button', { name: 'Concluir' }).click()
    await page.waitForURL(/^https?:\/\/[^/]+\/campanha\/?$/)
    await expect(page.getByRole('link', { name: /Voltar/ })).toHaveCount(0)
  })
})

test.describe('Wizard — registrar atualização (C87)', () => {
  test('standalone flow: unified form, save returns to origin (B168)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-atualizacao?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Registrar atualização' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Pular' })).toHaveCount(0)

    await page
      .getByLabel('Texto da atualização')
      .fill('Adversário marcou presença no centro do município.')
    await page.getByLabel('Polaridade').selectOption('ruim')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.waitForURL(/^https?:\/\/[^/]+\/campanha\/?$/)
    await expect(page.getByText('Atualização registrada com sucesso.')).toBeVisible()
  })

  test('renders the unified fields without legacy signal-type navigation', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/registrar-atualizacao?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: 'Registrar atualização' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page).not.toHaveURL(/signalType=/)
    await expect(page.getByLabel('Texto da atualização')).toBeVisible()
    await expect(page.getByLabel('Polaridade')).toBeVisible()
    await expect(page.getByLabel('Sinalizar como urgente')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Que tipo de sinal?' })).toHaveCount(0)
  })

  test('stale entry param is ignored — never a skip link (B168)', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `/campanha/acoes/registrar-atualizacao?municipio=${municipality.slug}&entry=update-votes`,
    )

    await expect(page.getByRole('heading', { name: 'Registrar atualização' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Pular' })).toHaveCount(0)
  })
})

test.describe('Wizard — mudar tendência (B97 / B168)', () => {
  test('changing trend and saving returns to origin instead of advancing', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/acoes/mudar-tendencia?municipio=${municipality.slug}`)

    await expect(page.getByRole('heading', { name: /Tendência/ })).toBeVisible({
      timeout: 15000,
    })

    await page.locator('main a[href*="trendStatus"]').first().click()
    await expect(page.getByRole('heading', { name: /^Mudar tendência para / })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Pular' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.waitForURL(/^https?:\/\/[^/]+\/campanha\/?$/)
    await expect(page.getByText('Tendência política registrada.')).toBeVisible()
  })
})
