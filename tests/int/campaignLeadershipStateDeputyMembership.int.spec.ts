// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setLeadershipStateDeputyMembershipRecord } from '@/app/(campaign)/campanha/actions/leadership'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const stateDeputyIds = (leadership: {
  stateDeputies?: (number | { id: number })[] | null
}): number[] => relationIds(leadership.stateDeputies)

describe('setLeadershipStateDeputyMembershipRecord (B31)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s assign and remove a state deputy by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const municipality = await fixtures.getMunicipality()
      const contact = await fixtures.createContact()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality],
      })
      const stateDeputy = await fixtures.createStateDeputy()

      const { leadership: assigned, stateDeputySlug } =
        await setLeadershipStateDeputyMembershipRecord(payload, actor, {
          leadershipId: leadership.id,
          stateDeputyId: stateDeputy.id,
          assigned: true,
        })
      expect(stateDeputyIds(assigned)).toContain(stateDeputy.id)
      expect(stateDeputySlug).toBe(stateDeputy.slug)

      const { leadership: removed } = await setLeadershipStateDeputyMembershipRecord(
        payload,
        actor,
        {
          leadershipId: leadership.id,
          stateDeputyId: stateDeputy.id,
          assigned: false,
        },
      )
      expect(stateDeputyIds(removed)).not.toContain(stateDeputy.id)
    },
  )

  it('lets an advisor manage a leadership within their administered municipality', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })
    const stateDeputy = await fixtures.createStateDeputy()

    const { leadership: assigned } = await setLeadershipStateDeputyMembershipRecord(
      payload,
      advisor,
      {
        leadershipId: leadership.id,
        stateDeputyId: stateDeputy.id,
        assigned: true,
      },
    )
    expect(stateDeputyIds(assigned)).toContain(stateDeputy.id)
  })

  it('denies an advisor outside the leadership scope and a leader actor', async () => {
    const fixtures = campaignFixtures()
    const advisorActor = await fixtures.createCampaignUser('advisor')
    const outsideMunicipality = await fixtures.getMunicipality()
    const otherMunicipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(outsideMunicipality, [advisorActor])
    const leaderActor = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [otherMunicipality],
    })
    const stateDeputy = await fixtures.createStateDeputy()

    await expect(
      setLeadershipStateDeputyMembershipRecord(payload, advisorActor, {
        leadershipId: leadership.id,
        stateDeputyId: stateDeputy.id,
        assigned: true,
      }),
    ).rejects.toThrow()

    await expect(
      setLeadershipStateDeputyMembershipRecord(payload, leaderActor, {
        leadershipId: leadership.id,
        stateDeputyId: stateDeputy.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação e a assessoria/i)
  })

  it('is idempotent (no-op returns the same document without re-writing)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })
    const stateDeputy = await fixtures.createStateDeputy()

    await setLeadershipStateDeputyMembershipRecord(payload, coordinator, {
      leadershipId: leadership.id,
      stateDeputyId: stateDeputy.id,
      assigned: true,
    })

    const { leadership: again } = await setLeadershipStateDeputyMembershipRecord(
      payload,
      coordinator,
      {
        leadershipId: leadership.id,
        stateDeputyId: stateDeputy.id,
        assigned: true,
      },
    )
    expect(stateDeputyIds(again)).toEqual([stateDeputy.id])
  })

  it('rejects once the leadership is at the 20-state-deputy cap', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })

    for (let index = 0; index < 20; index += 1) {
      const stateDeputy = await fixtures.createStateDeputy()
      await setLeadershipStateDeputyMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        stateDeputyId: stateDeputy.id,
        assigned: true,
      })
    }

    const twentyFirst = await fixtures.createStateDeputy()
    await expect(
      setLeadershipStateDeputyMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        stateDeputyId: twentyFirst.id,
        assigned: true,
      }),
    ).rejects.toThrow(/no máximo 20 dobradinhas/i)
  })
})
