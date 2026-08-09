import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
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

    // C90 — the unified polymorphic selector replaces the old Contact
    // responsável + assessores/liderança fields.
    await expect(page.getByRole('button', { name: /Responsáveis: Nenhum/ })).toBeVisible()
    await expect(page.getByText('Assessores responsáveis')).toHaveCount(0)

    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 1').fill(transportDemand)
    await page.getByLabel('Tipo da demanda 1').selectOption('transporte')
    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 2').fill(materialDemand)
    await page.getByLabel('Tipo da demanda 2').selectOption('material')

    await page.getByRole('button', { name: 'Criar atividade' }).click()
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
    // Unified C87 surface: body + polarity + urgent + adversary signal, no
    // legacy kind/signal-type navigation.
    await expect(page.getByLabel('Texto da atualização')).toBeVisible()
    await expect(page.getByLabel('Polaridade')).toBeVisible()
    await expect(page.getByLabel('Sinalizar como urgente')).toBeVisible()
    await expect(page.getByLabel('Sinalizar adversário')).toBeVisible()
    await expect(page.getByLabel('Tipo', { exact: true })).toHaveCount(0)
  })
})

test.describe('Agenda — calendário operacional', () => {
  test.setTimeout(90_000)

  test('abre a semana, combina filtros e navega para o detalhe', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Comício na agenda')
    const civilDate = formatBahiaCivilDate(new Date())
    const startAt = parseBahiaDateTimeInput(`${civilDate}T10:00`)
    if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')

    const activity = await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title,
        tags: ['Comício'],
        status: 'confirmado',
        deputyPresent: true,
        startAt,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: /semana/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /mês/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /lista/i })).toBeVisible()

    const eventLink = page.getByRole('link', { name: new RegExp(title) })
    const eventBox = await eventLink.boundingBox()
    if (!eventBox) throw new Error('O compromisso não expôs área arrastável.')
    await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2 + 60, {
      steps: 20,
    })
    await page.mouse.up()
    await expect(page.getByText('Horário atualizado.')).toBeVisible()
    await expect
      .poll(async () => {
        const persisted = await fixtures.payload.findByID({
          collection: 'activity',
          id: activity.id,
          depth: 0,
        })
        return persisted.startAt
      })
      .not.toBe(startAt)

    const omniboxInput = page.getByRole('combobox', { name: 'Filtrar agenda' })

    await omniboxInput.click()
    await omniboxInput.fill(municipality.name!)
    await page.getByRole('option', { name: municipality.name, exact: true }).click()

    await omniboxInput.click()
    await omniboxInput.fill('Comício')
    await page.getByRole('option', { name: 'Comício', exact: true }).click()

    await omniboxInput.click()
    await page.getByRole('option', { name: 'Deputado presente', exact: true }).click()

    await expect(page).toHaveURL(
      `${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}&deputyPresent=1&tag=Com%C3%ADcio`,
    )
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    // B167: when the viewport shrinks to mobile, a chat that was open on the
    // desktop panel migrates to the open full-screen drawer — which would cover
    // the agenda. Close it first so this mobile-layout step is unobstructed.
    await page
      .getByRole('button', { name: 'Fechar', exact: true })
      .filter({ visible: true })
      .click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('tab', { name: /lista/i }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await page.getByText(title, { exact: true }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/)
    await expect(campaignPageChrome(page, title)).toBeVisible()
  })

  test('cria compromisso inline no slot clicado, sem sair da agenda', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Café inline na agenda')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    const dayCell = page.getByRole('gridcell').nth(1)
    await dayCell.scrollIntoViewIfNeeded()
    const [slotBox, dayBox] = await Promise.all([
      page.locator('[data-time="14:00:00"]').last().boundingBox(),
      dayCell.boundingBox(),
    ])
    if (!slotBox || !dayBox) throw new Error('A grade semanal não expôs o slot esperado.')
    await dayCell.click({
      position: {
        x: dayBox.width / 2,
        y: slotBox.y - dayBox.y + slotBox.height / 2,
      },
    })

    // The click no longer navigates: the inline overlay opens at the slot.
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
    const startInput = page.getByLabel('Início *')
    await expect(startInput).toBeVisible()
    const [startValue, endValue] = await Promise.all([
      startInput.inputValue(),
      page.getByLabel('Término').inputValue(),
    ])
    const [startAt, endAt] = [startValue, endValue].map(parseBahiaDateTimeInput)
    expect(startAt).not.toBeNull()
    expect(endAt).not.toBeNull()
    if (!startAt || !endAt) throw new Error('O overlay não recebeu o intervalo do slot.')
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(1_800_000)
    await expect(page.getByLabel('Município *')).toHaveValue(municipality.name)

    await page.getByLabel('Título *').fill(title)
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
  })

  test('"Mais detalhes" pré-preenche o formulário completo com o rascunho', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Detalhes inline da agenda')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    const dayCell = page.getByRole('gridcell').nth(1)
    await dayCell.scrollIntoViewIfNeeded()
    const [slotBox, dayBox] = await Promise.all([
      page.locator('[data-time="14:00:00"]').last().boundingBox(),
      dayCell.boundingBox(),
    ])
    if (!slotBox || !dayBox) throw new Error('A grade semanal não expôs o slot esperado.')
    await dayCell.click({
      position: {
        x: dayBox.width / 2,
        y: slotBox.y - dayBox.y + slotBox.height / 2,
      },
    })

    await expect(page.getByLabel('Título *')).toBeVisible()
    await page.getByLabel('Título *').fill(title)
    await page.getByRole('link', { name: 'Mais detalhes' }).click()

    await expect(page).toHaveURL(/\/campanha\/atividades\/nova\?startAt=/)
    await expect(page.getByLabel('Título *')).toHaveValue(title)
    await expect(page.getByLabel('Município *')).toHaveValue(String(municipality.id))
    const [startValue, endValue] = await Promise.all([
      page.getByLabel('Início *').inputValue(),
      page.getByLabel('Término').inputValue(),
    ])
    const [startAt, endAt] = [startValue, endValue].map(parseBahiaDateTimeInput)
    expect(startAt).not.toBeNull()
    expect(endAt).not.toBeNull()
    if (!startAt || !endAt) throw new Error('O formulário não recebeu o intervalo do slot.')
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(1_800_000)
  })
})
