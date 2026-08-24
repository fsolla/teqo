import { expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * OPS87 — `campaignPermissionProfile` migrated wholesale to the browserless
 * HTTP mode (same server, same database, real HTTP, no browser). Every one of
 * the family's assertions was already server-side: the FAB mount decision and
 * the write buttons are computed in the page/layout (C142 gates
 * `canCreate`/`editingScope` in RSC — AdvisorEditingScope `somente_leitura`
 * → `none`), so presence/absence in the rendered HTML IS the contract. The
 * browser spec's `waitForFunction` on the `S:` stream settle was browser-DOM
 * stabilization, not an assertion — the raw HTML carries the committed shell,
 * so nothing replaces it.
 *
 * The browser file was deleted: all 6 tests live here with their original
 * names (1:1 auditability via `git log`/`-g`). The client-failure guard stays
 * exclusive to browser specs (OPS35).
 *
 * Browser twin: none (deleted) — tests/e2e/campaignPermissionProfile.e2e.spec.ts.
 */

test.describe('Advisor permission profiles (C142) (HTTP)', () => {
  test.describe('somente_leitura — read-only across all surfaces', () => {
    test('municipality list has no write controls and the FAB is absent', async ({
      campaign,
      campaignRequest,
    }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/municipios')
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())

      // FAB must not be rendered on the municipality list (write surface).
      expect(html).not.toContain('data-slot="campaign-quick-actions-fab"')
      // No write-control link names on the page ("Nova…", "Criar…", "Editar…"
      // — the browser spec matched them by role=link, the HTML twin pins the
      // same words in element text nodes).
      expect(html).not.toMatch(/>[^<>]{0,80}(?:Nova|Criar|Editar)/)
    })

    test('demands list has no "Nova demanda" button', async ({ campaign, campaignRequest }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/demandas')
      expect(response.status()).toBe(200)
      // "Nova demanda" is gated server-side (`canCreate`) — never rendered
      // for a somente_leitura advisor.
      expect(rendered(await response.text())).not.toContain('Nova demanda')
    })

    test('activities list has no create buttons', async ({ campaign, campaignRequest }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/atividades')
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      // "Planejar giro" (server link) and "Nova atividade" (client host, but
      // its inclusion is server-gated) must both be absent.
      expect(html).not.toContain('Planejar giro')
      expect(html).not.toContain('Nova atividade')
    })

    test('supporters list has no "Novo" or "Importar CSV" buttons', async ({
      campaign,
      campaignRequest,
    }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'somente_leitura',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/apoiadores')
      expect(response.status()).toBe(200)
      const html = rendered(await response.text())
      // The labels the browser spec pinned by role=link — never the hrefs
      // (a route rename must not let a leaking write control pass green).
      expect(html).not.toMatch(/>\s*Novo</)
      expect(html).not.toContain('Importar CSV')
    })
  })

  test.describe('carteira editing — write scoped to portfolio', () => {
    test('rows outside the portfolio are read-only', async ({ campaign, campaignRequest }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'carteira',
        editing: 'carteira',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/municipios')
      expect(response.status()).toBe(200)
      // The FAB should be rendered (carteira scope = write allowed).
      expect(rendered(await response.text())).toContain('data-slot="campaign-quick-actions-fab"')
    })
  })

  test.describe('tudo editing — full write access', () => {
    test('write controls are present', async ({ campaign, campaignRequest }) => {
      const user = await campaign.fixtures.createCampaignUser('advisor', {
        visibility: 'tudo',
        editing: 'tudo',
      })
      const request = await campaignRequest(user, user.password)

      const response = await request.get('/campanha/municipios')
      expect(response.status()).toBe(200)
      // The FAB must be rendered for a tudo advisor.
      expect(rendered(await response.text())).toContain('data-slot="campaign-quick-actions-fab"')
    })
  })
})
