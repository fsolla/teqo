// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { searchStaffMunicipalityHits } from '@/utilities/homeSearch/searchStaffMunicipalityHits'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchStaffMunicipalityHits (B60)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchStaffMunicipalityHits(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches municipalities by word-start on the name', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const cairu = getMunicipalityCatalogEntry('cairu')
    expect(cairu).toBeDefined()

    const result = await searchStaffMunicipalityHits(payload, coordinator, 'Cai')
    expect(result.some((hit) => hit.slug === 'cairu')).toBe(true)
  })

  it('scopes municipality hits to the advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const administered = await fixtures.getMunicipality('cairu')
    const other = await fixtures.getMunicipality('feira-de-santana')
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const advisorResult = await searchStaffMunicipalityHits(payload, advisor, 'Feira')
    expect(advisorResult.map((hit) => hit.slug)).toEqual([])

    const coordinatorResult = await searchStaffMunicipalityHits(payload, coordinator, 'Feira')
    expect(coordinatorResult.some((hit) => hit.slug === other.slug)).toBe(true)

    const advisorCairu = await searchStaffMunicipalityHits(payload, advisor, 'Cairu')
    expect(advisorCairu.map((hit) => hit.slug)).toEqual(['cairu'])
  })

  it('rejects leaders from wizard municipality search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchStaffMunicipalityHits(payload, leader, 'Cairu')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
