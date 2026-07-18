/* eslint-disable check-file/filename-naming-convention */
import { expect, test } from '@playwright/test'

test.describe('Campaign PWA foundation', () => {
  test('exposes manifest link and serves installable assets', async ({ page, request }) => {
    await page.goto('/campanha/login')

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/campanha/manifest.webmanifest',
    )

    const manifestResponse = await request.get('/campanha/manifest.webmanifest')
    expect(manifestResponse.status()).toBe(200)
    expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json')
    await expect(manifestResponse.json()).resolves.toMatchObject({
      start_url: '/campanha',
      scope: '/campanha',
      display: 'standalone',
    })

    const swResponse = await request.get('/campanha/sw.js')
    expect(swResponse.status()).toBe(200)
    expect(swResponse.headers()['content-type']).toContain('text/javascript')
    expect(swResponse.headers()['service-worker-allowed']).toBe('/campanha')
    const swBody = await swResponse.text()
    expect(swBody).toContain(`SCOPE + '/convite'`)
    expect(swBody).toContain('/campanha/offline')
    expect(swBody).toContain('isRscRequest')

    await page.goto('/campanha/offline')
    await expect(page.getByRole('heading', { name: 'Você está offline' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tentar novamente' })).toBeVisible()
  })
})
