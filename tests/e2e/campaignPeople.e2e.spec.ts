import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * C100 — the unified people list: staff lands on `/campanha/pessoas`, sees the
 * merged person row, and the route stays locked for leaders.
 */
test.describe('Pessoas — lista unificada', () => {
  test('staff opens the people list and sees the merged leadership person', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Pessoas'),
    })
    const municipality = await fixtures.claimMunicipality()
    const { contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Pessoas',
      municipalities: [municipality],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)

    await page.getByRole('link', { name: 'Pessoas', exact: true }).click()
    await expect(page).toHaveURL(/\/campanha\/pessoas$/)
    await expect(campaignPageChrome(page, 'Pessoas')).toBeVisible()

    // The merged row carries the leadership person with its capacity chips
    // (desktop table — the mobile card twin is `md:hidden` at this viewport).
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()
    // The coordinator account itself is a staff person (with a ficha) — ≥ 2 rows.
    await expect(page.getByText(/^\d+ pessoas?$/)).toBeVisible()

    // The omnibox search narrows the recorte (canonical URL, chips mounted).
    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill(contactName.slice(0, 8))
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=/)
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()
  })

  test('leader cannot open the people page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Sem Acesso'),
      username: phone,
    })

    await campaign.login(page, phone, leader.password)
    await page.goto('/campanha/pessoas')

    await expect(page).toHaveURL(/\/campanha\/contatos/)
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
  })
})
