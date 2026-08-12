import type { Page } from '@playwright/test'

import { expect, test, waitForRouterSettled } from './fixtures/campaignE2EFixtures.js'

/**
 * Mock the AI endpoint with a minimal SSE stream so sending a chip neither
 * needs a DeepSeek API key nor hits the real rate limiter — the user message is
 * still recorded client-side, which is all these assertions need.
 */
const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: 'data: {"type":"text","text":"Resposta mockada da Sollinha."}\n\n',
    })
  })

const STAFF_DESKTOP_CHIPS = [
  'Quem foi o deputado mais votado em Feira de Santana?',
  'Quantos votos tivemos em Ilhéus em 2022?',
  'Quais dobradinhas temos em Salvador?',
  'Como está o município de Vitória da Conquista?',
]

const STAFF_MOBILE_CHIPS = STAFF_DESKTOP_CHIPS.slice(0, 3)

const LEADER_CHIPS = [
  'O que você sabe fazer?',
  'Me manda o link dos meus contatos',
  'Me manda o link do meu perfil',
]

const chipButton = (page: Page, text: string) =>
  page.getByRole('button', { name: text, exact: true })

/**
 * The opening chips exist in the SSR HTML, so a click that lands BEFORE
 * hydration is a silent no-op (the SSR button has no handler) — the B13/B17
 * flake class. Retry until the send actually lands: a sent message empties the
 * slot (`messages.length > 0` unmounts the chips), which is the one
 * unambiguous observable.
 */
const pickChip = async (page: Page, text: string) => {
  await expect(async () => {
    await chipButton(page, text).click({ timeout: 1_000 })
    await expect(chipButton(page, text)).toHaveCount(0, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

test.describe('B191 — ações rápidas de abertura no chat Sollinha (chips de pergunta)', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
  })

  test('staff no desktop vê 4 chips; tocar envia a pergunta e os chips somem', async ({
    page,
    campaign,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chips Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
    for (const text of STAFF_DESKTOP_CHIPS) {
      await expect(chipButton(page, text)).toBeVisible()
    }

    const firstChip = STAFF_DESKTOP_CHIPS[0]!
    await pickChip(page, firstChip)
    // The sent message is now in the conversation.
    await expect(page.getByText(firstChip)).toBeVisible({ timeout: 20_000 })
    for (const text of STAFF_DESKTOP_CHIPS) {
      await expect(chipButton(page, text)).toHaveCount(0)
    }
  })

  test('staff no drawer mobile vê 3 chips e eles somem após o envio', async ({
    page,
    campaign,
  }) => {
    await page.setViewportSize({ width: 500, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('advisor', {
      name: campaign.fixtures.value('Chips Assessor'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    const drawer = page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })
    // OPS42 — dev-only settle before the click (see `waitForRouterSettled`).
    await waitForRouterSettled(page)
    await page.getByRole('button', { name: 'Sollinha — Assistente virtual' }).click()
    await expect(drawer).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })

    for (const text of STAFF_MOBILE_CHIPS) {
      await expect(chipButton(page, text)).toBeVisible()
    }
    await expect(chipButton(page, STAFF_DESKTOP_CHIPS[3]!)).toHaveCount(0)

    await pickChip(page, STAFF_MOBILE_CHIPS[0]!)
    await expect(page.getByText(STAFF_MOBILE_CHIPS[0]!)).toBeVisible({ timeout: 20_000 })
    for (const text of STAFF_MOBILE_CHIPS) {
      await expect(chipButton(page, text)).toHaveCount(0)
    }
  })

  test('leader vê o conjunto seguro — nunca uma pergunta eleitoral', async ({ page, campaign }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('leader', {
      name: campaign.fixtures.value('Chips Liderança'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
    for (const text of LEADER_CHIPS) {
      await expect(chipButton(page, text)).toBeVisible()
    }
    for (const text of STAFF_DESKTOP_CHIPS) {
      await expect(chipButton(page, text)).toHaveCount(0)
    }
  })
})
