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
    const actionsSlot = page.locator('[data-slot="home-actions"]')
    await expect(actionsSlot).toBeVisible()
    await expect(page.getByLabel('Ações rápidas')).toBeVisible()

    await page.getByLabel('Buscar na campanha').focus()
    await expect(actionsSlot).toBeHidden({ timeout: 5000 })

    await page.getByLabel('Buscar na campanha').blur()
    await expect(actionsSlot).toBeVisible({ timeout: 5000 })
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
    const actionsSlot = page.locator('[data-slot="home-actions"]')
    await expect(actionsSlot).toBeVisible()

    await page.getByLabel('Buscar na campanha').fill('ca')
    await expect(actionsSlot).toBeHidden({ timeout: 5000 })

    await page.getByLabel('Buscar na campanha').fill('')
    await expect(actionsSlot).toBeVisible({ timeout: 5000 })
  })

  test('staff search shows municipality hits and opens detail (B48)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    const search = page.getByLabel('Buscar na campanha')
    await search.fill('Cairu')

    const group = page.getByRole('region', { name: 'Resultados da busca' })
    await expect(group.getByRole('heading', { name: 'Municípios' })).toBeVisible({
      timeout: 15000,
    })
    await group.getByRole('link', { name: /Cairu/i }).click()
    await page.waitForURL(/\/campanha\/municipios\/cairu/)
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
    await expect(page.getByRole('heading', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toBeVisible()

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
  test('selecting a municipality advances with ?municipio= and sticky caption', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos')
    await expect(page.getByRole('heading', { name: WIZARD_MUNICIPALITY_STEP_TITLE })).toBeVisible()

    const search = page.getByLabel('Buscar município')
    await search.fill('Cairu')

    const results = page.getByRole('region', { name: 'Resultados da busca' })
    await expect(results.getByRole('button', { name: /Cairu/i })).toBeVisible({ timeout: 15000 })
    await results.getByRole('button', { name: /Cairu/i }).click()

    await page.waitForURL(/\/campanha\/acoes\/atualizar-votos\?municipio=cairu/)
    await expect(page.getByLabel(/Município em atualização: Cairu/i)).toBeVisible()
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

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos?municipio=cairu')

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

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos?municipio=cairu')

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

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-votos?municipio=cairu&cenario=pessimistic')

    await page.waitForURL(/\/campanha\/acoes\/atualizar-votos\?municipio=cairu$/)
    await expect(page.getByRole('heading', { name: 'Ajustar votos estimados' })).toBeVisible({
      timeout: 15000,
    })
  })
})

test.describe('Wizard — atualizar liderança (B70)', () => {
  test('create leadership, save, and continue to home', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const suffix = Date.now().toString().slice(-8).padStart(8, '0')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/atualizar-lideranca?municipio=cairu')

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
    await page.waitForURL('/campanha')
    await expect(page.getByLabel('Buscar na campanha')).toBeVisible()
  })
})

test.describe('Wizard — registrar sinal (B63)', () => {
  test('standalone flow: type grid, body step, save returns to Início', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/registrar-sinal?municipio=cairu')

    await expect(page.getByRole('heading', { name: 'Que tipo de sinal?' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: 'Pular registro de sinal' })).toHaveCount(0)

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Invasão' })
      .getByRole('button')
      .first()
      .click()
    await page.waitForURL(/signalType=invasao/)

    await expect(page.getByRole('heading', { name: /Detalhar sinal: Invasão/i })).toBeVisible()

    const body = page.getByLabel('O que aconteceu?')
    await body.fill('Adversário marcou presença no centro do município.')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.waitForURL(/\/campanha$/)
    await expect(page.getByText('Sinal registrado.')).toBeVisible()
  })

  test('info button opens drawer without advancing to body step', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/registrar-sinal?municipio=cairu')

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

  test('embedded flow shows skip link', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/acoes/registrar-sinal?municipio=cairu&entryAction=update-votes')

    await expect(page.getByRole('link', { name: 'Pular registro de sinal' })).toBeVisible({
      timeout: 15000,
    })
  })
})
