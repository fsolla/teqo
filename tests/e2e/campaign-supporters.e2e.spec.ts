/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign supporter journeys', () => {
  test.describe.configure({ mode: 'parallel' })

  test('removes a supporter through the confirmation dialog', async ({ campaign, page }) => {
    test.setTimeout(240_000)
    const generalEmail = `${campaign.fixtures.value('removal-general')}@example.com`
    const password = campaign.fixtures.value('RemovalPassword')
    const supporterName = campaign.fixtures.value('Apoiador removível')

    const setup = await campaign.transaction(async (payload, req) => {
      const general = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação Geral remoção'),
          email: generalEmail,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const contact = await payload.create({
        collection: 'contact',
        data: {
          name: supporterName,
          phone: campaign.fixtures.phone(),
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        req,
      })
      const supporter = await payload.create({
        collection: 'supporter',
        data: {
          contact: contact.id,
          source: 'manual',
          createdBy: general.id,
        },
        depth: 0,
        req,
      })
      return { general, supporter }
    })

    await campaign.login(page, generalEmail, password)
    await page.goto(`${campaign.baseURL}/campanha/apoiadores/${setup.supporter.id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Remover dados' }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('heading', { name: 'Remover os dados deste apoiador?' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Confirmar remoção' }).click()
    await page.waitForURL(`${campaign.baseURL}/campanha/apoiadores`, { timeout: 30_000 })

    await expect
      .poll(
        async () =>
          (
            await campaign.payload.find({
              collection: 'supporter',
              where: { id: { equals: setup.supporter.id } },
              depth: 0,
              limit: 1,
            })
          ).totalDocs,
        { timeout: 30_000 },
      )
      .toBe(0)
  })
})
