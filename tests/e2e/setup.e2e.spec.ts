import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test('prewarms shared Next route bundles sequentially', async ({ request }) => {
  test.slow()
  for (const path of [
    '/campanha/login',
    '/campanha/pracas',
    '/campanha/pracas/e2e-prewarm',
    '/campanha/demandas',
    '/campanha/convite/e2e-prewarm',
    '/',
  ]) {
    const response = await request.get(`${baseURL}${path}`)
    expect(response.ok(), `Failed to prewarm ${path}`).toBe(true)
  }
})
