// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setStateDeputyMunicipalitiesBatchRecord } from '@/app/(campaign)/campanha/actions/stateDeputy'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const stateDeputyIdsOf = async (municipalityID: number): Promise<number[]> => {
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { stateDeputies: true },
    overrideAccess: true,
  })
  return relationIds(municipality.stateDeputies)
}

describe('setStateDeputyMunicipalitiesBatchRecord (B37)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s add and remove a municipality by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const municipality = await fixtures.getMunicipality()
      const stateDeputy = await fixtures.createStateDeputy()

      const { slugs: addedSlugs } = await setStateDeputyMunicipalitiesBatchRecord(payload, actor, {
        stateDeputyId: stateDeputy.id,
        municipalityIds: [municipality.id],
        assigned: true,
      })
      fixtures.touchMunicipality(municipality.id)
      expect(addedSlugs).toEqual([municipality.slug])
      expect(await stateDeputyIdsOf(municipality.id)).toEqual([stateDeputy.id])

      const { slugs: removedSlugs } = await setStateDeputyMunicipalitiesBatchRecord(
        payload,
        actor,
        {
          stateDeputyId: stateDeputy.id,
          municipalityIds: [municipality.id],
          assigned: false,
        },
      )
      expect(removedSlugs).toEqual([municipality.slug])
      expect(await stateDeputyIdsOf(municipality.id)).toEqual([])
    },
  )

  it('lets an advisor add a state deputy to a municipality they administer', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor])
    const stateDeputy = await fixtures.createStateDeputy()

    const { slugs } = await setStateDeputyMunicipalitiesBatchRecord(payload, advisor, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [administered.id],
      assigned: true,
    })

    expect(slugs).toEqual([administered.slug])
    expect(await stateDeputyIdsOf(administered.id)).toEqual([stateDeputy.id])
  })

  it('denies an advisor writing to a municipality outside their portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const outside = await fixtures.getMunicipality()
    const stateDeputy = await fixtures.createStateDeputy()

    await expect(
      setStateDeputyMunicipalitiesBatchRecord(payload, advisor, {
        stateDeputyId: stateDeputy.id,
        municipalityIds: [outside.id],
        assigned: true,
      }),
    ).rejects.toThrow()

    expect(await stateDeputyIdsOf(outside.id)).toEqual([])
  })

  it('denies a leader actor', async () => {
    const fixtures = campaignFixtures()
    const leaderActor = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const stateDeputy = await fixtures.createStateDeputy()

    await expect(
      setStateDeputyMunicipalitiesBatchRecord(payload, leaderActor, {
        stateDeputyId: stateDeputy.id,
        municipalityIds: [municipality.id],
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação e a assessoria/i)
  })

  it('adds a whole batch (território / zona) in one write, touching every município', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    const stateDeputy = await fixtures.createStateDeputy()

    const { slugs } = await setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [first.id, second.id],
      assigned: true,
    })
    fixtures.touchMunicipality(first.id)
    fixtures.touchMunicipality(second.id)

    expect(slugs.sort()).toEqual([first.slug, second.slug].sort())
    expect(await stateDeputyIdsOf(first.id)).toEqual([stateDeputy.id])
    expect(await stateDeputyIdsOf(second.id)).toEqual([stateDeputy.id])
  })

  it('is idempotent — a no-op write touches nothing and returns no slugs to revalidate', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const stateDeputy = await fixtures.createStateDeputy()

    await setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [municipality.id],
      assigned: true,
    })
    fixtures.touchMunicipality(municipality.id)

    const { slugs } = await setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      municipalityIds: [municipality.id],
      assigned: true,
    })
    expect(slugs).toEqual([])
    expect(await stateDeputyIdsOf(municipality.id)).toEqual([stateDeputy.id])
  })

  it('serializes a concurrent delta on the same municipality through the advisory lock', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const first = await fixtures.createStateDeputy()
    const second = await fixtures.createStateDeputy()

    await Promise.all([
      setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
        stateDeputyId: first.id,
        municipalityIds: [municipality.id],
        assigned: true,
      }),
      setStateDeputyMunicipalitiesBatchRecord(payload, coordinator, {
        stateDeputyId: second.id,
        municipalityIds: [municipality.id],
        assigned: true,
      }),
    ])
    fixtures.touchMunicipality(municipality.id)

    expect((await stateDeputyIdsOf(municipality.id)).sort((a, b) => a - b)).toEqual(
      [first.id, second.id].sort((a, b) => a - b),
    )
  })
})
