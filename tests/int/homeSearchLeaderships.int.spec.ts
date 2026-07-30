// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { searchHomeLeaderships } from '@/utilities/homeSearch/searchHomeLeaderships'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchHomeLeaderships (B49)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeLeaderships(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches leaderships by word-start on contact name', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality('cairu')
    const contact = await fixtures.createContact({ name: 'Zeca Pagodinho' })
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })

    const result = await searchHomeLeaderships(payload, coordinator, 'Zeca')
    const hit = result.find((row) => row.id === leadership.id)
    expect(hit?.name).toBe('Zeca Pagodinho')
    expect(hit?.municipalitiesSummary).toContain('Cairu')
  })

  it('does not match mid-word without word-start boundary', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality('cairu')
    const contact = await fixtures.createContact({ name: 'Maria Silva' })
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })

    const result = await searchHomeLeaderships(payload, coordinator, 'ari')
    expect(result).toEqual([])
  })

  it('scopes leadership hits to the advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const administered = await fixtures.getMunicipality('cairu')
    const other = await fixtures.getMunicipality('feira-de-santana')
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const inScope = await fixtures.createContact({ name: 'Lider Cairu' })
    const outOfScope = await fixtures.createContact({ name: 'Lider Feira' })
    const scopedLeadership = await fixtures.createLeadership({
      contact: inScope.id,
      municipalities: [administered.id],
    })
    const otherLeadership = await fixtures.createLeadership({
      contact: outOfScope.id,
      municipalities: [other.id],
    })

    const advisorResult = await searchHomeLeaderships(payload, advisor, 'Lider')
    expect(advisorResult.map((hit) => hit.id)).toEqual([scopedLeadership.id])

    const coordinatorResult = await searchHomeLeaderships(payload, coordinator, 'Lider')
    expect(coordinatorResult.map((hit) => hit.id).sort((a, b) => a - b)).toEqual(
      [scopedLeadership.id, otherLeadership.id].sort((a, b) => a - b),
    )
  })

  it('rejects leaders from home search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchHomeLeaderships(payload, leader, 'Lider')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
