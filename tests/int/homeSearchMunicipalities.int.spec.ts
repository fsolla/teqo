// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { searchHomeMunicipalities } from '@/utilities/homeSearch/searchHomeMunicipalities'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchHomeMunicipalities (B48)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeMunicipalities(payload, coordinator, 'a')
    expect(result.municipalities).toEqual([])
    expect(result.territories).toEqual([])
  })

  it('matches municipalities by word-start on the name', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const cairu = getMunicipalityCatalogEntry('cairu')
    expect(cairu).toBeDefined()

    const result = await searchHomeMunicipalities(payload, coordinator, 'Cai')
    expect(result.municipalities.some((hit) => hit.slug === 'cairu')).toBe(true)
  })

  it('scopes municipality hits to the advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const administered = await fixtures.getMunicipality()
    const other = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const otherQuery = other.name.split(/\s+/)[0]!
    const administeredQuery = administered.name.split(/\s+/)[0]!

    const advisorResult = await searchHomeMunicipalities(payload, advisor, otherQuery)
    expect(advisorResult.municipalities.map((hit) => hit.slug)).toEqual([])

    const coordinatorResult = await searchHomeMunicipalities(payload, coordinator, otherQuery)
    expect(coordinatorResult.municipalities.some((hit) => hit.slug === other.slug)).toBe(true)

    const advisorAdmin = await searchHomeMunicipalities(payload, advisor, administeredQuery)
    expect(advisorAdmin.municipalities.map((hit) => hit.slug)).toEqual([administered.slug])
  })

  it('rejects leaders from home search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchHomeMunicipalities(payload, leader, 'Cairu')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
