import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B187 — links in the Sollinha's markdown answers must look like links: brand
 * primary color + always-visible underline, hover thickens the underline,
 * keyboard focus shows a ring, and external http(s) URLs open in a new tab.
 * The AI endpoint is mocked with a fixed SSE stream whose text carries one
 * internal (`/campanha/...`) and one external link — the internal one is
 * deliberately LAST so a backward Tab from the input lands on it deterministically.
 */

const ASSISTANT_LINKS =
  'Confira [o portal da saúde](https://www.saude.ba.gov.br/) e [o município de Ilhéus](/campanha/municipios/ilheus).'

const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      // SDK v7 UI-message-stream wire format (start / text-start / text-delta /
      // text-end / finish) — a bare legacy `{"type":"text"}` chunk fails the
      // client schema and the chat would never settle.
      body: [
        'data: {"type":"start"}\n\n',
        'data: {"type":"text-start","id":"t1"}\n\n',
        `data: {"type":"text-delta","id":"t1","delta":${JSON.stringify(ASSISTANT_LINKS)}}\n\n`,
        'data: {"type":"text-end","id":"t1"}\n\n',
        'data: {"type":"finish","finishReason":"stop"}\n\n',
      ].join(''),
    })
  })

const openChatAndSend = async (page: Page) => {
  await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
  const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })
  // Dev-mode defense: a first-hit route compile can trigger a full-page reload
  // that wipes the just-typed draft mid-test (production/CI never does), so
  // re-send until the answer actually lands.
  await expect(async () => {
    await input.fill('Mostre um link')
    await input.press('Enter')
    await expect(page.getByRole('link', { name: 'o município de Ilhéus' })).toBeVisible({
      timeout: 10_000,
    })
  }).toPass({ timeout: 60_000 })
}

test.describe('B187 — links com aparência de link nas respostas do Sollinha', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('links internos e externos ficam visíveis como link e têm hover e foco', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Links Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await openChatAndSend(page)

    const internalLink = page.getByRole('link', { name: 'o município de Ilhéus' })
    const externalLink = page.getByRole('link', { name: 'o portal da saúde' })

    // The link is styled like a link: brand primary + always-visible underline.
    await expect(internalLink).toHaveCSS('color', 'rgb(197, 20, 20)')
    await expect(internalLink).toHaveCSS('text-decoration-line', 'underline')

    // Hover reinforces the underline (thicker, decoration-2).
    await internalLink.hover()
    await expect(internalLink).toHaveCSS('text-decoration-thickness', '2px')

    // Keyboard focus is visible: Shift+Tab from the input lands on the last
    // link in the conversation and paints the focus ring (box-shadow).
    await page.keyboard.press('Shift+Tab')
    await expect(internalLink).toBeFocused()
    await expect(internalLink).toHaveCSS('box-shadow', /2px/)

    // External links open in a new tab with noopener; internal ones stay
    // plain same-tab anchors (their click behavior is B188's concern).
    await expect(externalLink).toHaveAttribute('target', '_blank')
    await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(internalLink).not.toHaveAttribute('target', '_blank')
  })
})
