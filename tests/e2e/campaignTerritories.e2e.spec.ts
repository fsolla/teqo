import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

test.describe('Territórios de Identidade', () => {
  test('staff sorts, filters and opens the municipality queue for a territory', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Territórios'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await campaign.login(page, email, password)
    await page.getByRole('link', { name: 'Territórios', exact: true }).click()

    await expect(page).toHaveURL(/\/campanha\/territorios$/)
    await expect(campaignPageChrome(page, 'Territórios de Identidade')).toBeVisible()

    // B175 — the count rides the name ("Irecê (N)") and the header is short ("2022").
    await expect(page.getByRole('link', { name: /Irecê \(\d+\)/ }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '2022' })).toBeVisible()

    await page.getByRole('link', { name: /Ordenar por 2022/ }).click()
    await expect(page).toHaveURL(/\/campanha\/territorios\?sort=votes2022/)

    await page.getByRole('button', { name: 'Filtrar por Território' }).click()
    await page.locator('a[href*="/campanha/territorios?region=Irec"]').click()
    await expect(page).toHaveURL(/region=Irec%C3%AA/)
    await expect(page.getByText('1 território encontrado')).toBeVisible()

    await page
      .getByRole('link', { name: /Irecê \(\d+\)/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/campanha\/municipios\?region=Irec%C3%AA/)
  })

  test('parent territory rows expose hash anchor ids for deep links', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Âncoras'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await campaign.login(page, email, password)
    await page.goto('/campanha/territorios')

    // `.first()`: transient RSC-pending duplication copies the rows (observed
    // strict-mode flake on loaded machines; CI stays green).
    await expect(page.locator('#ti-irece').first()).toBeVisible()
    await expect(page.locator('#ti-velho-chico').first()).toBeVisible()
  })

  test('a wide panel surfaces the read-only network columns; Cobertura stays hidden by default', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Rede Larga'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await page.setViewportSize({ width: 2200, height: 1000 })
    await campaign.login(page, email, password)
    await page.goto('/campanha/territorios')

    // B175 — the responsive rungs are all visible at a wide panel (P0 + Captura
    // + network + Classe + Assessoria). Cobertura is P3 AND hidden in the picker.
    // Sortable headers are announced "Ordenar por <label> (…)" — match by prefix;
    // the read-only network headers are plain, so match them exactly (never by
    // substring, since "Assessor" is a prefix of "Assessoria").
    for (const header of ['2022', 'Captura', '2026', 'Classe', 'Assessoria']) {
      await expect(
        page.getByRole('columnheader', { name: new RegExp(`^Ordenar por ${header}`) }),
        `header ${header}`,
      ).toBeVisible()
    }
    for (const header of ['Assessor', 'Liderança', 'Dobradinha']) {
      await expect(
        page.getByRole('columnheader', { name: header, exact: true }),
        `header ${header}`,
      ).toBeVisible()
    }
    await expect(page.getByRole('columnheader', { name: 'Cobertura' })).toHaveCount(0)
  })

  test('leader cannot open the territories page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Territórios'),
      username: phone,
    })
    const password = leader.password

    await campaign.login(page, phone, password)
    await expect(page.getByRole('link', { name: 'Territórios', exact: true })).toHaveCount(0)

    await page.goto('/campanha/territorios')
    await expect(page).toHaveURL(/\/campanha\/contatos/)
  })
})
