// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setMunicipalityAdvisorMembershipRecord } from '@/app/(campaign)/campanha/actions/municipality'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('setMunicipalityAdvisorMembershipRecord (B27)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s assign and remove an advisor by delta',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const advisor = await fixtures.createCampaignUser('advisor')
      const municipality = await fixtures.getMunicipality()

      const assigned = await setMunicipalityAdvisorMembershipRecord(payload, actor, {
        municipality: municipality.id,
        advisor: advisor.id,
        assigned: true,
      })
      fixtures.touchMunicipality(municipality.id)
      expect(relationIds(assigned.advisors)).toContain(advisor.id)

      const removed = await setMunicipalityAdvisorMembershipRecord(payload, actor, {
        municipality: municipality.id,
        advisor: advisor.id,
        assigned: false,
      })
      expect(relationIds(removed.advisors)).not.toContain(advisor.id)
    },
  )

  it('lets a coordinator assign themself or the candidate — the path assertTargetAdvisor would block', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const candidate = await fixtures.createCampaignUser('candidate')
    const municipality = await fixtures.getMunicipality()

    const selfAssigned = await setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
      municipality: municipality.id,
      advisor: coordinator.id,
      assigned: true,
    })
    fixtures.touchMunicipality(municipality.id)
    expect(relationIds(selfAssigned.advisors)).toContain(coordinator.id)

    const candidateAssigned = await setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
      municipality: municipality.id,
      advisor: candidate.id,
      assigned: true,
    })
    expect(relationIds(candidateAssigned.advisors)).toContain(candidate.id)
  })

  it('denies advisor and leader actors', async () => {
    const fixtures = campaignFixtures()
    const advisorActor = await fixtures.createCampaignUser('advisor')
    const leaderActor = await fixtures.createCampaignUser('leader')
    const target = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()

    await expect(
      setMunicipalityAdvisorMembershipRecord(payload, advisorActor, {
        municipality: municipality.id,
        advisor: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      setMunicipalityAdvisorMembershipRecord(payload, leaderActor, {
        municipality: municipality.id,
        advisor: target.id,
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)
  })

  it('is idempotent (no-op returns the same document without re-writing)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()

    await setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
      municipality: municipality.id,
      advisor: advisor.id,
      assigned: true,
    })
    fixtures.touchMunicipality(municipality.id)

    const again = await setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
      municipality: municipality.id,
      advisor: advisor.id,
      assigned: true,
    })
    expect(relationIds(again.advisors)).toEqual([advisor.id])
  })

  it('rejects once the municipality is at the 10-advisor cap', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    for (let index = 0; index < 10; index += 1) {
      const advisor = await fixtures.createCampaignUser('advisor')
      await setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
        municipality: municipality.id,
        advisor: advisor.id,
        assigned: true,
      })
    }
    fixtures.touchMunicipality(municipality.id)

    const eleventh = await fixtures.createCampaignUser('advisor')
    await expect(
      setMunicipalityAdvisorMembershipRecord(payload, coordinator, {
        municipality: municipality.id,
        advisor: eleventh.id,
        assigned: true,
      }),
    ).rejects.toThrow(/no máximo 10 assessores/i)
  })
})
