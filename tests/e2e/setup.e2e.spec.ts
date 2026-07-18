import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test('prewarms shared Next route bundles sequentially', async ({ request }) => {
  test.slow()
  for (const path of [
    '/campanha/login',
    '/campanha/nucleos',
    '/campanha/nucleos/novo',
    '/campanha/nucleos/e2e-prewarm',
    '/campanha/convite/e2e-prewarm',
    '/',
  ]) {
    const response = await request.get(`${baseURL}${path}`)
    expect(response.ok(), `Failed to prewarm ${path}`).toBe(true)
  }
})
