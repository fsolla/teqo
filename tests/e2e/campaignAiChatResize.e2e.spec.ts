import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * Mock the AI endpoint with a minimal SSE stream so sending a message neither
 * needs a DeepSeek API key nor hits the real rate limiter — the user message is
 * still recorded client-side, which is all these assertions need. The chunks
 * follow the SDK v7 UI-message-stream wire format (start / text-start /
 * text-delta / text-end / finish): a bare legacy `{"type":"text"}` chunk fails
 * the client schema and leaves the chat stuck in an error status.
 */
const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"type":"start"}\n\n',
        'data: {"type":"text-start","id":"t1"}\n\n',
        'data: {"type":"text-delta","id":"t1","delta":"Resposta mockada da Sollinha."}\n\n',
        'data: {"type":"text-end","id":"t1"}\n\n',
        'data: {"type":"finish","finishReason":"stop"}\n\n',
      ].join(''),
    })
  })

const MESSAGE = 'Mensagem que migra entre as superficies'

const openChatAndSend = async (page: Page) => {
  await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
  const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })
  await input.fill(MESSAGE)
  await input.press('Enter')
  await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
}

/**
 * Widths of the resizable panels in order: [main, chat]. Indexed defensively —
 * under a cold dev compile only one panel may exist transiently; callers poll
 * with `expect.poll` so a missing panel just means "keep waiting".
 */
const chatPanelWidth = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-panel]')].map((panel) =>
      Math.round(panel.getBoundingClientRect().width),
    ),
  )

const chatPanelWidthAt = (page: Page, index: number) =>
  chatPanelWidth(page).then((widths) => widths[index] ?? 0)

test.describe('B167 — chat Sollinha migra entre painel e drawer ao redimensionar', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('desktop aberto -> mobile: drawer abre com a conversa e sem coluna fantasma', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await openChatAndSend(page)

    await page.setViewportSize({ width: 500, height: 800 })

    const drawer = page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })
    await expect(drawer).toBeVisible({ timeout: 20_000 })
    await expect(drawer.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
    // The drawer must STAY open past RRP's own re-layout on the crossing.
    await expect(drawer).toBeVisible({ timeout: 20_000 })

    // The chat Panel is hidden on mobile: no ghost column stealing space.
    await expect
      .poll(() => chatPanelWidthAt(page, 0))
      .toBeGreaterThanOrEqual(Math.round(500 * 0.95))
  })

  test('mobile aberto -> desktop: painel abre com a conversa, sem reload', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await openChatAndSend(page)

    await page.setViewportSize({ width: 500, height: 800 })
    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
    // The welcome state must be gone — the conversation followed, not a fresh chat.
    await expect(page.getByText('Olá! Eu sou o Sollinha')).not.toBeVisible()
    // The panel is visibly expanded, not a 0-width sliver.
    await expect.poll(() => chatPanelWidthAt(page, 1)).toBeGreaterThan(200)
  })

  test('chat fechado permanece fechado ao cruzar a borda nas duas direções', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    // Desktop opens the chat at load (as before); close it so it is "fechado".
    await page
      .getByRole('button', { name: 'Fechar', exact: true })
      .filter({ visible: true })
      .click()
    // Closing hides the desktop panel's footprint.
    await expect.poll(() => chatPanelWidthAt(page, 1)).toBeLessThan(2)

    await page.setViewportSize({ width: 500, height: 800 })
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Still closed on desktop: no conversation surface, panel still hidden.
    await expect.poll(() => chatPanelWidthAt(page, 1)).toBeLessThan(2)
  })

  test('visita mobile nova começa com o chat fechado (FAB é o convite)', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    // Mobile from the start (B188): a desktop login auto-opens the chat (the
    // settle below); OPS22 makes that settle-originated `open: true` never
    // restore on a mobile page of the same tab, and here the login itself
    // happens at mobile width — so no drawer, only the FAB.
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)

    // Carga direto em mobile: sem drawer espontâneo, só o FAB.
    await page.goto('/campanha')
    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })

    // Crescer para desktop continua fechado (o painel não “renasce”).
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => chatPanelWidthAt(page, 1)).toBeLessThan(2)
  })

  test('conversa sobrevive à navegação interna de /campanha', async ({ page, campaign }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await openChatAndSend(page)

    await page.getByRole('link', { name: 'Municípios' }).click()
    await expect(page).toHaveURL(/\/campanha\/municipios/)

    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Olá! Eu sou o Sollinha')).not.toBeVisible()
  })

  test('nova aba recomeça a conversa vazia', async ({ page, context, campaign }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Chat Resize Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await openChatAndSend(page)

    const secondTab = await context.newPage()
    await secondTab.setViewportSize({ width: 1280, height: 800 })
    await secondTab.goto('/campanha')

    await expect(secondTab.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
    await expect(secondTab.getByText(MESSAGE)).toHaveCount(0)
    await secondTab.close()
  })
})
