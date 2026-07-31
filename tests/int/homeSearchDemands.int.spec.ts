// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { searchHomeDemands } from '@/utilities/homeSearch/searchHomeDemands'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchHomeDemands (B53)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeDemands(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches demands by word-start on the title for staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const title = fixtures.value('Material Zeca Centro')
    const demand = await fixtures.createCampaignDemand({
      municipality,
      title,
      createdBy: coordinator,
    })

    const result = await searchHomeDemands(payload, coordinator, 'Material')
    const hit = result.find((row) => row.id === demand.id)
    expect(hit?.title).toBe(title)
    expect(hit?.slug).toBe(demand.slug)
    expect(hit?.secondary).toContain(municipality.name)
    expect(hit?.secondary).toContain('Aberta')
  })

  it('does not match mid-word without word-start boundary', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const title = fixtures.value('Transporte Comunitário')
    const demand = await fixtures.createCampaignDemand({
      municipality,
      title,
      createdBy: coordinator,
    })

    const result = await searchHomeDemands(payload, coordinator, 'ransporte')
    expect(result.some((row) => row.id === demand.id)).toBe(false)
  })

  it('scopes demand hits to the advisor portfolio by municipality', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const administered = await fixtures.getMunicipality()
    const other = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const scopeToken = fixtures.value('scope-demanda')
    const inScope = await fixtures.createCampaignDemand({
      municipality: administered,
      title: `Material ${scopeToken} ${administered.name}`,
      createdBy: coordinator,
    })
    const outOfScope = await fixtures.createCampaignDemand({
      municipality: other,
      title: `Material ${scopeToken} ${other.name}`,
      createdBy: coordinator,
    })

    const advisorResult = await searchHomeDemands(payload, advisor, scopeToken)
    expect(advisorResult.map((hit) => hit.id)).toEqual([inScope.id])

    const coordinatorResult = await searchHomeDemands(payload, coordinator, scopeToken)
    expect(coordinatorResult.map((hit) => hit.id).sort((a, b) => a - b)).toEqual(
      [inScope.id, outOfScope.id].sort((a, b) => a - b),
    )
  })

  it('rejects leaders from home search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchHomeDemands(payload, leader, 'Material')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
