// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { buildOpsSnapshot } from '@/utilities/campaignOps/buildOpsSnapshot'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const authState = vi.hoisted(() => ({
  user: null as CampaignUser | null,
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: async () => authState.user,
}))

import { GET as getOpsSync } from '@/app/(campaign)/campanha/api/ops-sync/route'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('GET /campanha/api/ops-sync', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns 401 without a session', async () => {
    authState.user = null
    const response = await getOpsSync()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBeNull()
  })

  it('returns 403 for a leader', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')
    authState.user = leader

    const response = await getOpsSync()
    expect(response.status).toBe(403)
  })

  it.each(['coordinator', 'candidate', 'advisor'] as const)(
    'returns 200 with no-store for a %s',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      if (role === 'advisor') {
        const municipality = await fixtures.getMunicipality()
        await fixtures.assignMunicipalityAdvisors(municipality, [actor])
      }
      authState.user = actor

      const response = await getOpsSync()
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('no-store')

      const body = (await response.json()) as Awaited<ReturnType<typeof buildOpsSnapshot>>
      expect(body.schemaVersion).toBe(OPS_MIRROR_SCHEMA_VERSION)
      expect(typeof body.revisedAt).toBe('string')
      expect(Array.isArray(body.municipalities)).toBe(true)
      expect(Array.isArray(body.leaderships)).toBe(true)
      expect(Array.isArray(body.votePledges)).toBe(true)
      expect(Array.isArray(body.activities)).toBe(true)
      expect(Array.isArray(body.stateDeputies)).toBe(true)
      expect(Array.isArray(body.organizations)).toBe(true)
      expect(Array.isArray(body.demands)).toBe(true)
      expect(Array.isArray(body.municipalityUpdates)).toBe(true)
      expect(body.goals === null || typeof body.goals.stateGoal === 'number').toBe(true)
    },
  )
})

describe('buildOpsSnapshot access scope', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('scopes an advisor to the municipality portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const inPortfolio = await fixtures.getMunicipality()
    const outOfPortfolio = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(inPortfolio, [advisor])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [inPortfolio, outOfPortfolio],
    })
    await fixtures.createVotePledge({
      leadership,
      municipality: inPortfolio,
      declaredVotes: 40,
      estimatedVotes: { pessimistic: 30, central: 40, optimistic: 50 },
    })
    await fixtures.createVotePledge({
      leadership,
      municipality: outOfPortfolio,
      declaredVotes: 90,
      estimatedVotes: { pessimistic: 80, central: 90, optimistic: 100 },
    })
    await fixtures.createMunicipalityUpdate({
      municipality: inPortfolio,
      author: advisor,
      body: fixtures.value('update-in'),
    })
    await fixtures.createMunicipalityUpdate({
      municipality: outOfPortfolio,
      author: advisor,
      body: fixtures.value('update-out'),
    })

    const snapshot = await buildOpsSnapshot(payload, advisor)

    expect(snapshot.municipalities.map((row) => row.id)).toEqual([inPortfolio.id])
    expect(snapshot.votePledges.map((row) => row.municipality)).toEqual([inPortfolio.id])
    expect(snapshot.municipalityUpdates.map((row) => row.municipality)).toEqual([inPortfolio.id])
    expect(snapshot.votePledges[0]?.estimatedVotes?.central).toBe(40)
  })

  it('lets a coordinator see municipalities beyond a single advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const inPortfolio = await fixtures.getMunicipality()
    const outOfPortfolio = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(inPortfolio, [advisor])

    const advisorSnapshot = await buildOpsSnapshot(payload, advisor)
    const coordinatorSnapshot = await buildOpsSnapshot(payload, coordinator)

    expect(advisorSnapshot.municipalities.map((row) => row.id)).toEqual([inPortfolio.id])
    expect(coordinatorSnapshot.municipalities.some((row) => row.id === inPortfolio.id)).toBe(true)
    expect(coordinatorSnapshot.municipalities.some((row) => row.id === outOfPortfolio.id)).toBe(
      true,
    )
    expect(coordinatorSnapshot.municipalities.length).toBeGreaterThan(
      advisorSnapshot.municipalities.length,
    )
  })

  it('truncates municipality_update to the OH3 per-municipality limit', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    for (let index = 0; index < 5; index += 1) {
      await fixtures.createMunicipalityUpdate({
        municipality,
        author: coordinator,
        body: fixtures.value(`upd-${index}`),
      })
    }

    const snapshot = await buildOpsSnapshot(payload, coordinator, {
      municipalityUpdateLimit: 2,
    })
    const forMunicipality = snapshot.municipalityUpdates.filter(
      (row) => row.municipality === municipality.id,
    )
    expect(forMunicipality).toHaveLength(2)
  })
})
