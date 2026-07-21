import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * Core Praça-model journeys per role: coordinator strategy editing, advisor
 * scoping, the declared-vs-estimated privacy boundary, and the demand
 * workflow. Replaces the nucleus-era campaign E2E suites.
 */

test.describe('Praças — jornadas por papel', () => {
  test('coordinator opens the plazas list, edits strategy and assigns an advisor', async ({
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
    const advisor = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Assessor Regional'),
        email: `${fixtures.value('advisor')}@example.com`,
        password,
        role: 'advisor',
      },
      depth: 0,
    })
    const plaza = await fixtures.claimPlaza()

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/pracas`)
    await expect(page.getByRole('heading', { name: 'Praças', exact: true })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/pracas/${plaza.slug}`)
    await expect(page.getByRole('heading', { name: plaza.name })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/pracas/${plaza.slug}/editar`)
    await page.getByLabel(`${advisor.name} `, { exact: false }).check()
    await page.getByRole('button', { name: 'Salvar assessores' }).click()
    await expect(page.getByText('Assessores atualizados.')).toBeVisible()

    await page.getByLabel('Meta Bom').fill('5000')
    await page.getByLabel('Meta Regular').fill('3000')
    await page.getByLabel('Meta Mínimo').fill('1000')
    await page.getByRole('button', { name: 'Salvar estratégia' }).click()
    await expect(page.getByText('Estratégia atualizada.')).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/pracas/${plaza.slug}`)
    await expect(page.getByText('5.000')).toBeVisible()
    await expect(page.getByText(`Assessoria: ${advisor.name}`)).toBeVisible()
  })

  test('advisor sees only administered plazas; leader declares votes and never sees the estimate', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const administered = await fixtures.claimPlaza()
    const outside = await fixtures.claimPlaza()

    const advisor = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Assessora'),
        email: `${fixtures.value('advisor')}@example.com`,
        password,
        role: 'advisor',
      },
      depth: 0,
    })
    await campaign.payload.update({
      collection: 'plaza',
      id: administered.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchPlaza(administered.id)

    const leaderPhone = fixtures.phone()
    const leaderAccount = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Liderança'),
        username: leaderPhone,
        password,
        role: 'leader',
      },
      depth: 0,
    })
    const contact = await campaign.payload.create({
      collection: 'contact',
      data: {
        name: fixtures.value('Contato Liderança'),
        phone: leaderPhone,
        state: 'BA',
        city: administered.name,
      },
      depth: 0,
    })
    const leadership = await campaign.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        plazas: [administered.id],
        supportStatus: 'engajado',
        user: leaderAccount.id,
      },
      depth: 0,
    })

    // Advisor scope: only the administered plaza shows up.
    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/pracas`)
    await expect(
      page.getByRole('link', { name: administered.name, exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: outside.name, exact: true })).toHaveCount(0)

    // Leader declares votes on their plaza.
    await campaign.login(page, leaderPhone, password)
    await page.goto(`${campaign.baseURL}/campanha/pracas/${administered.slug}`)
    await page.getByLabel('Quantos votos você está trazendo nesta Praça?').fill('250')
    await page.getByRole('button', { name: 'Declarar' }).click()
    await expect(page.getByText('Declaração de votos registrada.')).toBeVisible()

    // Advisor records an internal estimate (revalidation remounts the form, so
    // assert the persisted badge instead of the transient success message).
    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/pracas/${administered.slug}`)
    await expect(page.getByText(contact.name)).toBeVisible()
    await page.getByLabel('Estimativa do assessor').fill('90')
    await page.getByLabel('Justificativa').fill('Histórico da região indica menos.')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Estimado: 90')).toBeVisible()

    // The leader keeps seeing only their own declared number — never the 90.
    await campaign.login(page, leaderPhone, password)
    await page.goto(`${campaign.baseURL}/campanha/pracas/${administered.slug}`)
    const leaderHtml = await page.content()
    expect(leaderHtml).toContain('250')
    expect(leaderHtml).not.toContain('Estimativa do assessor')
    expect(leaderHtml).not.toContain('Histórico da região indica menos.')
    await expect(page.getByLabel('Quantos votos você está trazendo nesta Praça?')).toHaveValue(
      '250',
    )

    expect(leadership.id).toBeGreaterThan(0)
  })

  test('leader opens a demand and the advisor decides it', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const plaza = await fixtures.claimPlaza()

    const advisor = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Assessor Demandas'),
        email: `${fixtures.value('advisor')}@example.com`,
        password,
        role: 'advisor',
      },
      depth: 0,
    })
    await campaign.payload.update({
      collection: 'plaza',
      id: plaza.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchPlaza(plaza.id)

    const leaderPhone = fixtures.phone()
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Liderança Demandante'),
        username: leaderPhone,
        password,
        role: 'leader',
      },
      depth: 0,
    })
    const leaderAccount = await campaign.payload.find({
      collection: 'campaignUser',
      where: { username: { equals: leaderPhone } },
      depth: 0,
      limit: 1,
    })
    const contact = await campaign.payload.create({
      collection: 'contact',
      data: {
        name: fixtures.value('Contato Demandante'),
        phone: leaderPhone,
        state: 'BA',
        city: plaza.name,
      },
      depth: 0,
    })
    await campaign.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        plazas: [plaza.id],
        supportStatus: 'engajado',
        user: leaderAccount.docs[0]!.id,
      },
      depth: 0,
    })

    const demandTitle = fixtures.value('Carro de som')

    await campaign.login(page, leaderPhone, password)
    await page.goto(`${campaign.baseURL}/campanha/demandas/nova`)
    await page.getByLabel('O que você precisa?').fill(demandTitle)
    await page.getByLabel('Praça').selectOption({ label: plaza.name })
    await page.getByLabel('Detalhe a necessidade').fill('Precisamos para a caminhada de sábado.')
    await page.getByRole('button', { name: 'Abrir demanda' }).click()
    await expect(page.getByRole('heading', { name: demandTitle })).toBeVisible()
    await expect(page.getByText('aguarda análise da assessoria')).toBeVisible()

    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/demandas`)
    await page.getByRole('link', { name: demandTitle }).click()
    await page.getByLabel('Nota da decisão').fill('Aprovado — retirar no comitê.')
    await page.getByRole('button', { name: 'Aprovar' }).click()
    // Revalidation remounts the workflow card — assert the persisted decision.
    await expect(page.getByText('Esta demanda já foi decidida.')).toBeVisible()
    await expect(page.getByText('Aprovada', { exact: true })).toBeVisible()

    await campaign.login(page, leaderPhone, password)
    await page.goto(`${campaign.baseURL}/campanha/demandas`)
    await page.getByRole('link', { name: demandTitle }).click()
    await expect(page.getByText('Aprovada', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Aprovado — retirar no comitê.')).toBeVisible()
  })
})
