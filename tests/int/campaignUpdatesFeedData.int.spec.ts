// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import {
  loadCampaignUpdatesFeed,
  loadCampaignUpdatesFeedFacets,
} from '@/utilities/municipality/campaignUpdatesFeedData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign updates feed data (C89)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('feeds the actor across their whole portfolio with author and municipality identity', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const first = await campaignFixtures().getMunicipality()
    const second = await campaignFixtures().getMunicipality()

    await campaignFixtures().createMunicipalityUpdate({
      municipality: first.id,
      author: coordinator.id,
      polarity: 'boa',
      body: 'Festa da adesão',
    })
    await campaignFixtures().createMunicipalityUpdate({
      municipality: second.id,
      author: coordinator.id,
      polarity: 'ruim',
      urgent: true,
      body: 'Perda de apoio',
    })

    // Scoped to this spec's municipalities: the coordinator's unrestricted
    // read sees every update in the shared test DB, including rows other
    // concurrently running spec files create — so global count assertions
    // would race with them.
    const result = await loadCampaignUpdatesFeed(payload, coordinator, {
      page: 1,
      slugs: [first.slug, second.slug],
    })
    expect(result.totalDocs).toBe(2)
    expect(result.cards.some((card) => card.body === 'Festa da adesão')).toBe(true)
    const urgentCard = result.cards.find((card) => card.body === 'Perda de apoio')
    expect(urgentCard).toMatchObject({
      polarity: 'ruim',
      urgent: true,
      author: { name: coordinator.name },
    })
    expect([first.slug, second.slug].includes(urgentCard!.municipality.slug)).toBe(true)
    expect(urgentCard!.municipality.name.length).toBeGreaterThan(0)
  })

  it('scopes the feed and its facets to the advisor portfolio', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getMunicipality()
    const other = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(assigned, [advisor])
    await campaignFixtures().assignMunicipalityAdvisors(other, [otherAdvisor])

    await campaignFixtures().createMunicipalityUpdate({
      municipality: assigned.id,
      author: coordinator.id,
      polarity: 'neutra',
      body: 'Visita no meu município',
    })
    await campaignFixtures().createMunicipalityUpdate({
      municipality: other.id,
      author: otherAdvisor.id,
      polarity: 'neutra',
      body: 'Atualização alheia',
    })

    const result = await loadCampaignUpdatesFeed(payload, advisor, { page: 1 })
    expect(result.totalDocs).toBe(1)
    expect(result.cards[0]?.body).toBe('Visita no meu município')

    const facets = await loadCampaignUpdatesFeedFacets(payload, advisor)
    expect(facets.municipalities.map((municipality) => municipality.slug)).toEqual([assigned.slug])
    expect(facets.authorOptions.map((option) => option.label)).toContain(coordinator.name)
    expect(facets.authorOptions.map((option) => option.label)).not.toContain(otherAdvisor.name)
  })

  it('gives the coordinator the full municipality catalog as facet options', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const facets = await loadCampaignUpdatesFeedFacets(payload, coordinator)
    expect(facets.municipalities.map((municipality) => municipality.slug)).toEqual(
      municipalityCatalog
        .map((entry) => entry.slug)
        .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    )
  })

  it('applies every feed filter to the query', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const otherAuthor = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()

    await campaignFixtures().createMunicipalityUpdate({
      municipality: municipality.id,
      author: coordinator.id,
      polarity: 'boa',
      urgent: true,
      body: 'Adesão da comunidade',
    })
    await campaignFixtures().createMunicipalityUpdate({
      municipality: municipality.id,
      author: otherAuthor.id,
      polarity: 'neutra',
      body: 'Reunião de rotina',
    })

    // Every query below is scoped to this spec's municipality so counts can't
    // race with concurrent spec files writing coordinator-visible updates.
    const byText = await loadCampaignUpdatesFeed(payload, coordinator, {
      page: 1,
      slugs: [municipality.slug],
      q: 'adesão',
    })
    expect(byText.cards.map((card) => card.body)).toEqual(['Adesão da comunidade'])

    const byUrgent = await loadCampaignUpdatesFeed(payload, coordinator, {
      page: 1,
      slugs: [municipality.slug],
      urgent: true,
    })
    expect(byUrgent.totalDocs).toBe(1)

    const byAuthor = await loadCampaignUpdatesFeed(payload, coordinator, {
      page: 1,
      slugs: [municipality.slug],
      authors: [otherAuthor.id],
    })
    expect(byAuthor.cards.map((card) => card.body)).toEqual(['Reunião de rotina'])

    const byMunicipality = await loadCampaignUpdatesFeed(payload, coordinator, {
      page: 1,
      slugs: [municipality.slug],
    })
    expect(byMunicipality.totalDocs).toBe(2)
    expect(byMunicipality.cards[0]?.municipality.slug).toBe(municipality.slug)
  })

  it('denies leaders the feed and its facets', async () => {
    const leader = await campaignFixtures().createCampaignUser('leader')
    await expect(loadCampaignUpdatesFeed(payload, leader, { page: 1 })).rejects.toThrow()
    await expect(loadCampaignUpdatesFeedFacets(payload, leader)).rejects.toThrow()
  })
})
