// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadCampaignGoals } from '@/utilities/campaignGoals'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/**
 * Pins the `campaignGoals` global access matrix (E8): a `campaignUser` JWT
 * reaches `/api/globals/*` directly, so — like the election-data collections —
 * the deny for leaders and anonymous requests has to be explicit rather than
 * inherited from Payload's "any authenticated user" default.
 */
describe('campaignGoals global access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('denies anonymous read', async () => {
    await expect(
      payload.findGlobal({ slug: 'campaignGoals', overrideAccess: false }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('denies a leader read', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(
      payload.findGlobal({
        slug: 'campaignGoals',
        user: leader,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('lets an advisor read but not write', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')

    await expect(
      payload.findGlobal({ slug: 'campaignGoals', user: advisor, overrideAccess: false }),
    ).resolves.toMatchObject({ stateGoal: expect.any(Number) })

    await expect(
      payload.updateGlobal({
        slug: 'campaignGoals',
        data: { stateGoal: 160_000 },
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it.each(['coordinator', 'candidate'] as const)('lets a %s read and write', async (role) => {
    const fixtures = campaignFixtures()
    const staff = await fixtures.createCampaignUser(role)

    const updated = await payload.updateGlobal({
      slug: 'campaignGoals',
      data: { stateGoal: 155_000, margin: 5 },
      user: staff,
      overrideAccess: false,
    })
    expect(updated.stateGoal).toBe(155_000)

    await expect(
      payload.findGlobal({ slug: 'campaignGoals', user: staff, overrideAccess: false }),
    ).resolves.toMatchObject({ stateGoal: 155_000, margin: 5 })
  })

  it('lets a payload admin read and write', async () => {
    const fixtures = campaignFixtures()
    const admin = await fixtures.createAdminUser()

    const updated = await payload.updateGlobal({
      slug: 'campaignGoals',
      data: { stateGoal: 150_000 },
      user: admin,
      overrideAccess: false,
    })
    expect(updated.stateGoal).toBe(150_000)
  })

  it('loadCampaignGoals resolves for staff and denies a leader', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leader = await fixtures.createCampaignUser('leader')

    await expect(loadCampaignGoals(payload, coordinator)).resolves.toMatchObject({
      stateGoal: expect.any(Number),
    })
    await expect(loadCampaignGoals(payload, leader)).rejects.toThrow(/permissão|not allowed/i)
  })
})
