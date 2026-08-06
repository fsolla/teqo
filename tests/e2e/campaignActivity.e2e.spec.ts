import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

test.describe('Atividades — registro-fundação', () => {
  test.setTimeout(90_000)

  test('cria compromisso com demandas vinculadas e exibe os sinais no município', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()
    const activityTitle = fixtures.value('Giro territorial')
    const transportDemand = fixtures.value('Transporte para equipe')
    const materialDemand = fixtures.value('Material de rua')

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/atividades/nova`)

    await page.getByLabel('Título *').fill(activityTitle)
    await page.getByLabel('Início *').fill('2026-08-15T10:00')
    await page.getByLabel('Município *').selectOption(String(municipality.id))

    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 1').fill(transportDemand)
    await page.getByLabel('Tipo da demanda 1').selectOption('transporte')
    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 2').fill(materialDemand)
    await page.getByLabel('Tipo da demanda 2').selectOption('material')

    await page.getByRole('button', { name: 'Criar compromisso' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+$/)
    await expect(campaignPageChrome(page, activityTitle)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: transportDemand })).toBeVisible()
    await expect(page.getByRole('link', { name: materialDemand })).toBeVisible()

    await page.getByRole('link', { name: 'Adicionar demanda' }).click()
    await expect(page.locator('input[name="activityId"]')).toHaveValue(/\d+/)
    await expect(page.getByLabel('Atividade relacionada')).toContainText(activityTitle)
    await expect(page.getByLabel('Município')).toHaveValue(String(municipality.id))

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}?tab=updates`)
    await page.getByLabel('Tipo', { exact: true }).selectOption('sinal')
    await expect(page.getByText('Invasão:', { exact: true })).toBeVisible()
    await expect(page.getByText('Adversário ocupando nosso espaço.')).toBeVisible()
    await expect(page.getByText('Rede esfriou:', { exact: true })).toBeVisible()
    await expect(page.getByText('Adversário apareceu:', { exact: true })).toBeVisible()
    await expect(page.getByText('Alguém pediu algo:', { exact: true })).toBeVisible()
  })
})
