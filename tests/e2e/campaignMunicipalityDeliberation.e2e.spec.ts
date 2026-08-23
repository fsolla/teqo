import type { Page } from '@playwright/test'

import type { CampaignUser } from '../../src/payload-types.js'
import {
  expect,
  mintCampaignSession,
  seedCampaignSession,
  test,
  type CampaignE2EFixture,
} from './fixtures/campaignE2EFixtures.js'

const DESKTOP_VIEWPORT = { width: 1280, height: 900 }

const settleStream = (page: Page) =>
  page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0, undefined, {
    timeout: 15_000,
  })

type DeliberationSeed = {
  coordinator: CampaignUser & { password: string }
  advisor: CampaignUser & { password: string }
  updateId: number
  /** Unique per test — parallel workers share the feed page (fullyParallel). */
  marker: string
}

const seedDeliberation = async (campaign: CampaignE2EFixture): Promise<DeliberationSeed> => {
  const { fixtures } = campaign
  const coordinator = await fixtures.createCampaignUser('coordinator')
  const advisor = await fixtures.createCampaignUser('advisor')
  const municipality = await fixtures.claimMunicipality()
  await fixtures.payload.update({
    collection: 'municipality',
    id: municipality.id,
    data: { advisors: [advisor.id] },
    depth: 0,
  })
  const marker = fixtures.value('deliberado')
  const update = await fixtures.payload.create({
    collection: 'municipalityUpdate',
    data: {
      municipality: municipality.id,
      author: coordinator.id,
      polarity: 'ruim',
      urgent: true,
      body: `Fato ${marker} em ${municipality.name}`,
    },
    depth: 0,
  })
  return { coordinator, advisor, updateId: update.id, marker }
}

const openFeedAs = async (
  campaign: CampaignE2EFixture,
  context: Parameters<typeof seedCampaignSession>[0],
  user: CampaignUser & { password: string },
  page: Page,
) => {
  const token = await mintCampaignSession(campaign.payload, user)
  await seedCampaignSession(context, campaign.baseURL, token)
  await page.setViewportSize(DESKTOP_VIEWPORT)
  await page.goto(`${campaign.baseURL}/campanha/atualizacoes`)
  await settleStream(page)
}

test.describe('C88 — deliberação na atualização', () => {
  test.setTimeout(120_000)

  test('coordinator assigns, comments, resolves and reopens; advisor only comments', async ({
    campaign,
    context,
    page,
  }) => {
    const { coordinator, advisor, updateId, marker } = await seedDeliberation(campaign)
    const card = page.locator(`li:has-text("Fato ${marker}")`).first()

    await openFeedAs(campaign, context, coordinator, page)
    await expect(card.getByText('Em deliberação')).toBeHidden()

    // Assign the advisor as responsible.
    await card.getByLabel('Responsável').selectOption(String(advisor.id))
    await card.getByRole('button', { name: 'Definir' }).click()
    await expect(card.getByText('Responsável definido.')).toBeVisible()
    await expect(card.getByText('Em deliberação')).toBeVisible()

    // Comment on the thread.
    await card
      .getByRole('textbox', { name: 'Escrever comentário…' })
      .fill('Confirmo a visita para sexta.')
    await card.getByRole('button', { name: 'Comentar' }).click()
    await expect(card.getByText('Comentário registrado.')).toBeVisible()
    await expect(card.getByText('Confirmo a visita para sexta.')).toBeVisible()

    // Resolve: badge flips, thread stays readable, composer hides, Reabrir shows.
    await card.getByRole('button', { name: 'Marcar como resolvido' }).click()
    await expect(card.getByText('Atualização marcada como resolvida.')).toBeVisible()
    await expect(card.getByText('Resolvido', { exact: true })).toBeVisible()
    await expect(card.getByText(/Resolvido por/)).toBeVisible()
    await expect(card.getByText('Confirmo a visita para sexta.')).toBeVisible()
    await expect(card.getByRole('textbox', { name: 'Escrever comentário…' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Reabrir' })).toBeVisible()

    // Reopen: back to open deliberation.
    await card.getByRole('button', { name: 'Reabrir' }).click()
    await expect(card.getByText('Atualização reaberta.')).toBeVisible()
    await expect(card.getByText('Em deliberação')).toBeVisible()

    // Advisor: read-only on assign/resolve, comments as themselves.
    const advisorPage = await context.newPage()
    await openFeedAs(campaign, context, advisor, advisorPage)
    const advisorCard = advisorPage.locator(`li:has-text("Fato ${marker}")`).first()
    await expect(advisorCard.getByText('Em deliberação')).toBeVisible()
    await expect(advisorCard.getByText(`Responsável: ${advisor.name}`)).toBeVisible()
    await expect(advisorCard.getByLabel('Responsável')).toHaveCount(0)
    await expect(advisorCard.getByRole('button', { name: 'Marcar como resolvido' })).toHaveCount(0)
    await advisorCard
      .getByRole('textbox', { name: 'Escrever comentário…' })
      .fill('Vou verificar no território.')
    await advisorCard.getByRole('button', { name: 'Comentar' }).click()
    await expect(advisorCard.getByText('Vou verificar no território.').first()).toBeVisible()
    await advisorPage.close()

    // The server enforced everything: the update is still open with both comments.
    const reloaded = await campaign.payload.findByID({
      collection: 'municipalityUpdate',
      id: updateId,
      depth: 0,
      overrideAccess: true,
    })
    expect(reloaded.resolvedAt).toBeNull()
    expect(reloaded.comments?.map((comment) => comment.body)).toEqual([
      'Confirmo a visita para sexta.',
      'Vou verificar no território.',
    ])
  })

  test('leader never reaches the thread (lockdown keeps the feed page away)', async ({
    campaign,
    context,
    page,
  }) => {
    const { coordinator } = await seedDeliberation(campaign)
    const leader = await campaign.fixtures.createCampaignUser('leader')
    const municipality = await campaign.fixtures.claimMunicipality()
    await campaign.fixtures.payload.create({
      collection: 'municipalityUpdate',
      data: {
        municipality: municipality.id,
        author: coordinator.id,
        polarity: 'neutra',
        body: 'Fato C88 para a liderança não ver.',
      },
      depth: 0,
    })

    const token = await mintCampaignSession(campaign.payload, leader)
    await seedCampaignSession(context, campaign.baseURL, token)
    await page.goto(`${campaign.baseURL}/campanha/atualizacoes`)
    await expect(page).toHaveURL(/\/campanha\/meus-contatos/, { timeout: 20_000 })
  })
})
