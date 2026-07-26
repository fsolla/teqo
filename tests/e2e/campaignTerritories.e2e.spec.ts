import { expect, test } from './fixtures/campaignE2EFixtures.js'

test.describe('Territórios de Identidade', () => {
  test('staff sorts, filters and opens the municipality queue for a territory', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('territorios-coordinator')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Territórios'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    await campaign.login(page, email, password)
    await page.getByRole('link', { name: 'Territórios', exact: true }).click()

    await expect(page).toHaveURL(/\/campanha\/territorios$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Territórios de Identidade' }),
    ).toBeVisible()

    await page.getByRole('link', { name: /Ordenar por Votos 2022/ }).click()
    await expect(page).toHaveURL(/\/campanha\/territorios\?sort=votes2022/)

    await page.getByRole('button', { name: 'Filtrar por Território' }).click()
    await page.locator('a[href*="/campanha/territorios?region=Irec"]').click()
    await expect(page).toHaveURL(/region=Irec%C3%AA/)
    await expect(page.getByText('1 território encontrado')).toBeVisible()

    await page.getByRole('link', { name: 'Irecê', exact: true }).first().click()
    await expect(page).toHaveURL(/\/campanha\/municipios\?region=Irec%C3%AA/)
  })

  test('leader cannot open the territories page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const phone = fixtures.phone()
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Liderança Territórios'),
        username: phone,
        password,
        role: 'leader',
      },
      depth: 0,
    })

    await campaign.login(page, phone, password)
    await expect(page.getByRole('link', { name: 'Territórios', exact: true })).toHaveCount(0)

    await page.goto('/campanha/territorios')
    await expect(page).toHaveURL(/\/campanha\/?$/)
  })
})
