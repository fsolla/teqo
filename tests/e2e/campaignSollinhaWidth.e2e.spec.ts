import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

type ResponsiveCampaignFixture = {
  fixtures: {
    createCampaignUser: (
      role: 'advisor' | 'coordinator',
      input: { name: string },
    ) => Promise<{ email?: string | null; password: string }>
    value: (prefix: string) => string
  }
  login: (page: Page, identifier: string, password: string) => Promise<void>
}

const loginAs = async (page: Page, campaign: ResponsiveCampaignFixture) => {
  const user = await campaign.fixtures.createCampaignUser('coordinator', {
    name: campaign.fixtures.value('Sollinha Largura'),
  })
  await campaign.login(page, user.email!, user.password)
  await page.goto('/campanha/municipios')
  await page.waitForLoadState('networkidle')
}

const chatPanel = (page: Page) => page.locator('#ai-chat-panel')
const chatSeparator = (page: Page) => page.locator('#campaign-ai-shell [role="separator"]')

const panelWidth = (panel: Locator) => panel.evaluate((element) => element.clientWidth)

const dragSeparatorBy = async (page: Page, deltaX: number) => {
  const separator = chatSeparator(page)
  await expect(separator).toBeVisible()
  const box = (await separator.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
}

test.describe('B166 — largura padrão do chat Sollinha com teto no desktop', () => {
  test('opens capped at 360px, grows freely and remembers the resized width', async ({
    campaign,
    page,
  }) => {
    test.slow()

    // Wide desktop: 25% of the group exceeds 360px, so the cap must bite. The
    // sidebar is open by default on a fresh context.
    await page.setViewportSize({ width: 1920, height: 1080 })
    await loginAs(page, campaign)

    const panel = chatPanel(page)
    await expect(panel).toBeVisible()
    // The panel first paints at the raw 25% default and is capped one frame
    // later by the sizing effect — poll until the cap lands (also proves the
    // default open never exceeds 360px, acceptance 1).
    await expect.poll(() => panelWidth(panel)).toBeLessThanOrEqual(360)

    const defaultWidth = await panelWidth(panel)
    expect(defaultWidth).toBeGreaterThanOrEqual(280)

    // Drag the separator to the left: chat grows beyond the 360px cap — the
    // cap applies only to the default open, never to the user resize.
    await dragSeparatorBy(page, -220)
    await expect.poll(() => panelWidth(panel)).toBeGreaterThan(360)
    const resizedWidth = await panelWidth(panel)

    // The chosen size was saved locally: a page reload reopens at it, not at
    // the capped default. Poll against the dragged size (the raw 25% first
    // paint would already pass a bare ">360" gate, so wait for the restore).
    await page.reload()
    await expect(panel).toBeVisible()
    await expect
      .poll(async () => Math.abs((await panelWidth(panel)) - resizedWidth))
      .toBeLessThanOrEqual(4)
    const restoredWidth = await panelWidth(panel)

    // Reopening via the header button (acceptance 1 — "pelo botão") restores
    // the same remembered width instead of a fresh cap.
    await page
      .getByRole('button', { name: 'Fechar', exact: true })
      .filter({ visible: true })
      .click()
    await expect.poll(() => panelWidth(panel)).toBeLessThan(200)
    await page
      .getByRole('button', { name: 'Sollinha — Assistente virtual' })
      .filter({ visible: true })
      .click()
    await expect
      .poll(async () => Math.abs((await panelWidth(panel)) - restoredWidth))
      .toBeLessThanOrEqual(4)
  })
})
