// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setLeadershipMunicipalitiesMembershipRecord } from '@/app/(campaign)/campanha/actions/leadership'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const municipalityIds = (leadership: {
  municipalities?: (number | { id: number })[] | null
}): number[] => relationIds(leadership.municipalities)

describe('setLeadershipMunicipalitiesMembershipRecord (B34)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s add and remove municipalities by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const home = await fixtures.getMunicipality()
      const added = await fixtures.getMunicipality()
      const contact = await fixtures.createContact()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [home],
      })

      const { leadership: assigned, municipalitySlugs } =
        await setLeadershipMunicipalitiesMembershipRecord(payload, actor, {
          leadershipId: leadership.id,
          municipalityIds: [added.id],
          assigned: true,
        })
      expect(municipalityIds(assigned)).toEqual([home.id, added.id])
      expect(municipalitySlugs).toEqual([added.slug])

      const { leadership: removed } = await setLeadershipMunicipalitiesMembershipRecord(
        payload,
        actor,
        {
          leadershipId: leadership.id,
          municipalityIds: [added.id],
          assigned: false,
        },
      )
      expect(municipalityIds(removed)).toEqual([home.id])
    },
  )

  it('adds a whole batch (território / zona) in one write', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const home = await fixtures.getMunicipality()
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({ contact, municipalities: [home] })

    const { leadership: assigned, municipalitySlugs } =
      await setLeadershipMunicipalitiesMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        municipalityIds: [first.id, second.id],
        assigned: true,
      })

    expect(municipalityIds(assigned)).toEqual([home.id, first.id, second.id])
    expect(municipalitySlugs).toEqual(expect.arrayContaining([first.slug, second.slug]))
  })

  it('refuses to remove the last municipality of a leadership', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })

    await expect(
      setLeadershipMunicipalitiesMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        municipalityIds: [municipality.id],
        assigned: false,
      }),
    ).rejects.toThrow(/pelo menos um município/i)

    const unchanged = await payload.findByID({
      collection: 'leadership',
      id: leadership.id,
      depth: 0,
    })
    expect(municipalityIds(unchanged)).toEqual([municipality.id])
  })

  it('lets an advisor add a municipality they administer', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const home = await fixtures.getMunicipality()
    const alsoAdministered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(home, [advisor])
    await fixtures.assignMunicipalityAdvisors(alsoAdministered, [advisor])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({ contact, municipalities: [home] })

    const { leadership: assigned } = await setLeadershipMunicipalitiesMembershipRecord(
      payload,
      advisor,
      {
        leadershipId: leadership.id,
        municipalityIds: [alsoAdministered.id],
        assigned: true,
      },
    )
    expect(municipalityIds(assigned)).toEqual([home.id, alsoAdministered.id])
  })

  it('denies an advisor adding a municipality outside their portfolio, but lets them remove one', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor])
    const contact = await fixtures.createContact()
    // Cross-boundary leadership: the advisor administers only one of its municipalities.
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [administered, outside],
    })

    const stranger = await fixtures.getMunicipality()
    await expect(
      setLeadershipMunicipalitiesMembershipRecord(payload, advisor, {
        leadershipId: leadership.id,
        municipalityIds: [stranger.id],
        assigned: true,
      }),
    ).rejects.toThrow(/municípios que assessora/i)

    // Removal needs no scope beyond the row access that resolved the leadership —
    // this is what a whole-array replace would break for a cross-boundary row.
    const { leadership: removed } = await setLeadershipMunicipalitiesMembershipRecord(
      payload,
      advisor,
      {
        leadershipId: leadership.id,
        municipalityIds: [outside.id],
        assigned: false,
      },
    )
    expect(municipalityIds(removed)).toEqual([administered.id])
  })

  it('denies a leader actor', async () => {
    const fixtures = campaignFixtures()
    const leaderActor = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const other = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })

    await expect(
      setLeadershipMunicipalitiesMembershipRecord(payload, leaderActor, {
        leadershipId: leadership.id,
        municipalityIds: [other.id],
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação e a assessoria/i)
  })

  it('is a no-op when the municipalities are already in the desired state', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const absent = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })

    const { municipalitySlugs: afterAdd } = await setLeadershipMunicipalitiesMembershipRecord(
      payload,
      coordinator,
      { leadershipId: leadership.id, municipalityIds: [municipality.id], assigned: true },
    )
    // No write happened, so the caller has nothing to revalidate.
    expect(afterAdd).toEqual([])

    const { municipalitySlugs: afterRemove } = await setLeadershipMunicipalitiesMembershipRecord(
      payload,
      coordinator,
      { leadershipId: leadership.id, municipalityIds: [absent.id], assigned: false },
    )
    expect(afterRemove).toEqual([])
  })
})
