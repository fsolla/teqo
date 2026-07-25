import type { Payload } from 'payload'

import { SUPPORTER_REGISTRATION_CONSENT_KEY } from '../../src/utilities/campaignConsent.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * Core municipality-model journeys per role: coordinator strategy editing, advisor
 * scoping, staff declare/estimate privacy boundary, leader lockdown, and staff-only
 * demand workflow.
 */

const ensureSupporterRegistrationConsent = async (campaign: {
  payload: Pick<Payload, 'find' | 'create'>
}) => {
  const existing = await campaign.payload.find({
    collection: 'consent',
    where: { key: { equals: SUPPORTER_REGISTRATION_CONSENT_KEY } },
    depth: 0,
    limit: 1,
    pagination: false,
  })
  if (existing.docs[0]) return existing.docs[0]

  return campaign.payload.create({
    collection: 'consent',
    data: {
      key: SUPPORTER_REGISTRATION_CONSENT_KEY,
      text: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'Consentimento de cadastro de apoiador (E2E).',
                },
              ],
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
    },
    depth: 0,
  })
}

test.describe('Municípios — jornadas por papel', () => {
  test('coordinator opens the municipalities list, edits strategy and assigns an advisor', async ({
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
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()

    // E9 allocation queue: the list opens on the uncovered deficit and exposes
    // the freshness column the ordering is paired with. `exact` keeps this off
    // the table caption, which embeds the same summary plus column glossary.
    await expect(
      page.getByText('Ordenado por déficit da meta (maior primeiro)', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /Ordenar por Frescor do sinal/ }),
    ).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}/editar`)
    await page.getByLabel(`${advisor.name} `, { exact: false }).check()
    await page.getByRole('button', { name: 'Salvar assessores' }).click()
    await expect(page.getByText('Assessores atualizados.')).toBeVisible()

    await page.getByLabel('Pessimista').fill('1000')
    await page.getByLabel('Média').fill('3000')
    await page.getByLabel('Otimista').fill('5000')
    await page.getByRole('button', { name: 'Salvar votos estimados' }).click()
    await expect(page.getByText('Votos estimados atualizados.')).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    // "Conta da cadeira" (E8) shows the saved scenario values through
    // `MunicipalityListExpectedVotesControl` — a compact edit-in-place
    // control whose only always-visible digits are the active scenario
    // (`central`, "3.000" here). The full pessimistic/central/optimistic
    // trio only becomes plain page text via its screen-reader summary
    // (visually a hover-only preview otherwise), so assert against that
    // unique, unambiguous string rather than a bare "5.000" substring —
    // that also matches the (opacity-0 but DOM-visible) hover-preview span.
    await expect(page.getByText('Otimista: 5.000')).toBeVisible()
    await expect(page.getByText(`Assessoria: ${advisor.name}`)).toBeVisible()
  })

  test('advisor scopes municipalities; staff declare and estimate; leader is locked to contacts', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const administered = await fixtures.claimMunicipality()
    const outside = await fixtures.claimMunicipality()

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
      collection: 'municipality',
      id: administered.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(administered.id)

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
        municipalities: [administered.id],
        supportStatus: 'engajado',
        user: leaderAccount.id,
      },
      depth: 0,
    })

    await ensureSupporterRegistrationConsent(campaign)

    // Advisor scope: only the administered municipality shows up.
    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(
      page.getByRole('link', { name: administered.name, exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: outside.name, exact: true })).toHaveCount(0)

    // Staff declare votes on behalf of the leadership.
    await page.goto(`${campaign.baseURL}/campanha/municipios/${administered.slug}?tab=leaderships`)
    await expect(page.getByRole('link', { name: contact.name })).toBeVisible()
    await page.getByLabel('Quantos votos a liderança traz neste município?').fill('250')
    await page.getByRole('button', { name: 'Declarar' }).click()
    await expect(page.getByText('Declaração de votos registrada.')).toBeVisible()

    // Advisor records an internal estimate on the overview pledges panel.
    await page.goto(`${campaign.baseURL}/campanha/municipios/${administered.slug}`)
    await page.getByLabel('Média').fill('90')
    await page.getByLabel('Justificativa').fill('Histórico da região indica menos.')
    await page.getByRole('button', { name: 'Salvar estimativa' }).click()
    await expect(page.getByText('Média: 90')).toBeVisible()

    // Leader home is the contact tool; municipalities redirect away.
    await campaign.login(page, leaderPhone, password)
    await page.goto(`${campaign.baseURL}/campanha`)
    await expect(page.getByText('Cadastre apoiadores pelo celular.')).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha`)

    const supporterName = fixtures.value('Apoiador Liderança')
    const supporterPhone = fixtures.phone()
    await page.getByLabel('Nome *').fill(supporterName)
    await page.getByLabel('Celular *').fill(supporterPhone)
    await page.getByLabel('A pessoa autorizou o cadastro *').check()
    await page.getByRole('button', { name: 'Cadastrar contato' }).click()
    await expect(page.getByText(supporterName)).toBeVisible()

    expect(leadership.id).toBeGreaterThan(0)
  })

  test('advisor opens a demand and decides it', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const municipality = await fixtures.claimMunicipality()

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
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const demandTitle = fixtures.value('Carro de som')

    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/demandas/nova`)
    await page.getByLabel('O que você precisa?').fill(demandTitle)
    await page.getByLabel('Município').selectOption({ label: municipality.name })
    await page.getByLabel('Detalhe a necessidade').fill('Precisamos para a caminhada de sábado.')
    await page.getByRole('button', { name: 'Abrir demanda' }).click()
    await expect(page.getByRole('heading', { name: demandTitle })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprovar' })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/demandas`)
    await page.getByRole('link', { name: demandTitle }).click()
    await page.getByLabel('Nota da decisão').fill('Aprovado — retirar no comitê.')
    await page.getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('Esta demanda já foi decidida.')).toBeVisible()
    await expect(page.getByText('Aprovada', { exact: true })).toBeVisible()
  })
})
