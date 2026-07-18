// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { loadNucleusListOverviewData } from '@/utilities/nucleusListOverviewPageData'
import { parseNucleusListParams } from '@/utilities/nucleusUi'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign nucleus list overview page data', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('aggregates the full filtered set for geral and previews recent updates', async () => {
    const fixtures = campaignFixtures()
    const general = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Geral overview'),
      email: `${fixtures.value('geral-overview')}@example.com`,
      password: fixtures.value('password'),
    })
    const author = await fixtures.createCampaignUser('coordenador', {
      name: fixtures.value('Autor overview'),
      email: `${fixtures.value('autor-overview')}@example.com`,
      password: fixtures.value('password'),
    })

    const filteredA = await fixtures.createNucleus({
      name: fixtures.value('Overview A'),
      region: 'Velho Chico',
      city: 'Bom Jesus da Lapa',
      coordinators: [author.id],
      organizationKind: 'territorial',
    })
    const filteredB = await fixtures.createNucleus({
      name: fixtures.value('Overview B'),
      region: 'Velho Chico',
      city: 'Bom Jesus da Lapa',
      organizationKind: 'territorial',
    })
    const outside = await fixtures.createNucleus({
      name: fixtures.value('Overview fora'),
      region: 'Metropolitano de Salvador',
      city: 'Salvador',
      organizationKind: 'territorial',
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: filteredA.id,
      data: {
        confirmedVoteEstimate: 1000,
        proposedVoteEstimate: 1100,
      },
      depth: 0,
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: filteredB.id,
      data: {
        proposedVoteEstimate: 400,
      },
      depth: 0,
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: outside.id,
      data: {
        confirmedVoteEstimate: 9999,
        proposedVoteEstimate: 8888,
      },
      depth: 0,
    })

    await fixtures.createNucleusUpdate({
      nucleus: filteredA.id,
      author: author.id,
      kind: 'semanal',
      worked: 'Campo',
      failed: 'Nada',
      needs: 'Apoio',
    })
    await fixtures.createNucleusUpdate({
      nucleus: outside.id,
      author: general.id,
      kind: 'urgente',
      body: 'Fora do filtro',
    })

    const view = await loadNucleusListOverviewData(
      payload,
      general,
      parseNucleusListParams({ region: 'Velho Chico' }),
    )

    expect(view).not.toBeNull()
    if (!view) throw new Error('Expected overview view model')
    expect(view.totalFiltered).toBe(2)
    expect(view.estimate.confirmedTotal).toBe(1000)
    expect(view.estimate.confirmedCount).toBe(1)
    expect(view.estimate.pendingSuggestionsCount).toBe(2)
    expect(view.coverage.coordinatedCount).toBe(1)
    expect(view.recentUpdates).toHaveLength(1)
    expect(view.recentUpdates[0]?.nucleusSlug).toBe(filteredA.slug)
    expect(view.recentUpdates[0]?.authorName).toBe(author.name)
    expect(view.recentUpdates[0]?.kind).toBe('semanal')
  })

  it('scopes coordenador to assigned nuclei only', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordenador', {
      name: fixtures.value('Coord overview'),
      email: `${fixtures.value('coord-overview')}@example.com`,
      password: fixtures.value('password'),
    })
    const otherCoordinator = await fixtures.createCampaignUser('coordenador', {
      name: fixtures.value('Outro coord'),
      email: `${fixtures.value('outro-coord')}@example.com`,
      password: fixtures.value('password'),
    })

    const assigned = await fixtures.createNucleus({
      name: fixtures.value('Atribuído overview'),
      region: 'Metropolitano de Salvador',
      city: 'Salvador',
      coordinators: [coordinator.id],
      organizationKind: 'territorial',
    })
    const other = await fixtures.createNucleus({
      name: fixtures.value('Não atribuído'),
      region: 'Metropolitano de Salvador',
      city: 'Salvador',
      coordinators: [otherCoordinator.id],
      organizationKind: 'territorial',
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: assigned.id,
      data: { confirmedVoteEstimate: 700 },
      depth: 0,
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: other.id,
      data: { confirmedVoteEstimate: 5000, proposedVoteEstimate: 6000 },
      depth: 0,
    })

    const view = await loadNucleusListOverviewData(payload, coordinator, parseNucleusListParams({}))

    expect(view).not.toBeNull()
    if (!view) throw new Error('Expected overview view model')
    expect(view.totalFiltered).toBe(1)
    expect(view.estimate.confirmedTotal).toBe(700)
    expect(view.estimate.pendingSuggestionsCount).toBe(0)
  })

  it('shows lideranca only own updates and omits pending suggestions', async () => {
    const fixtures = campaignFixtures()
    const general = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Geral lideranca overview'),
      email: `${fixtures.value('geral-lideranca-overview')}@example.com`,
      password: fixtures.value('password'),
    })
    const leader = await fixtures.createCampaignUser('lideranca', {
      name: fixtures.value('Liderança overview'),
    })
    const staffAuthor = await fixtures.createCampaignUser('coordenador', {
      name: fixtures.value('Staff autor'),
      email: `${fixtures.value('staff-autor')}@example.com`,
      password: fixtures.value('password'),
    })

    const nucleus = await fixtures.createNucleus({
      name: fixtures.value('Núcleo liderança'),
      region: 'Metropolitano de Salvador',
      city: 'Salvador',
      coordinators: [staffAuthor.id],
      organizationKind: 'territorial',
    })
    const contact = await fixtures.createContact({
      name: fixtures.value('Contato liderança'),
    })
    await fixtures.createLeadership({
      contact,
      nucleus: nucleus.id,
      user: leader.id,
      supportStatus: 'engajado',
      createdBy: general.id,
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: {
        confirmedVoteEstimate: 450,
        proposedVoteEstimate: 500,
      },
      depth: 0,
    })

    await fixtures.createNucleusUpdate({
      nucleus: nucleus.id,
      author: leader.id,
      kind: 'nota',
      body: 'Meu reporte',
    })
    await fixtures.createNucleusUpdate({
      nucleus: nucleus.id,
      author: staffAuthor.id,
      kind: 'urgente',
      body: 'Reporte do staff',
    })

    const view = await loadNucleusListOverviewData(payload, leader, parseNucleusListParams({}))

    expect(view).not.toBeNull()
    if (!view) throw new Error('Expected overview view model')
    expect(view.totalFiltered).toBe(1)
    expect(view.estimate.confirmedTotal).toBe(450)
    expect(view.estimate).not.toHaveProperty('pendingSuggestionsCount')
    expect(view.recentUpdates).toHaveLength(1)
    expect(view.recentUpdates[0]?.authorName).toBe(leader.name)
    expect(view.recentUpdates[0]?.kind).toBe('nota')
  })

  it('returns null when the filtered set is empty', async () => {
    const fixtures = campaignFixtures()
    const general = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Geral vazio'),
      email: `${fixtures.value('geral-vazio')}@example.com`,
      password: fixtures.value('password'),
    })

    const view = await loadNucleusListOverviewData(
      payload,
      general,
      parseNucleusListParams({ q: fixtures.value('nucleo-inexistente-overview') }),
    )

    expect(view).toBeNull()
  })
})
