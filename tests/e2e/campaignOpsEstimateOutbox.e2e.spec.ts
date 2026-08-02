import { expect, test } from './fixtures/campaignE2EFixtures.js'

/** Offline specs intentionally hit blocked network resources — allowlist for the guard. */
test.use({ expectedRequestFailurePaths: ['/campanha/api/ops-sync', '/favicon.ico'] })

/** OH6 — flaky-network outbox for estimateVotes. */
test.describe('OH6 estimate outbox', () => {
  test('offline edit stays queued across reload and flushes when online', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Outbox'),
    })
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const { leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Outbox',
      municipalities: [municipality],
      supportStatus: 'engajado',
    })
    await campaign.payload.create({
      collection: 'votePledge',
      data: {
        leadership: leadershipId,
        municipality: municipality.id,
        declaredVotes: 120,
      },
      depth: 0,
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)

    await page.waitForResponse(
      (response) =>
        response.url().includes('/campanha/api/ops-sync') && response.request().method() === 'GET',
      { timeout: 30_000 },
    )

    await page.context().setOffline(true)
    await page.getByLabel('Média', { exact: true }).fill('55')
    await page.getByLabel('Justificativa').fill('Editado na estrada.')
    await page.getByRole('button', { name: 'Salvar estimativa' }).click()
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible()

    await page.context().setOffline(false)
    await expect(page.getByText('Média: 55')).toBeVisible({ timeout: 30_000 })
  })
})
