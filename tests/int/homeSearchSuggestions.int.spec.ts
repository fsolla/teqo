// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadHomeSearchSuggestions } from '@/utilities/homeSearch/loadHomeSearchSuggestions'
import { searchHomeMunicipalities } from '@/utilities/homeSearch/searchHomeMunicipalities'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadHomeSearchSuggestions (B68)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns only high-priority municipalities for coordinator', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await loadHomeSearchSuggestions(payload, coordinator)
    expect(result.resultKind).toBe('suggest')
    expect(result.territories).toEqual([])
    expect(result.municipalities.length).toBeLessThanOrEqual(8)
    for (const hit of result.municipalities) {
      expect(hit.priority).toBe('alta')
    }
  })

  it('scopes advisor suggestions to administered municipalities', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const result = await loadHomeSearchSuggestions(payload, advisor)
    expect(result.municipalities.every((hit) => hit.slug === administered.slug)).toBe(true)
    expect(result.scopeMunicipalities?.map((row) => row.slug)).toEqual([administered.slug])
  })

  it('rejects leaders from home search suggestions', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(loadHomeSearchSuggestions(payload, leader)).rejects.toThrow(/equipe de campanha/i)
  })
})

describe('searchHomeMunicipalities resultKind (B68)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('tags search responses with resultKind search', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeMunicipalities(payload, coordinator, 'Cai')
    expect(result.resultKind).toBe('search')
  })
})
