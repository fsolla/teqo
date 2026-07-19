/* eslint-disable check-file/filename-naming-convention */
import { expect, test } from './fixtures/campaignE2EFixtures'

test.describe('Campaign composition and accessibility', () => {
  test.describe.configure({ mode: 'parallel' })

  test('loads the intelligence editor only after its persistent trigger and restores focus', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('composition')}@example.com`
    const password = campaign.fixtures.value('CompositionPassword')
    const nucleus = await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação composição'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      return payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo composição'),
          cities: ['Salvador'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    let triggerStarted = false
    const editorRequests: boolean[] = []
    await page.route('**/*.js*', async (route) => {
      const response = await route.fetch()
      const body = await response.body()
      if (body.includes(Buffer.from('Salvar inteligência'))) editorRequests.push(triggerStarted)
      await route.fulfill({ response, body })
    })
    await page.goto(`${campaign.baseURL}/campanha/nucleos/${nucleus.slug}`)
    expect(editorRequests).not.toContain(false)

    const trigger = page.getByRole('button', { name: 'Editar inteligência' })
    triggerStarted = true
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Editar inteligência do núcleo' })
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => editorRequests).toContain(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('keeps one responsive filter tree visible only when appropriate', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('disclosure')}@example.com`
    const password = campaign.fixtures.value('DisclosurePassword')
    await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação disclosure'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/nucleos`)

    await expect(page.getByLabel('Território de identidade')).toBeVisible()
    await expect(page.getByLabel('Município')).toBeVisible()

    const toggle = page.getByRole('button', { name: 'Mais filtros' })
    const controls = page.locator('#nucleus-advanced-filters')
    await expect(controls).toBeHidden()
    await toggle.click()
    await expect(controls).toBeVisible()
    await expect(page.getByLabel('Cobertura')).toBeVisible()
    await expect(page.getByLabel('Território de identidade')).toHaveCount(1)
    await toggle.click()
    await expect(controls).toBeHidden()

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByLabel('Território de identidade')).toBeVisible()
    await expect(toggle).toBeVisible()
    await expect(controls).toBeHidden()
    await toggle.click()
    await expect(controls).toBeVisible()
    await expect(page.getByLabel('Cobertura')).toBeVisible()
  })
})
