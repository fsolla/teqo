import { expect, test } from './fixtures/campaignHttpTest.js'

/**
 * OPS35 — `campaignTerritories` migrated to the browserless HTTP mode: same
 * server, same database, real HTTP, no browser. The family's assertions were
 * server-rendered content + URL contracts + a route-level redirect, so the
 * equivalence is direct: what the browser spec read from the DOM is read from
 * the rendered HTML; what it navigated by click is requested by URL.
 *
 * Two render realities shaped the assertions (verified against the real
 * markup): React's streaming inserts `<!-- -->` text-node separators, so text
 * assertions run over `rendered()` (comments stripped — they are transport,
 * not content); and the Cobertura column label lives in the RSC flight
 * payload (the column picker menu is a client component whose props serialize
 * even when closed), so "hidden by default" is pinned by the absence of its
 * sortable control, which `resolveVisibleColumns` never renders
 * (CampaignTable.tsx:168). CSS rung visibility at a given viewport is a
 * browser concern (OPS35 keeps viewports in the browser families) — the
 * server contract asserted here is which columns are rendered for a given
 * state.
 */

const rendered = (html: string) => html.replaceAll('<!-- -->', '')

test.describe('Territórios de Identidade (HTTP)', () => {
  test('staff sorts, filters and opens the municipality queue for a territory', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Territórios'),
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    // The sidebar way in — the same link the browser spec clicks.
    const list = await request.get('/campanha/territorios')
    expect(list.status()).toBe(200)
    const listHTML = rendered(await list.text())
    expect(listHTML).toContain('Territórios de Identidade')
    expect(listHTML).toContain('href="/campanha/territorios"')
    // B175 — the count rides the name ("Irecê (N)"): the row link leads with
    // the territory name and carries the municipality count.
    expect(listHTML).toMatch(/Irecê <span[^>]*>\(\d+\)/)
    // The controls the browser spec exercised by click are anchors: pin their
    // hrefs so a broken affordance fails here instead of passing silently.
    expect(listHTML).toContain('href="/campanha/municipios?region=Irec%C3%AA"')
    expect(listHTML).toContain('href="/campanha/territorios?sort=votes2022')

    // Sorting is a URL contract: the server renders the summary in the caption.
    const sorted = await request.get('/campanha/territorios?sort=votes2022')
    expect(sorted.status()).toBe(200)
    expect(rendered(await sorted.text())).toContain('Ordenado por 2022 (maior primeiro)')

    // Filtering is the same contract: the footer reports the recorte.
    const filtered = await request.get('/campanha/territorios?region=Irecê')
    expect(filtered.status()).toBe(200)
    expect(rendered(await filtered.text())).toContain('1 território encontrado')

    // The row opens the municipality queue for the territory.
    const queue = await request.get('/campanha/municipios?region=Irecê')
    expect(queue.status()).toBe(200)
    expect(rendered(await queue.text())).toContain('Irecê')
  })

  test('parent territory rows expose hash anchor ids for deep links', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Âncoras'),
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    const response = await request.get('/campanha/territorios')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('id="ti-irece"')
    expect(html).toContain('id="ti-velho-chico"')
  })

  test('the read-only network columns render in the server HTML; Cobertura stays hidden by default', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Rede Larga'),
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    const response = await request.get('/campanha/territorios')
    expect(response.status()).toBe(200)
    const html = await response.text()

    // B175 — the sortable rungs (P0 + Captura + network + Classe + Assessoria)
    // announce "Ordenar por <label> (…)" via aria-label. No `(` anchor: the
    // active sort renders "Ordenar por X, inverter para …", the inactive one
    // "Ordenar por X (…)" — both must match (the assertion is about the
    // column existing, not about which sort is active).
    for (const header of ['2022', 'Captura', '2026', 'Classe', 'Assessoria']) {
      expect(html, `sortable header ${header}`).toContain(`aria-label="Ordenar por ${header}`)
    }
    // The read-only network headers are plain text — match exactly (never by
    // substring: "Assessor" is a prefix of "Assessores"/"Assessoria"). Their
    // panel-width rung classes are server-rendered too, so the "wide panel
    // shows them" contract keeps a server-side pin (CSS visibility at a
    // viewport stays a browser concern).
    const networkRungs: Array<[string, string]> = [
      ['Assessor', 'hidden @min-[60rem]/territory-list:table-cell'],
      ['Liderança', 'hidden @min-[66rem]/territory-list:table-cell'],
      ['Dobradinha', 'hidden @min-[72rem]/territory-list:table-cell'],
    ]
    for (const [header, rung] of networkRungs) {
      expect(html, `network header ${header}`).toContain(`${header}<`)
      expect(html, `network rung ${header}`).toContain(rung)
    }

    // Cobertura is P3 AND hidden in the picker: the hidden column is never
    // rendered (its sortable control is absent), even though its label exists
    // in the RSC flight payload as the picker menu item.
    expect(html).not.toContain('Ordenar por Cobertura')
  })

  test('leader cannot open the territories page', async ({ campaign, campaignRequest }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Territórios'),
      username: phone,
    })
    // Log in by username (phone), the way the browser spec did — the REST
    // login accepts email or username and both branches are exercised.
    const request = await campaignRequest({ username: phone }, leader.password)

    // The `noLeader` gate throws `redirect()` deep in the page, after the
    // layout has started streaming — so the document usually answers 200
    // carrying Next's route-redirect meta tag instead of a 3xx. When the
    // redirect beats the stream it is a real 3xx (dev 307 / prod 308). Both
    // are the server contract the browser follows — assert the redirect
    // target, never pin the transport.
    const direct = await request.get('/campanha/territorios', { maxRedirects: 0 })
    expect([200, 307, 308]).toContain(direct.status())
    if (direct.status() === 200) {
      expect(await direct.text()).toContain(
        'http-equiv="refresh" content="1;url=/campanha/meus-contatos"',
      )
    } else {
      expect(direct.headers()['location']).toMatch(/\/campanha\/meus-contatos$/)
    }

    // The leader home renders no way in.
    const home = await request.get('/campanha/meus-contatos')
    expect(home.status()).toBe(200)
    expect(await home.text()).not.toContain('href="/campanha/territorios"')
  })
})
