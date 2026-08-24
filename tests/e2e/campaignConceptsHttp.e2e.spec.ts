import { campaignConceptHref } from '../../src/lib/campaignIntelligenceConcepts.js'
import { assertLeaderRedirect, expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * OPS87 — server slice of `campaignConcepts` migrated to the browserless HTTP
 * mode (same server, same database, real HTTP, no browser). What the browser
 * spec read from the DOM is read from the rendered HTML; what it navigated by
 * click is requested by URL.
 *
 * Browser twin: tests/e2e/campaignConcepts.e2e.spec.ts — the browser file keeps
 * the tooltip/popover interactions (client-only: Radix mounts their content
 * on open, so the links never live in the server HTML); this file carries the
 * original test names so the 1:1 migration is auditable by `git log`/`-g`.
 * The client-failure guard (console.error/pageerror) stays exclusive to
 * browser specs — the HTTP mode does not pretend to observe what it cannot
 * see (OPS35).
 */

test.describe('Conceitos de inteligência (HTTP)', () => {
  test('staff reads the concepts page and reaches it from the goal-account card', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Conceitos'),
    })
    const municipality = await fixtures.claimMunicipality()
    const request = await campaignRequest(coordinator, coordinator.password)

    // The municipality detail renders the "Conta da cadeira" card server-side,
    // with the per-metric tooltip buttons as its affordances (their content is
    // client-only; the entry point is not).
    const detail = await request.get(`/campanha/municipios/${municipality.slug}`)
    expect(detail.status()).toBe(200)
    const detailHTML = rendered(await detail.text())
    expect(detailHTML).toContain('Conta da cadeira')
    expect(detailHTML).toContain('aria-label="Captura (2022): mais informações"')
    // Always-visible way in, at the foot of the sidebar — the same link the
    // browser spec clicks.
    expect(detailHTML).toContain('href="/campanha/conceitos"')

    // The page itself: the documented concepts render as server HTML headings.
    const concepts = await request.get('/campanha/conceitos')
    expect(concepts.status()).toBe(200)
    const conceptsHTML = rendered(await concepts.text())
    expect(conceptsHTML).toContain('Cobertura da meta')
    expect(conceptsHTML).toContain('Teto do campo (projetado)')

    // Deep link lands on the documented concept: the anchor article exists in
    // the server HTML (`article:target` is what the browser tints).
    const deep = await request.get(campaignConceptHref('captura'))
    expect(deep.status()).toBe(200)
    expect(rendered(await deep.text())).toContain('<article id="captura"')
  })

  test('leader cannot open the concepts page', async ({ campaign, campaignRequest }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Conceitos'),
      username: phone,
    })
    // Log in by username (phone), the way the browser spec did — the REST
    // login accepts email or username and both branches are exercised.
    const request = await campaignRequest({ username: phone }, leader.password)

    // The `staff` gate throws `redirect()` deep in the page, after the layout
    // has started streaming — same contract the Territories spec pins: assert
    // the redirect target, never the transport.
    await assertLeaderRedirect(request, '/campanha/conceitos')

    // The leader home renders no way in.
    const home = await request.get('/campanha/meus-contatos')
    expect(home.status()).toBe(200)
    expect(await home.text()).not.toContain('href="/campanha/conceitos"')
  })
})
