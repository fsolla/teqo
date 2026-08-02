import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
<<<<<<< HEAD
 * OH9/OH11 — dual-path municipality detail + full offline journey. Requires
 * `OPS_HYBRID=1` on the Playwright webServer (compile-time). Default CI keeps
 * the flag off so characterization / municipalities specs continue to pin the
 * RSC path.
=======
 * OH9 / OH12 — dual-path municipality detail + list. Requires `OPS_HYBRID=1` on
 * the Playwright webServer (compile-time). Default CI keeps the flag off so
 * characterization / municipalities specs continue to pin the RSC path.
>>>>>>> c9e3e84f (OH12: OpsListLocal read-only via registry + OfflineBoundary on lists)
 */
const opsHybridEnabled =
  process.env.OPS_HYBRID === '1' || process.env.OPS_HYBRID?.toLowerCase() === 'true'

test.describe('OH9/OH11 campaign ops offline (OPS_HYBRID)', () => {
  test.skip(!opsHybridEnabled, 'Set OPS_HYBRID=1 on the e2e webServer to run this dual-path.')

  test('offline swaps to Local header + pledges with honest online-only placeholder', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor OH9'),
    })
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const { leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança OH9',
      municipalities: [municipality],
      supportStatus: 'engajado',
    })
    await campaign.payload.create({
      collection: 'votePledge',
      data: {
        leadership: leadershipId,
        municipality: municipality.id,
        declaredVotes: 90,
      },
      depth: 0,
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    // Wait for ops-sync so the mirror has this município before airplane mode.
    await page.waitForResponse(
      (response) =>
        response.url().includes('/campanha/api/ops-sync') && response.request().method() === 'GET',
      { timeout: 30_000 },
    )

    await page.context().setOffline(true)

    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()
    await expect(page.getByText('Assessoria: indisponível offline')).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Votos declarados pelas lideranças' }),
    ).toBeVisible()
    await expect(page.getByText('Disponível quando estiveres online.')).toBeVisible()
    // Tab nav is RSC-only — Local path must not crash by remounting it.
    await expect(page.getByRole('link', { name: 'Visão geral' })).toHaveCount(0)
  })

  test('open → sync → offline detail → write → reload → online → sync', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor OH11'),
    })
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const { leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança OH11',
      municipalities: [municipality],
      supportStatus: 'engajado',
    })
    await campaign.payload.create({
      collection: 'votePledge',
      data: {
        leadership: leadershipId,
        municipality: municipality.id,
        declaredVotes: 75,
      },
      depth: 0,
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    await page.waitForResponse(
      (response) =>
        response.url().includes('/campanha/api/ops-sync') && response.request().method() === 'GET',
      { timeout: 30_000 },
    )

    await page.context().setOffline(true)

    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()
    await page.getByLabel('Média', { exact: true }).fill('42')
    await page.getByLabel('Justificativa').fill('OH11 offline na estrada.')
    await page.getByRole('button', { name: 'Salvar estimativa' }).click()
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible()

    await page.context().setOffline(false)
    await expect(page.getByText('Média: 42')).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('OH12 municipality list Local (OPS_HYBRID)', () => {
  test.skip(!opsHybridEnabled, 'Set OPS_HYBRID=1 on the e2e webServer to run this dual-path.')

  test('offline list renders mirror rows and filters by ?q=', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor OH12'),
    })
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page.getByRole('heading', { name: 'Municípios' })).toBeVisible()

    await page.waitForResponse(
      (response) =>
        response.url().includes('/campanha/api/ops-sync') && response.request().method() === 'GET',
      { timeout: 30_000 },
    )

    await page.context().setOffline(true)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )

    await expect(page.getByRole('heading', { name: 'Municípios' })).toBeVisible()
    await expect(
      page.getByText('Edição na lista disponível quando estiveres online.'),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: municipality.name })).toBeVisible()
    await expect(page.getByText('Indicadores indisponíveis offline.')).toBeVisible()
  })
})
