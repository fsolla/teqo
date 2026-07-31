// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setStateDeputyMunicipalitiesBatchRecord } from '@/app/(campaign)/campanha/actions/stateDeputy'
import config from '@/payload.config'
import { searchHomeStateDeputies } from '@/utilities/homeSearch/searchHomeStateDeputies'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('searchHomeStateDeputies (B52)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeStateDeputies(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches state deputies by word-start on the name for staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Zeca Oliveira Dobradinha' })

    const result = await searchHomeStateDeputies(payload, coordinator, 'Zeca')
    expect(result.some((hit) => hit.slug === stateDeputy.slug)).toBe(true)
    expect(result.find((hit) => hit.slug === stateDeputy.slug)?.name).toBe(
      'Zeca Oliveira Dobradinha',
    )
  })

  it('matches state deputies by word-start on the party when the name does not match', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({
      name: 'Maria Silva',
      party: 'PSOL',
    })

    const result = await searchHomeStateDeputies(payload, coordinator, 'PSOL')
    expect(result.some((hit) => hit.slug === stateDeputy.slug)).toBe(true)
  })

  it('returns state deputy hits for advisor role when name matches', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Assessoria Dobradinha' })

    const result = await searchHomeStateDeputies(payload, advisor, 'Assessoria')
    expect(result.some((hit) => hit.slug === stateDeputy.slug)).toBe(true)
  })

  it('reports municipality count on matched state deputies', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Carteira Dobradinha' })
    // Allocated, never pinned slugs: parallel specs mutating the same seeded
    // municipality deadlocked municipality_rels (miss #73).
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    await setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [first.id, second.id],
      assigned: true,
    })

    const result = await searchHomeStateDeputies(payload, coordinator, 'Carteira')
    const hit = result.find((row) => row.slug === stateDeputy.slug)
    expect(hit?.municipalityCount).toBe(2)
    expect(hit?.party).toBe(stateDeputy.party ?? null)
  })
})
