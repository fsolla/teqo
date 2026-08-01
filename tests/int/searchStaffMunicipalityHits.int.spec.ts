// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { searchStaffMunicipalityHits } from '@/utilities/homeSearch/searchStaffMunicipalityHits'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { distinctWordStartQuery } from '../helpers/distinctWordStartQuery'

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

    const administered = await fixtures.getMunicipality()
    let other = await fixtures.getMunicipality()
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        distinctWordStartQuery(other.name, administered.name)
        distinctWordStartQuery(administered.name, other.name)
        break
      } catch {
        other = await fixtures.getMunicipality()
      }
      if (attempt === 29) {
        throw new Error('could not allocate two municipalities with distinct word-start queries')
      }
    }

    const otherQuery = distinctWordStartQuery(other.name, administered.name)
    const administeredQuery = distinctWordStartQuery(administered.name, other.name)

    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const advisorResult = await searchStaffMunicipalityHits(payload, advisor, otherQuery)
    expect(advisorResult.map((hit) => hit.slug)).toEqual([])

    const coordinatorResult = await searchStaffMunicipalityHits(payload, coordinator, otherQuery)
    expect(coordinatorResult.some((hit) => hit.slug === other.slug)).toBe(true)

    const advisorAdmin = await searchStaffMunicipalityHits(payload, advisor, administeredQuery)
    expect(advisorAdmin.map((hit) => hit.slug)).toEqual([administered.slug])
  })

  it('rejects leaders from wizard municipality search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchStaffMunicipalityHits(payload, leader, 'Cairu')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
