// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { searchHomeAdvisors } from '@/utilities/homeSearch/searchHomeAdvisors'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchHomeAdvisors (B50)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeAdvisors(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches advisors by word-start on the name for unrestricted staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor', { name: 'Zeca Oliveira Assessor' })

    const result = await searchHomeAdvisors(payload, coordinator, 'Zeca')
    expect(result.some((hit) => hit.id === advisor.id)).toBe(true)
    expect(result.find((hit) => hit.id === advisor.id)?.name).toBe('Zeca Oliveira Assessor')
  })

  it('returns no advisor hits for advisor role even when name matches', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor', { name: 'Zeca Oliveira Assessor' })

    const result = await searchHomeAdvisors(payload, advisor, 'Zeca')
    expect(result).toEqual([])
  })

  it('reports municipality count on matched advisors', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor', { name: 'Carteira Zeca' })
    const cairu = await fixtures.getMunicipality('cairu')
    const feira = await fixtures.getMunicipality('feira-de-santana')
    await fixtures.assignMunicipalityAdvisors(cairu.id, [advisor.id])
    await fixtures.assignMunicipalityAdvisors(feira.id, [advisor.id])

    const result = await searchHomeAdvisors(payload, coordinator, 'Carteira')
    const hit = result.find((row) => row.id === advisor.id)
    expect(hit?.municipalityCount).toBe(2)
  })
})
