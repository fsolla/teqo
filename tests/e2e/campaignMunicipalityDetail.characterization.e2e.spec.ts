import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * OH8 — characterization pins for `/campanha/municipios/[slug]`: header chrome,
 * default tab, pledges panel (staff estimate form), and the `/editar` affordance.
 * Leaders never reach this route — the noLeader gate sends them to `/campanha/contatos`.
 */

test.describe('Município detalhe — caracterização (OH8)', () => {
  test('staff sees header, overview tab, pledges panel, and edit link', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador OH8'),
    })
    const municipality = await fixtures.claimMunicipality()

    const { leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança OH8',
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

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    const overviewTab = page.getByRole('link', { name: 'Visão geral' })
    await expect(overviewTab).toHaveAttribute('aria-current', 'page')

    const pledgesPanel = page.getByRole('region', { name: 'Votos declarados pelas lideranças' })
    await expect(pledgesPanel).toBeVisible()
    await expect(pledgesPanel.getByRole('button', { name: 'Salvar estimativa' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `/campanha/municipios/${municipality.slug}/editar`,
    )
  })

  test('leader is locked out of municipality detail (no edit link)', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()
    const leaderPhone = fixtures.phone()
    const leaderAccount = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança OH8'),
      username: leaderPhone,
    })

    await campaign.login(page, leaderPhone, leaderAccount.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`).catch(() => {})
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/contatos`)
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0)
  })
})
