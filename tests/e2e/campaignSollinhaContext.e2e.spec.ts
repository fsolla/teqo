import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

const SESSION_KEY = 'teqo:campaign:sollinha-chat-session'

/**
 * Mock the AI endpoint with a minimal SSE stream so sending a message neither
 * needs a DeepSeek API key nor hits the real rate limiter. The chunks follow
 * the SDK v7 UI-message-stream wire format (start / text-start / text-delta /
 * text-end / finish) — a bare legacy `{"type":"text"}` chunk fails the client
 * schema and the chat would never settle. The reply carries a markdown link so
 * the "navigate without reload" path has a real anchor.
 */
const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"type":"start"}\n\n',
        'data: {"type":"text-start","id":"t1"}\n\n',
        'data: {"type":"text-delta","id":"t1","delta":"Resposta mockada com [Municípios](/campanha/municipios)."}\n\n',
        'data: {"type":"text-end","id":"t1"}\n\n',
        'data: {"type":"finish","finishReason":"stop"}\n\n',
      ].join(''),
    })
  })

const MESSAGE = 'Mensagem que sobrevive ao reload'

const openChatAndSend = async (page: Page) => {
  await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
  const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })
  await input.fill(MESSAGE)
  await input.press('Enter')
  await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
}

/** The chat has settled once the mic button re-enables (busy → ready). */
const waitForChatSettled = async (page: Page) => {
  await expect(
    page.getByRole('button', { name: 'Falar pergunta (voz)' }).filter({ visible: true }),
  ).toBeEnabled({ timeout: 20_000 })
}

/** Raw stored session, or null when nothing (valid) is in the tab's storage. */
const storedSession = (page: Page) =>
  page.evaluate((key) => {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as { messages?: unknown[]; open?: boolean }
  }, SESSION_KEY)

test.describe('B188 — contexto da conversa persiste na sessão da janela/tab', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
  })

  test('reload na mesma aba restaura a conversa', async ({ page, campaign }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Contexto Janela Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/campanha')

    await openChatAndSend(page)
    await waitForChatSettled(page)
    // Deterministic gate: the persist effect must have landed before reload.
    await expect.poll(async () => (await storedSession(page))?.messages?.length).toBeGreaterThan(0)

    await page.reload()

    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Olá! Eu sou o Sollinha')).not.toBeVisible()
  })

  test('link da resposta navega sem recarregar a página', async ({ page, campaign }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Contexto Janela Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/campanha')

    await openChatAndSend(page)
    await waitForChatSettled(page)

    // A full browser navigation fires `load`; client-side routing does not.
    let loadEvents = 0
    page.on('load', () => {
      loadEvents += 1
    })

    await page.locator('#ai-chat-panel').getByRole('link', { name: 'Municípios' }).click()
    await expect(page).toHaveURL(/\/campanha\/municipios/)

    expect(loadEvents).toBe(0)
    // The conversation is still mounted with the layout — nothing reloaded.
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
  })

  test('drawer mobile aberto volta aberto após reload', async ({ page, campaign }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Contexto Janela Coordenador'),
    })
    // Mobile from the start: a desktop login would auto-open the chat (B167
    // settle), persist `open: true` and make the drawer open "by itself" here.
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Sollinha — Assistente virtual' }).click()
    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })
    // The open flag must have been persisted before reload.
    await expect.poll(async () => (await storedSession(page))?.open).toBe(true)

    await page.reload()

    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('visita mobile nova permanece fechada após reload (sem chat saltando)', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Contexto Janela Coordenador'),
    })
    // Mobile from the start (see the sibling test): the desktop settle must
    // never have run in this tab, so no `open: true` is ever persisted.
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)

    await page.reload()

    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('settle do desktop não vaza chat aberto para a visita mobile da mesma aba (OPS22)', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Contexto Janela Coordenador'),
    })
    // Desktop login: the B167 settle opens the chat and the persist effect
    // writes `open: true` (settle-originated) for the tab.
    await campaign.login(page, user.email!, user.password)
    await expect.poll(async () => (await storedSession(page))?.open).toBe(true)

    // A mobile page in the SAME tab must not restore that settle-originated
    // open: the drawer would cover the content and aria-hide it (the OPS22
    // regression that turned the agenda-mobile e2e red). The chat stays
    // reachable through its button.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/campanha/agenda')

    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sollinha — Assistente virtual' })).toBeVisible({
      timeout: 20_000,
    })
  })
})
