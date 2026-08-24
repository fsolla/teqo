import { campaignConceptHref } from '../../src/lib/campaignIntelligenceConcepts.js'
import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * OPS87 — client slice of `campaignConcepts` after the HTTP migration. The
 * route gate, the rendered content and the deep-link anchors moved to
 * tests/e2e/campaignConceptsHttp.e2e.spec.ts (same original test names, 1:1);
 * what remains here is the interaction only a browser can exercise: the
 * tooltip and the card popover mount their links on open, so their content
 * never lives in the server HTML.
 *
 * HTTP twin: tests/e2e/campaignConceptsHttp.e2e.spec.ts.
 */
test.describe('Conceitos de inteligência', () => {
  test('staff reaches the concepts page via the tooltip and the card popover', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Conceitos'),
    })
    const password = coordinator.password
    const email = coordinator.email!
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, email, password)

    await page.goto(`/campanha/municipios/${municipality.slug}`)
    const goalAccount = page.getByRole('region', { name: 'Conta da cadeira' })
    await expect(goalAccount).toBeVisible()
    // C106 — dynamic pages stream a transient hidden `#S:*` copy of the shell;
    // a hover landing before hydration is a silent no-op (the B13/B17 flake
    // class), so let the streamed shell settle first.
    await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)

    // Per-metric tooltips carry a deep link to the matching anchor.
    await goalAccount.getByRole('button', { name: /Captura \(2022\): mais informações/ }).hover()
    // Radix mirrors tooltip content for screen readers, so the link renders twice.
    await expect(page.getByRole('link', { name: 'Saiba mais' }).first()).toHaveAttribute(
      'href',
      campaignConceptHref('captura'),
    )
    // The card-level Popover is the keyboard-reachable path (tooltip content is not tabbable).
    await goalAccount.getByRole('button', { name: 'Sobre a conta da cadeira' }).click()
    await page.getByRole('link', { name: 'Como cada número é calculado' }).click()

    await expect(page).toHaveURL(/\/campanha\/conceitos$/)
    await expect(campaignPageChrome(page, 'Conceitos de inteligência')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cobertura da meta' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Teto do campo (projetado)' })).toBeVisible()

    // Deep link lands on the documented concept and the browser applies the
    // `:target` tint — the HTTP twin proves the anchor exists in the server
    // HTML, this proves the fragment navigation itself.
    await page.goto(campaignConceptHref('captura'))
    await expect(page.locator('article:target')).toHaveAttribute('id', 'captura')
  })
})
