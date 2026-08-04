// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createMunicipalityAdvisorRecord,
  setMunicipalityAdvisorMembershipRecord,
} from '@/app/(campaign)/campanha/actions/municipality'
import { stubCampaignUserEmailFor } from '@/lib/schemas/advisor'
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

describe('createMunicipalityAdvisorRecord (B154)', () => {
  const findAccount = async (id: number) =>
    payload.findByID({ collection: 'campaignUser', id, depth: 0, overrideAccess: true })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s create an advisor by name and assign it to the município',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const municipality = await fixtures.getMunicipality()
      const name = fixtures.value('Novo Assessor')

      const created = await createMunicipalityAdvisorRecord(payload, actor, {
        municipality: municipality.id,
        name,
      })
      fixtures.touchMunicipality(municipality.id)

      expect(relationIds(created.advisors)).toContain(created.createdAdvisorId)

      const account = await findAccount(created.createdAdvisorId)
      expect(account.role).toBe('advisor')
      expect(account.email).toBe(stubCampaignUserEmailFor(name))
      // The random password is never shared and the stub e-mail cannot route
      // (reset is blocked for placeholders), so the account cannot log in until
      // a coordinator swaps in real credentials — same contract as E4R seeds.
    },
  )

  it('assigns a -N stub when a same-name account already has the first one', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const name = fixtures.value('Maria Silva')

    const first = await createMunicipalityAdvisorRecord(payload, coordinator, {
      municipality: municipality.id,
      name,
    })
    const second = await createMunicipalityAdvisorRecord(payload, coordinator, {
      municipality: municipality.id,
      name,
    })

    expect(second.createdAdvisorId).not.toBe(first.createdAdvisorId)
    // `campaignUser.name` is not unique — both accounts are legal, the stub
    // e-mail is what gets the deterministic `-N`.
    expect((await findAccount(first.createdAdvisorId)).email).toBe(stubCampaignUserEmailFor(name))
    expect((await findAccount(second.createdAdvisorId)).email).toBe(
      stubCampaignUserEmailFor(name, 2),
    )
    expect(relationIds(second.advisors)).toContain(second.createdAdvisorId)
  })

  it('denies advisor and leader actors without creating an account', async () => {
    const fixtures = campaignFixtures()
    const advisorActor = await fixtures.createCampaignUser('advisor')
    const leaderActor = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const name = fixtures.value('Bloqueado')

    for (const actor of [advisorActor, leaderActor]) {
      await expect(
        createMunicipalityAdvisorRecord(payload, actor, {
          municipality: municipality.id,
          name,
        }),
      ).rejects.toThrow(/coordenação geral ou o candidato/i)
    }

    const stub = stubCampaignUserEmailFor(name)
    const existing = await payload.find({
      collection: 'campaignUser',
      where: { email: { equals: stub } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(existing.totalDocs).toBe(0)
  })

  it('rejects at the 10-advisor cap and rolls the account create back', async () => {
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

    const name = fixtures.value('Cap Estourado')
    await expect(
      createMunicipalityAdvisorRecord(payload, coordinator, {
        municipality: municipality.id,
        name,
      }),
    ).rejects.toThrow(/no máximo 10 assessores/i)

    // Same transaction: the failed assignment rolled the account create back.
    const orphan = await payload.find({
      collection: 'campaignUser',
      where: { email: { equals: stubCampaignUserEmailFor(name) } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(orphan.totalDocs).toBe(0)
  })
})
