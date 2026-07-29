import { expect, test } from './fixtures/campaignE2EFixtures.js'

const staffActionLabels = [
  'Atualizar votos de um município',
  'Registrar o que aconteceu',
  'Mudar tendência',
  'Atualizar liderança',
  'Registrar pedido',
  'Ver quem ainda não está coberto',
] as const

test.describe('Início — catálogo de ações (B45)', () => {
  test('staff sees six home actions and can open municipalities without coverage', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await expect(
      page.getByRole('heading', { name: 'O que você quer fazer?', exact: true }),
    ).toBeVisible()

    for (const label of staffActionLabels) {
      const link = page.getByRole('link', { name: label, exact: true })
      const button = page.getByRole('button', { name: label, exact: true })
      await expect(link.or(button)).toBeVisible()
    }

    await page.getByRole('link', { name: 'Ver quem ainda não está coberto', exact: true }).click()
    await page.waitForURL(/\/campanha\/municipios/)
    const url = new URL(page.url())
    expect(url.searchParams.get('coverage')).toBe('sem_assessor')
    expect(url.searchParams.get('sort')).toBe('votos')
  })

  test('leader sees two home actions and can open contacts', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança'),
    })

    await campaign.login(page, leader.email!, leader.password)
    await expect(
      page.getByRole('heading', { name: 'O que você quer fazer?', exact: true }),
    ).toBeVisible()

    await expect(
      page.getByRole('button', { name: 'Cadastrar apoiador', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver meus contatos', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Ver meus contatos', exact: true }).click()
    await page.waitForURL(/\/campanha\/contatos/)
    await expect(page.getByRole('heading', { name: /Meus contatos/ })).toBeVisible()
  })
})
