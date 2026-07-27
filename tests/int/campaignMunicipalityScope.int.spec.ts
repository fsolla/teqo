// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadMunicipalityScope } from '@/utilities/campaignMunicipalityScope'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/**
 * `loadMunicipalityScope` reads the pledge aggregate two different ways: an
 * unrestricted actor with no filter holds the whole catalog, so both reads
 * leave in one round trip with no `municipality IN (…)` narrowing; every
 * narrower scope waits for the município ids. These pin that the two paths
 * agree, and that the unfiltered shortcut stays out of reach of an actor whose
 * scope is NOT the whole catalog.
 */
describe('loadMunicipalityScope', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('aggregates the same pledge whether the scope is unfiltered or filtered', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 80,
      estimatedVotes: { pessimistic: null, central: 120, optimistic: null },
    })

    // Whole catalog: the unfiltered path, where the pledge read carries no id list.
    const unfiltered = await loadMunicipalityScope(payload, coordinator, {})
    // Same actor, narrowed by slug: the path that waits for the município ids.
    const filtered = await loadMunicipalityScope(payload, coordinator, {
      slug: { equals: municipality.slug },
    })

    expect(filtered.municipalities.map(({ id }) => id)).toEqual([municipality.id])
    expect(unfiltered.pledgeAggregates.get(municipality.id)).toEqual(
      filtered.pledgeAggregates.get(municipality.id),
    )
    expect(unfiltered.pledgeAggregates.get(municipality.id)).toMatchObject({
      declaredTotal: 80,
      pledgeCount: 1,
      missingEstimateCount: 0,
    })
    expect(unfiltered.pledgeAggregates.get(municipality.id)?.effectiveByScenario.central).toBe(120)
  })

  it('never hands an advisor pledges outside the municipalities they administer', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const foreign = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor.id])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [foreign.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: foreign.id,
      declaredVotes: 900,
    })

    // Empty `where`, but the advisor's scope is his portfolio — the whole-catalog
    // shortcut must not apply, or this aggregate would carry a foreign pledge.
    const scope = await loadMunicipalityScope(payload, advisor, {})

    expect(scope.municipalities.map(({ id }) => id)).toEqual([administered.id])
    expect(scope.pledgeAggregates.has(foreign.id)).toBe(false)
  })
})
