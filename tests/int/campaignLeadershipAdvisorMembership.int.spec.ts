// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setLeadershipAdvisorMembershipRecord } from '@/app/(campaign)/campanha/actions/leadership'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const advisorIds = (leadership: { advisors?: (number | { id: number })[] | null }): number[] =>
  relationIds(leadership.advisors)

describe('setLeadershipAdvisorMembershipRecord (C99)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createLeadership = async (
    fixtures: ReturnType<typeof campaignFixtures>,
  ): Promise<{ id: number }> => {
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    return fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })
  }

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s assign and remove an advisor by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const leadership = await createLeadership(fixtures)
      const advisor = await fixtures.createCampaignUser('advisor')

      const { leadershipID } = await setLeadershipAdvisorMembershipRecord(payload, actor, {
        leadershipId: leadership.id,
        advisorId: advisor.id,
        assigned: true,
      })
      expect(leadershipID).toBe(leadership.id)

      const assigned = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(advisorIds(assigned)).toContain(advisor.id)

      await setLeadershipAdvisorMembershipRecord(payload, actor, {
        leadershipId: leadership.id,
        advisorId: advisor.id,
        assigned: false,
      })

      const removed = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(advisorIds(removed)).not.toContain(advisor.id)
    },
  )

  it('denies a plain advisor actor and a leader actor', async () => {
    const fixtures = campaignFixtures()
    const advisorActor = await fixtures.createCampaignUser('advisor')
    const leaderActor = await fixtures.createCampaignUser('leader')
    const leadership = await createLeadership(fixtures)
    const target = await fixtures.createCampaignUser('coordinator')

    await expect(
      setLeadershipAdvisorMembershipRecord(payload, advisorActor, {
        leadershipId: leadership.id,
        advisorId: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      setLeadershipAdvisorMembershipRecord(payload, leaderActor, {
        leadershipId: leadership.id,
        advisorId: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)
  })

  it('rejects a target account that is not eligible staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leadership = await createLeadership(fixtures)
    const leaderTarget = await fixtures.createCampaignUser('leader')

    await expect(
      setLeadershipAdvisorMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        advisorId: leaderTarget.id,
        assigned: true,
      }),
    ).rejects.toThrow(/Coordenador Geral, Assessor ou Candidato/i)
  })

  it('is idempotent (no-op does not re-write)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leadership = await createLeadership(fixtures)
    const advisor = await fixtures.createCampaignUser('advisor')

    await setLeadershipAdvisorMembershipRecord(payload, coordinator, {
      leadershipId: leadership.id,
      advisorId: advisor.id,
      assigned: true,
    })

    // No-op contract: no id back (the caller then skips the revalidate).
    const { leadershipID } = await setLeadershipAdvisorMembershipRecord(payload, coordinator, {
      leadershipId: leadership.id,
      advisorId: advisor.id,
      assigned: true,
    })
    expect(leadershipID).toBeUndefined()

    const after = await payload.findByID({
      collection: 'leadership',
      id: leadership.id,
      depth: 0,
      select: { advisors: true },
      overrideAccess: true,
    })
    expect(advisorIds(after)).toEqual([advisor.id])
  })

  it('rejects once the leadership is at the 10-advisor cap', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leadership = await createLeadership(fixtures)

    for (let index = 0; index < 10; index += 1) {
      const advisor = await fixtures.createCampaignUser('advisor')
      await setLeadershipAdvisorMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        advisorId: advisor.id,
        assigned: true,
      })
    }

    const eleventh = await fixtures.createCampaignUser('advisor')
    await expect(
      setLeadershipAdvisorMembershipRecord(payload, coordinator, {
        leadershipId: leadership.id,
        advisorId: eleventh.id,
        assigned: true,
      }),
    ).rejects.toThrow(/no máximo 10 assessores/i)
  })
})
