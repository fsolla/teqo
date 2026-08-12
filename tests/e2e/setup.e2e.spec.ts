import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test('prewarms shared Next route bundles sequentially', async ({ request }) => {
  // 27 route modules compiled cold; measured ~3-6 min total under
  // parallel-worktree load (load ~50, 2026-08-10: /campanha/contatos alone
  // took 57 s), plus a one-shot retry per GET for the dev-server abort class
  // below. On CI the production build answers warm in seconds, so the budget
  // never bites there.
  test.setTimeout(420_000)
  // A cold compile can make Next dev abort an in-flight request (socket hang
  // up, measured on the original list under load) — the route compiles anyway,
  // so a single retry lands warm. The assertion runs on the retry only;
  // a second failure is a real regression (broken/404 route).
  const prewarmGet = async (path: string) => {
    const first = await request.get(`${baseURL}${path}`).catch(() => undefined)
    if (first?.ok()) return first
    if (first) {
      console.info(`[prewarm] first attempt ${path} answered ${first.status()} — retrying once`)
    }
    const retry = await request.get(`${baseURL}${path}`).catch(() => undefined)
    expect(retry?.ok(), `Failed to prewarm ${path}`).toBe(true)
    return retry
  }
  for (const path of [
    '/campanha/login',
    '/campanha',
    '/campanha/quadro',
    '/campanha/municipios',
    '/campanha/territorios',
    '/campanha/municipios/e2e-prewarm',
    // The only edit route specs navigate (grep-verified 2026-08-10): compiling
    // it cold mid-test aborted the :78 goto with ERR_ABORTED (dev full-reload).
    '/campanha/municipios/e2e-prewarm/editar',
    '/campanha/perfil',
    '/campanha/demandas',
    '/campanha/demandas/nova',
    // The demand-create form redirects to /campanha/demandas/<slug>; the detail
    // module is a goto-less redirect target, so it needs its own prewarm entry
    // (same class as /editar: cold compile mid-test aborts the redirect).
    '/campanha/demandas/e2e-prewarm',
    '/campanha/liderancas',
    '/campanha/contatos',
    '/campanha/conceitos',
    '/campanha/acoes/atualizar-votos',
    '/campanha/acoes/atualizar-lideranca',
    '/campanha/acoes/mudar-tendencia',
    '/campanha/acoes/registrar-atualizacao',
    '/campanha/agenda',
    '/campanha/atividades/nova',
    '/campanha/atualizacoes',
    '/campanha/offline',
    '/campanha/pessoas',
    // PWA artifacts every authenticated page fetches on load — a cold compile
    // here mid-suite full-page-reloads connected clients (ERR_ABORTED class).
    '/campanha/manifest.webmanifest',
    '/campanha/sw.js',
    '/campanha/convite/e2e-prewarm',
    '/',
  ]) {
    await prewarmGet(path)
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
    '/campanha/municipios/leaderships',
    '/campanha/municipios/pledge-declared-votes',
    '/campanha/municipios/pledge-estimated-votes',
    '/campanha/municipios/political-trend',
    '/campanha/municipios/next-steps',
    '/campanha/liderancas/support-status',
    '/campanha/home-search',
    // The Sollinha chat mounts on every authenticated page: its transport and
    // the PWA registration hit these on first load/session-restore — cold
    // compiles mid-suite are the ERR_ABORTED class (measured on :78 /editar).
    '/campanha/api/ai-chat',
    '/campanha/api/ai-transcribe',
    '/campanha/webauthn/login-options',
    '/campanha/webauthn/login',
    '/campanha/webauthn/register-options',
    '/campanha/webauthn/register',
  ]) {
    await request.post(`${baseURL}${path}`, { data: {} }).catch(() => undefined)
  }
})
