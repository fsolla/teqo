/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign estimates and field updates', () => {
  test.describe.configure({ mode: 'parallel' })

  test('suggests, confirms, and proposes a new estimate without overwriting confirmation', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('estimate')}@example.com`
    const password = campaign.fixtures.value('EstimatePassword')
    const setup = await campaign.transaction(async (payload, req) => {
      const staff = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação estimativa'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo estimativa'),
          cities: ['Salvador'],
          coordinators: [staff.id],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      return { nucleus }
    })

    await campaign.login(page, email, password)
    await page.goto(`${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sugerir estimativa' }).click()
    await page.getByLabel('Estimativa de votos *').fill('1400')
    await page.getByRole('button', { name: 'Enviar sugestão' }).click()
    const review = page.getByRole('button', { name: 'Revisar sugestão' })
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 })
    await expect(review).toBeFocused({ timeout: 20_000 })
    await review.click()
    await page.getByRole('button', { name: 'Confirmar estimativa' }).click()
    await expect(page.getByText('1.400 votos', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Editar confirmada' })).toBeFocused()

    await page.getByRole('button', { name: 'Sugerir nova estimativa' }).click()
    await page.getByLabel('Estimativa de votos *').fill('1750')
    await page.getByRole('button', { name: 'Enviar sugestão' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByText('Sugestão pendente', { exact: true })).toBeVisible()
    const persisted = await campaign.payload.findByID({
      collection: 'electoralNucleus',
      id: setup.nucleus.id,
      depth: 0,
    })
    expect(persisted.confirmedVoteEstimate).toBe(1400)
    expect(persisted.proposedVoteEstimate).toBe(1750)
  })

  test('creates a field update and restores focus to its trigger', async ({ campaign, page }) => {
    test.slow()
    const email = `${campaign.fixtures.value('update')}@example.com`
    const password = campaign.fixtures.value('UpdatePassword')
    const updateText = campaign.fixtures.value('Mobilização concluída')
    const setup = await campaign.transaction(async (payload, req) => {
      const staff = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação atualização'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo atualização'),
          cities: ['Salvador'],
          coordinators: [staff.id],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      return { nucleus, staff }
    })

    await campaign.login(page, email, password)
    await page.goto(`${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}?tab=updates`)
    await page.waitForLoadState('networkidle')
    const trigger = page.getByRole('button', { name: 'Nova atualização' })
    await trigger.click()
    await page.getByRole('radio', { name: 'Nota' }).click()
    await page.getByLabel('Texto da atualização *').fill(updateText)
    await page.getByRole('button', { name: 'Enviar atualização' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page.getByText(updateText, { exact: true })).toBeVisible()

    const updates = await campaign.payload.find({
      collection: 'nucleusUpdate',
      where: {
        and: [{ nucleus: { equals: setup.nucleus.id } }, { author: { equals: setup.staff.id } }],
      },
      depth: 0,
      limit: 2,
    })
    expect(updates.totalDocs).toBe(1)
    expect(updates.docs[0]?.body).toBe(updateText)
  })
})
