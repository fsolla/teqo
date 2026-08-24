import {
  campaignPageChrome,
  expect,
  test,
  type CampaignE2EFixture,
} from './fixtures/campaignE2EFixtures.js'

test.describe('C143 — demand visibility (explicit responsibles)', () => {
  const setupDemand = async (
    campaign: CampaignE2EFixture,
    fixtures: CampaignE2EFixture['fixtures'],
  ) => {
    const municipality = await fixtures.claimMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora C143'),
    })
    const responsible = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessora Responsável'),
    })
    const peer = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Colega'),
    })
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [responsible.id, peer.id] },
      depth: 0,
    })

    const demand = await fixtures.createCampaignDemand({
      municipality: municipality.id,
      createdBy: coordinator.id,
      responsibles: [responsible.id],
      title: fixtures.value('Demanda de acesso restrito'),
    })

    return { municipality, coordinator, responsible, peer, demand }
  }

  test('hides the demand from a same-municipality advisor who is not responsible', async ({
    campaign,
    context,
    page,
  }) => {
    const { fixtures } = campaign
    const { peer, demand } = await setupDemand(campaign, fixtures)

    await campaign.sessionFor(context, peer)
    await page.goto(`${campaign.baseURL}/campanha/demandas`)
    // The list rendered for him: the empty state proves the page settled
    // (and that the demand is absent — the link assertion below is the
    // fail-closed complement).
    await expect(page.getByText('Nenhuma demanda por aqui')).toBeVisible()
    await expect(page.getByRole('link', { name: demand.title })).toHaveCount(0)

    // The URL does not open either — the demand simply does not exist for him
    // (the default 404 boundary is the root one, no campaign-specific page).
    await page.goto(`${campaign.baseURL}/campanha/demandas/${demand.slug}`)
    await expect(page.getByText('This page could not be found.')).toBeVisible()
  })

  test('lets a responsible hand access to a peer and revoke it again', async ({
    campaign,
    context,
    page,
  }) => {
    const { fixtures } = campaign
    const { peer, responsible, demand } = await setupDemand(campaign, fixtures)
    const demandURL = `${campaign.baseURL}/campanha/demandas/${demand.slug}`

    // The responsible manages the list: add the peer through the search dialog.
    await campaign.sessionFor(context, responsible)
    await page.goto(demandURL)
    await expect(page.getByText('Só quem é responsável vê esta demanda.')).toBeVisible()

    // The trigger announces the current selection (e.g. "…: 1 responsável").
    await page.getByRole('button', { name: /Responsáveis pela demanda/ }).click()
    await page.getByPlaceholder('Buscar assessor…').fill(peer.name)
    await page.getByRole('option', { name: peer.name }).click()
    // The multi-add dialog stays open (modal) — close it before saving.
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Salvar responsáveis' }).click()
    await expect(page.getByText('Responsáveis atualizados.')).toBeVisible()
    await expect(page.getByRole('button', { name: `Remover ${peer.name}` })).toBeVisible()

    // The peer now opens the demand.
    await campaign.sessionFor(context, peer)
    await page.goto(demandURL)
    await expect(campaignPageChrome(page, demand.title)).toBeVisible()

    // Back as the responsible, remove the peer and revoke the access again.
    await campaign.sessionFor(context, responsible)
    await page.goto(demandURL)
    await page.getByRole('button', { name: `Remover ${peer.name}` }).click()
    await page.getByRole('button', { name: 'Salvar responsáveis' }).click()
    await expect(page.getByRole('button', { name: `Remover ${peer.name}` })).toHaveCount(0)

    // The peer already rendered THIS URL (granted, line 88); the Next router
    // cache serves the previous RSC payload on a plain goto even after the
    // cookie swap (OPS83 run #15: the accessible demand showed instead of the
    // 404). The route ignores unknown query params — bust the cache so the
    // revoked access is observed from the server.
    await campaign.sessionFor(context, peer)
    await page.goto(`${demandURL}?e2e=${Date.now()}`)
    await expect(page.getByText('This page could not be found.')).toBeVisible()
  })
})
