// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setStateDeputyAdvisorMembershipRecord } from '@/app/(campaign)/campanha/actions/stateDeputy'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const advisorIds = (stateDeputy: { advisors?: (number | { id: number })[] | null }): number[] =>
  relationIds(stateDeputy.advisors)

describe('setStateDeputyAdvisorMembershipRecord (B156)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s assign and remove an advisor by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const stateDeputy = await fixtures.createStateDeputy()
      const advisor = await fixtures.createCampaignUser('advisor')

      const { stateDeputySlug } = await setStateDeputyAdvisorMembershipRecord(payload, actor, {
        stateDeputyId: stateDeputy.id,
        advisorId: advisor.id,
        assigned: true,
      })
      expect(stateDeputySlug).toBe(stateDeputy.slug)

      const assigned = await payload.findByID({
        collection: 'stateDeputy',
        id: stateDeputy.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(advisorIds(assigned)).toContain(advisor.id)

      await setStateDeputyAdvisorMembershipRecord(payload, actor, {
        stateDeputyId: stateDeputy.id,
        advisorId: advisor.id,
        assigned: false,
      })

      const removed = await payload.findByID({
        collection: 'stateDeputy',
        id: stateDeputy.id,
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
    const stateDeputy = await fixtures.createStateDeputy()
    const target = await fixtures.createCampaignUser('coordinator')

    await expect(
      setStateDeputyAdvisorMembershipRecord(payload, advisorActor, {
        stateDeputyId: stateDeputy.id,
        advisorId: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      setStateDeputyAdvisorMembershipRecord(payload, leaderActor, {
        stateDeputyId: stateDeputy.id,
        advisorId: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)
  })

  it('rejects a target account that is not eligible staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy()
    const leaderTarget = await fixtures.createCampaignUser('leader')

    await expect(
      setStateDeputyAdvisorMembershipRecord(payload, coordinator, {
        stateDeputyId: stateDeputy.id,
        advisorId: leaderTarget.id,
        assigned: true,
      }),
    ).rejects.toThrow(/Coordenador Geral, Assessor ou Candidato/i)
  })

  it('is idempotent (no-op does not re-write)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy()
    const advisor = await fixtures.createCampaignUser('advisor')

    await setStateDeputyAdvisorMembershipRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      advisorId: advisor.id,
      assigned: true,
    })

    // No-op contract: no slug back (the caller then skips the revalidate).
    const { stateDeputySlug } = await setStateDeputyAdvisorMembershipRecord(payload, coordinator, {
      stateDeputyId: stateDeputy.id,
      advisorId: advisor.id,
      assigned: true,
    })
    expect(stateDeputySlug).toBeUndefined()

    const after = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 0,
      select: { advisors: true },
      overrideAccess: true,
    })
    expect(advisorIds(after)).toEqual([advisor.id])
  })

  it('rejects once the dobradinha is at the 10-advisor cap', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy()

    for (let index = 0; index < 10; index += 1) {
      const advisor = await fixtures.createCampaignUser('advisor')
      await setStateDeputyAdvisorMembershipRecord(payload, coordinator, {
        stateDeputyId: stateDeputy.id,
        advisorId: advisor.id,
        assigned: true,
      })
    }

    const eleventh = await fixtures.createCampaignUser('advisor')
    await expect(
      setStateDeputyAdvisorMembershipRecord(payload, coordinator, {
        stateDeputyId: stateDeputy.id,
        advisorId: eleventh.id,
        assigned: true,
      }),
    ).rejects.toThrow(/no máximo 10 assessores/i)
  })
})
