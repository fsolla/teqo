import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test('prewarms shared Next route bundles sequentially', async ({ request }) => {
  test.slow()
  for (const path of [
    '/campanha/login',
    '/campanha',
    '/campanha/municipios',
    '/campanha/territorios',
    '/campanha/municipios/e2e-prewarm',
    '/campanha/perfil',
    '/campanha/demandas',
    '/campanha/liderancas',
    '/campanha/conceitos',
    '/campanha/convite/e2e-prewarm',
    '/',
  ]) {
    const response = await request.get(`${baseURL}${path}`)
    expect(response.ok(), `Failed to prewarm ${path}`).toBe(true)
  }

  // POST-only API route handlers (auto-save popovers): Next dev compiles a
  // route on its first hit, and that compile can trigger a full-page reload
  // for any client currently connected — which aborts an in-flight fetch mid
  // test. An unauthenticated POST never succeeds, but it still forces the
  // compile before any spec's client makes the real request.
  for (const path of [
    '/campanha/municipios/advisors',
    '/campanha/municipios/engagement-level',
    '/campanha/municipios/expected-votes',
    '/campanha/municipios/political-trend',
    '/campanha/liderancas/support-status',
    '/campanha/webauthn/login-options',
    '/campanha/webauthn/login',
    '/campanha/webauthn/register-options',
    '/campanha/webauthn/register',
  ]) {
    await request.post(`${baseURL}${path}`, { data: {} }).catch(() => undefined)
  }
})
