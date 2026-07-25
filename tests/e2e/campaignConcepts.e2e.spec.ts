import { campaignConceptHref } from '../../src/lib/campaignIntelligenceConcepts.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * E18 — `/campanha/conceitos` documents staff-only numbers (estimates, goals,
 * field ceiling), so the route gate and the "Saiba mais" path out of the
 * "Conta da cadeira" card are what these tests protect.
 */
test.describe('Conceitos de inteligência', () => {
  test('staff reads the concepts page and reaches it from the goal-account card', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('conceitos-coordinator')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Conceitos'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, email, password)

    // Always-visible way in, at the foot of the sidebar.
    await page.getByRole('link', { name: 'Conceitos', exact: true }).click()
    await expect(page).toHaveURL(/\/campanha\/conceitos$/)

    await page.goto(`/campanha/municipios/${municipality.slug}`)
    const goalAccount = page.getByRole('region', { name: 'Conta da cadeira' })
    await expect(goalAccount).toBeVisible()

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
    await expect(page.getByRole('heading', { level: 1, name: 'Conceitos de inteligência' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cobertura da meta' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Teto do campo (projetado)' })).toBeVisible()

    // Deep link lands on the documented concept, not just on the page.
    await page.goto(campaignConceptHref('captura'))
    await expect(page.locator('article:target')).toHaveAttribute('id', 'captura')
  })

  test('leader cannot open the concepts page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const phone = fixtures.phone()
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Liderança Conceitos'),
        username: phone,
        password,
        role: 'leader',
      },
      depth: 0,
    })

    await campaign.login(page, phone, password)
    await expect(page.getByRole('link', { name: 'Conceitos', exact: true })).toHaveCount(0)

    await page.goto('/campanha/conceitos')

    await expect(page).toHaveURL(/\/campanha\/?$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Conceitos de inteligência' }),
    ).toHaveCount(0)
  })
})
