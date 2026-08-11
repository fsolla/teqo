import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

const SESSION_KEY = 'teqo:campaign:sollinha-chat-session'

const DEFAULT_REPLY = 'Resposta mockada com [Municípios](/campanha/municipios).'
const EXTERNAL_REPLY = 'Resposta mockada com [portal da saúde](https://www.saude.ba.gov.br/).'

/**
 * The SSE body the mocks reply with. Chunks follow the SDK v7 UI-message-stream
 * wire format (start / text-start / text-delta / text-end / finish) — a bare
 * legacy `{"type":"text"}` chunk fails the client schema and the chat would
 * never settle.
 */
const streamBody = (reply: string) =>
  [
    'data: {"type":"start"}\n\n',
    'data: {"type":"text-start","id":"t1"}\n\n',
    `data: {"type":"text-delta","id":"t1","delta":${JSON.stringify(reply)}}\n\n`,
    'data: {"type":"text-end","id":"t1"}\n\n',
    'data: {"type":"finish","finishReason":"stop"}\n\n',
  ].join('')

/**
 * Mock the AI endpoint with a minimal SSE stream so sending a message neither
 * needs a DeepSeek API key nor hits the real rate limiter. The reply carries a
 * markdown link so the "navigate without reload" path has a real anchor.
 */
const mockAiChat = (page: Page, reply: string = DEFAULT_REPLY) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: streamBody(reply),
    })
  })

/**
 * Mock whose FIRST request replies immediately and every later request hangs
 * until the test calls `release()` — a deterministic window in which the chat
 * is still busy (`status !== 'ready'`) with a reply blocked, with no stream
 * timing to race against.
 */
const gatedMockAiChat = (page: Page) => {
  let resolveGate: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve
  })
  let requests = 0
  void page.route('**/campanha/api/ai-chat', async (route) => {
    const index = requests
    requests += 1
    if (index >= 1) await gate
    try {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: streamBody(DEFAULT_REPLY),
      })
    } catch {
      // An early failure may end the test before `release()` — fulfilling on a
      // closed page rejects, and the test's own error is the signal to read.
    }
  })
  return {
    release: () => {
      resolveGate?.()
    },
    requests: () => requests,
  }
}

const MESSAGE = 'Mensagem que sobrevive ao reload'
const SECOND_MESSAGE = 'Segunda pergunta'

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

/** Opens the mobile drawer and waits for it to cover the page. */
const openMobileDrawer = async (page: Page) => {
  const drawer = page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })
  await page.getByRole('button', { name: 'Sollinha — Assistente virtual' }).click()
  await expect(drawer).toBeVisible({ timeout: 20_000 })
  return drawer
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

test.describe('B198 — link de resposta fecha o drawer mobile ao navegar no mesmo tab', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
  })

  test('link interno: drawer fecha no toque e a navegação segue no mesmo tab', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Drawer Link Interno'),
    })
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    const drawer = await openMobileDrawer(page)

    await openChatAndSend(page)
    await waitForChatSettled(page)

    // A full browser navigation fires `load`; client-side routing does not.
    let loadEvents = 0
    page.on('load', () => {
      loadEvents += 1
    })

    await drawer.getByRole('link', { name: 'Municípios' }).click()
    await expect(page).toHaveURL(/\/campanha\/municipios/)
    await expect(drawer).toHaveCount(0)
    expect(loadEvents).toBe(0)

    // The navigation-originated close persists `open: false` — a reload never
    // reopens the drawer on its own.
    await page.reload()
    await expect(drawer).toHaveCount(0)
  })

  test('link externo: abre em nova aba e o drawer permanece aberto', async ({ page, campaign }) => {
    // Last-registered route wins (LIFO) — overrides the beforeEach mock.
    await mockAiChat(page, EXTERNAL_REPLY)
    // The popup would hit the real site; fulfill it so CI stays deterministic.
    await page
      .context()
      .route('**://saude.ba.gov.br/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>' }),
      )

    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Drawer Link Externo'),
    })
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    const drawer = await openMobileDrawer(page)

    await openChatAndSend(page)
    await waitForChatSettled(page)

    const popupPromise = page.waitForEvent('popup')
    await drawer.getByRole('link', { name: 'portal da saúde' }).click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    await popup.close()

    // The origin tab keeps the conversation reachable — the drawer stays.
    await expect(drawer).toBeVisible()
  })
})

test.describe('B199 — fechar o drawer durante streaming persiste fechado no reload', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
  })

  test('fechar mid-stream grava open:false e o reload não reabre o drawer', async ({
    page,
    campaign,
  }) => {
    // Last-registered route wins (LIFO) — overrides the beforeEach mock. The
    // first exchange replies immediately; the second stays blocked until
    // `release()`, so the close provably lands while the chat is busy.
    const gated = gatedMockAiChat(page)

    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Fechar Mid-Stream'),
    })
    await page.setViewportSize({ width: 500, height: 800 })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    const drawer = await openMobileDrawer(page)

    await openChatAndSend(page)
    await waitForChatSettled(page)
    // The stale `open: true` the bug would leave orphaned in the storage.
    await expect.poll(async () => (await storedSession(page))?.open).toBe(true)

    // Second exchange — the gated reply keeps the chat busy (status !== 'ready').
    const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })
    await input.fill(SECOND_MESSAGE)
    await input.press('Enter')
    await expect(page.getByText(SECOND_MESSAGE)).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('button', { name: 'Falar pergunta (voz)' }).filter({ visible: true }),
    ).toBeDisabled({ timeout: 20_000 })

    // Close while the reply is still blocked: the persist must not wait for
    // the settle, or a reload would restore the stale `open: true`.
    await drawer.getByRole('button', { name: 'Fechar' }).click()
    await expect(drawer).toHaveCount(0)
    await expect.poll(async () => (await storedSession(page))?.open).toBe(false)

    // Let the reply land: the settle still persists the whole conversation.
    gated.release()
    await expect.poll(async () => (await storedSession(page))?.messages?.length).toBe(4)
    // Both exchanges went through the gated route — the LIFO override worked.
    expect(gated.requests()).toBe(2)

    // Reload: no ghost drawer, conversation restored.
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toHaveCount(0)
    // The FAB is SSR'd; a click that lands before hydration is a silent no-op
    // (B13/B17 class) — retry until the drawer actually opens.
    const fab = page.getByRole('button', { name: 'Sollinha — Assistente virtual' })
    await expect(async () => {
      await fab.click({ timeout: 1_000 })
      await expect(page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })).toBeVisible(
        { timeout: 1_000 },
      )
    }).toPass({ timeout: 15_000 })
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(SECOND_MESSAGE)).toBeVisible()
  })
})
