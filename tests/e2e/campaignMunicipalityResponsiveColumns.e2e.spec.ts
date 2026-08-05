import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

const WEBKIT_PROJECT = 'municipality-responsive-webkit'
const REM_IN_PIXELS = 16
const municipalityColumnsCookie = encodeURIComponent('municipios:__none__')

const municipalityContainer = (page: Page) => page.locator('[data-container="municipality-list"]')

const setContainerWidth = async (container: Locator, width: number) => {
  await container.evaluate((element, nextWidth) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.width = `${nextWidth}px`
    htmlElement.style.maxWidth = `${nextWidth}px`
  }, width)
  await expect.poll(() => container.evaluate((element) => element.clientWidth)).toBe(width)
}

const visibleTriggerText = (trigger: Locator) =>
  trigger.evaluate((element) => (element as HTMLElement).innerText.trim())

const visibleHeaders = (container: Locator) =>
  container
    .locator('thead th')
    .evaluateAll((headers) =>
      headers
        .filter((header) => getComputedStyle(header).display !== 'none')
        .map((header) => (header.textContent ?? '').replaceAll(/\s+/g, ' ').trim()),
    )

const expectNoHorizontalOverflow = async (container: Locator) => {
  await expect
    .poll(() =>
      container.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    )
    .toMatchObject({ clientWidth: expect.any(Number) })
  const dimensions = await container.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

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

const loginWithAllColumns = async (
  page: Page,
  campaign: ResponsiveCampaignFixture,
  role: 'advisor' | 'coordinator' = 'coordinator',
) => {
  const user = await campaign.fixtures.createCampaignUser(role, {
    name: campaign.fixtures.value(`Responsivo ${role}`),
  })
  await campaign.login(page, user.email!, user.password)
  await page.context().addCookies([
    {
      name: 'campaign_columns',
      value: municipalityColumnsCookie,
      url: new URL(page.url()).origin,
    },
  ])
  await page.goto('/campanha/municipios')
  await expect(municipalityContainer(page)).toBeVisible()
  await page.waitForLoadState('networkidle')
}

const expectedHeadersAt = (width: number) => {
  if (width < 48 * REM_IN_PIXELS) return []

  const headers = ['Município', '2022', '2026', 'Nível', 'Classe']
  if (width >= 54 * REM_IN_PIXELS) headers.push('Assessores')
  headers.push('Tendência')
  if (width >= 66 * REM_IN_PIXELS) headers.push('Liderança')
  if (width >= 72 * REM_IN_PIXELS) headers.push('Dobradinha')
  if (width >= 78 * REM_IN_PIXELS) headers.push('Cobertura')
  headers.push('Sinal')
  return headers
}

test.describe('B158 — colunas responsivas por largura do conteúdo', () => {
  test('crosses every container threshold without horizontal scrolling', async ({
    campaign,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === WEBKIT_PROJECT, 'Covered by the focused iPad WebKit case.')
    test.slow()

    await loginWithAllColumns(page, campaign)
    const container = municipalityContainer(page)
    const cards = container.locator('[data-view="mobile-cards"]')
    const table = container.getByRole('table')
    const trendTrigger = table.getByRole('button', { name: /^Editar tendência política/ }).first()
    const signalTrigger = table.getByRole('button', { name: /^Registrar sinal em/ }).first()
    const widths = [
      48 * REM_IN_PIXELS - 1,
      48 * REM_IN_PIXELS + 1,
      54 * REM_IN_PIXELS - 1,
      54 * REM_IN_PIXELS + 1,
      60 * REM_IN_PIXELS - 1,
      60 * REM_IN_PIXELS + 1,
      66 * REM_IN_PIXELS - 1,
      66 * REM_IN_PIXELS + 1,
      72 * REM_IN_PIXELS - 1,
      72 * REM_IN_PIXELS + 1,
      78 * REM_IN_PIXELS - 1,
      78 * REM_IN_PIXELS + 1,
      84 * REM_IN_PIXELS - 1,
      84 * REM_IN_PIXELS + 1,
    ]

    for (const width of widths) {
      await test.step(`${width}px`, async () => {
        await setContainerWidth(container, width)

        if (width < 48 * REM_IN_PIXELS) {
          await expect(cards).toBeVisible()
          await expect(table).toBeHidden()
        } else {
          await expect(cards).toBeHidden()
          await expect(table).toBeVisible()
          expect(await visibleHeaders(container)).toEqual(expectedHeadersAt(width))
          expect(await visibleTriggerText(trendTrigger)).toBe(
            width >= 60 * REM_IN_PIXELS ? 'Não registrada' : '',
          )
          expect(await visibleTriggerText(signalTrigger)).toBe(
            width >= 84 * REM_IN_PIXELS ? 'Sem sinal' : '',
          )
        }

        await expectNoHorizontalOverflow(container)
      })
    }
  })

  test('sidebar and Sollinha change the column stage without changing the viewport', async ({
    campaign,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === WEBKIT_PROJECT, 'Desktop shell behavior is Chromium-only.')
    test.slow()

    await page.setViewportSize({ width: 1800, height: 900 })
    await loginWithAllColumns(page, campaign)
    const container = municipalityContainer(page)
    const viewportBefore = page.viewportSize()
    const widthWithSidebar = await container.evaluate((element) => element.clientWidth)
    const headersWithSidebar = await visibleHeaders(container)

    await page.getByRole('button', { name: 'Abrir ou fechar menu da campanha' }).click()
    await expect
      .poll(() => container.evaluate((element) => element.clientWidth))
      .toBeGreaterThan(widthWithSidebar)
    const headersWithoutSidebar = await visibleHeaders(container)
    expect(headersWithoutSidebar.length).toBeGreaterThan(headersWithSidebar.length)

    await page.getByRole('button', { name: 'Sollinha — Assistente virtual' }).first().click()
    const widthWithChat = await container.evaluate((element) => element.clientWidth)
    const headersWithChat = await visibleHeaders(container)
    await page.getByRole('button', { name: 'Fechar' }).last().click()
    await expect
      .poll(() => container.evaluate((element) => element.clientWidth))
      .toBeGreaterThan(widthWithChat)
    expect((await visibleHeaders(container)).length).toBeGreaterThan(headersWithChat.length)
    expect(page.viewportSize()).toEqual(viewportBefore)
    await expectNoHorizontalOverflow(container)
  })

  test('keeps Dobradinha restricted even when an advisor has enough room', async ({
    campaign,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === WEBKIT_PROJECT, 'Role coverage runs once in Chromium.')

    await loginWithAllColumns(page, campaign, 'advisor')
    const container = municipalityContainer(page)
    await setContainerWidth(container, 84 * REM_IN_PIXELS + 1)

    await expect(container.getByRole('columnheader', { name: /Assessores/ })).toBeVisible()
    await expect(container.getByRole('columnheader', { name: 'Dobradinha' })).toHaveCount(0)
    await expectNoHorizontalOverflow(container)
  })

  test('keeps the pinned name and 44px edit targets on iPad-sized WebKit', async ({
    campaign,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== WEBKIT_PROJECT, 'Focused WebKit coverage only.')

    await loginWithAllColumns(page, campaign)
    const container = municipalityContainer(page)
    await setContainerWidth(container, 48 * REM_IN_PIXELS + 1)
    const table = container.getByRole('table')
    await expect(table).toBeVisible()

    const stickyPosition = await table
      .getByRole('columnheader', { name: /Município/ })
      .evaluate((element) => getComputedStyle(element).position)
    expect(stickyPosition).toBe('sticky')

    for (const trigger of [
      table.getByRole('button', { name: /^Editar tendência política/ }).first(),
      table.getByRole('button', { name: /^Registrar sinal em/ }).first(),
    ]) {
      const box = await trigger.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
    await expectNoHorizontalOverflow(container)
  })
})
