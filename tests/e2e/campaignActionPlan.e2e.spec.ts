import { expect, test } from './fixtures/campaignE2EFixtures.js'

test.describe('Planos de ação — registro-fundação', () => {
  test.setTimeout(90_000)

  test('registra origem, cria demandas vinculadas e exibe a explicação dos sinais', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const coordinator = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Geral'),
        email: `${fixtures.value('coordinator')}@example.com`,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })
    const municipality = await fixtures.claimMunicipality()
    const planTitle = fixtures.value('Giro territorial')
    const transportDemand = fixtures.value('Transporte para equipe')
    const materialDemand = fixtures.value('Material de rua')

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/planos/novo`)

    await page.getByLabel('Título *').fill(planTitle)
    await page.getByLabel('Tipo de ação *').selectOption('caminhada')
    await page.getByLabel('Origem da ação').selectOption('obrigacao_politica')
    await page.getByLabel('Município *').selectOption(String(municipality.id))

    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 1').fill(transportDemand)
    await page.getByLabel('Tipo da demanda 1').selectOption('transporte')
    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 2').fill(materialDemand)
    await page.getByLabel('Tipo da demanda 2').selectOption('material')

    await page.getByRole('button', { name: 'Criar plano' }).click()
    await expect(page).toHaveURL(/\/campanha\/planos\/[^/?]+$/)
    await expect(page.getByRole('heading', { name: planTitle })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Obrigação política', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: transportDemand })).toBeVisible()
    await expect(page.getByRole('link', { name: materialDemand })).toBeVisible()

    await page.getByRole('link', { name: 'Adicionar demanda' }).click()
    await expect(page.getByLabel('Plano de ação relacionado')).toHaveValue(/\d+/)
    await expect(page.getByLabel('Município')).toHaveValue(String(municipality.id))

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}?tab=updates`)
    await page.getByLabel('Tipo', { exact: true }).selectOption('sinal')
    await expect(page.getByText('Invasão:', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Adversário ocupando ou ganhando espaço antes dominado pela campanha.'),
    ).toBeVisible()
    await expect(page.getByText('Esfriamento:', { exact: true })).toBeVisible()
    await expect(page.getByText('Visita adversária:', { exact: true })).toBeVisible()
    await expect(page.getByText('Proposta a broker:', { exact: true })).toBeVisible()
  })
})
