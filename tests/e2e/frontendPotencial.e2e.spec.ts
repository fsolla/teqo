import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/e2eTest'

/**
 * S46 — the public `/potencial` flow over real HTTP: the form queries the
 * committed TSE artifact through `/api/potencial/*`, the panel shows the real
 * Serrinha/BA ZE 150 seção 50 readings (conferidas contra o CSV do TSE) and
 * the story canvas exports the 1080×1920 PNG with the same numbers.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

const consultSerrinha = async (page: Page, section = '50') => {
  await page.getByLabel('Município').fill('serr')
  await page.getByRole('option', { name: 'Serrinha' }).click()
  await page.getByLabel('Zona').fill('150')
  await page.getByLabel('Seção').fill(section)
  await page.getByRole('button', { name: 'Ver o potencial da minha seção' }).click()
}

test.describe('potencial da seção (S46)', () => {
  test('consulta a seção real de Serrinha e baixa o story 1080×1920', async ({ page }) => {
    await page.goto(`${BASE_URL}/potencial`)
    await expect(
      page.getByRole('heading', { name: 'Quanto o Lula pode crescer na sua seção?' }),
    ).toBeVisible()

    await consultSerrinha(page)

    await expect(page.getByText('Potencial nesta seção')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('66,9%').first()).toBeVisible()
    await expect(page.getByText('73,7%').first()).toBeVisible()
    await expect(page.getByText('79,8%').first()).toBeVisible()
    await expect(page.getByText('+12,9 p.p.').first()).toBeVisible()
    await expect(page.getByText('+6,8 p.p.').first()).toBeVisible()

    const canvas = page.locator('canvas')
    await expect(canvas).toHaveAttribute('width', '1080')
    await expect(canvas).toHaveAttribute('height', '1920')

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Baixar imagem' }).click(),
    ]).then(([event]) => event)
    expect(download.suggestedFilename()).toBe('potencial-lula-ba-serrinha-z150-s50.png')
    await expect(page.getByText('Imagem pronta — 1080 × 1920 px')).toBeVisible()
  })

  // A probe da seção inexistente provoca o 404 da API de propósito; o browser
  // loga o recurso falho mesmo com o app tratando — declarado só neste bloco,
  // para uma falha inesperada da rota no caminho feliz continuar sendo falha.
  test.describe('seção inexistente', () => {
    test.use({ expectedRequestFailurePaths: [/\/api\/potencial\/secao$/] })

    test('não inventa número para seção inexistente', async ({ page }) => {
      await page.goto(`${BASE_URL}/potencial`)
      await consultSerrinha(page, '9999')

      await expect(page.getByRole('heading', { name: 'Não encontramos essa seção' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByRole('alert').filter({ hasText: 'dados do TSE' })).toContainText(
        'Essa combinação de zona e seção não aparece nos dados do TSE.',
      )
      await expect(page.getByLabel('Zona')).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByLabel('Seção')).toHaveAttribute('aria-invalid', 'true')
    })
  })

  test('mobile 390 empilha o fluxo sem estourar a largura', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/potencial`)
    await consultSerrinha(page)

    await expect(page.getByText('Potencial nesta seção')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('canvas')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
