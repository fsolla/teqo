/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign action plan journeys', () => {
  test.describe.configure({ mode: 'parallel' })

  test('creates a planned action and opens it from the list', async ({ campaign, page }) => {
    test.setTimeout(240_000)
    const generalEmail = `${campaign.fixtures.value('plan-general')}@example.com`
    const password = campaign.fixtures.value('PlanPassword')
    const planTitle = campaign.fixtures.value('Caminhada E2E')

    await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação Geral Planos'),
          email: generalEmail,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
    })

    await campaign.login(page, generalEmail, password)
    await page.goto(`${campaign.baseURL}/campanha/planos/novo`)
    await page.getByLabel('Título *').fill(planTitle)
    await page.getByLabel('Tipo de ação *').selectOption('caminhada')
    await page.getByRole('button', { name: 'Planejado', exact: true }).click()
    await page.locator('#startAt').fill('2026-08-20T09:00')
    await page.getByLabel('Municípios').fill('Salvador')
    await page.getByRole('option', { name: 'Salvador', exact: true }).click()
    await page.getByRole('button', { name: 'Criar plano' }).click()

    await expect(page).toHaveURL(new RegExp(`/campanha/planos/.+`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: planTitle })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/planos?tab=todos`)
    await expect(page.getByRole('link', { name: planTitle })).toBeVisible()
  })

  test('hides create affordance for leadership role', async ({ campaign, page }) => {
    test.slow()
    const phone = campaign.fixtures.phone()
    const password = campaign.fixtures.value('LeadershipPlanPassword')

    await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Liderança Planos'),
          username: phone,
          password,
          role: 'lideranca',
          phone,
        },
        depth: 0,
        req,
      })
    })

    await campaign.login(
      page,
      `+55 (${phone.slice(0, 2)}) ${phone.slice(2)}`,
      password,
    )
    await page.goto(`${campaign.baseURL}/campanha/planos`)
    await expect(page.getByRole('heading', { name: /Planos/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Novo plano/i })).toHaveCount(0)
  })
})
