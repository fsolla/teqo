// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createAdvisorRecord,
  sendAdvisorPasswordResetRecord,
  setAdvisorMunicipalitiesBatchRecord,
  updateAdvisorProfileRecord,
} from '@/app/(campaign)/campanha/actions/advisor'
import { assignMunicipalityAdvisorsRecord } from '@/app/(campaign)/campanha/actions/municipality'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const advisorIdsOf = async (municipalityID: number): Promise<number[]> => {
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { advisors: true },
    overrideAccess: true,
  })
  return relationIds(municipality.advisors)
}

describe('campaign advisor management (B19)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s create an advisor and assign a municipality',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const municipality = await fixtures.getMunicipality()
      const email = `${fixtures.value('advisor')}@example.com`

      const created = await createAdvisorRecord(payload, actor, {
        name: 'Assessor Novo',
        email,
        phone: fixtures.phone(),
      })
      expect(created.role).toBe('advisor')

      const stored = await payload.findByID({
        collection: 'campaignUser',
        id: created.id,
        depth: 0,
        select: { email: true, role: true },
        overrideAccess: true,
      })
      expect(stored.email).toBe(email)
      expect(stored.role).toBe('advisor')

      await setAdvisorMunicipalitiesBatchRecord(payload, actor, {
        advisorId: created.id,
        municipalityIds: [municipality.id],
        assigned: true,
      })
      fixtures.touchMunicipality(municipality.id)
      expect(await advisorIdsOf(municipality.id)).toContain(created.id)

      const updated = await updateAdvisorProfileRecord(payload, actor, {
        id: created.id,
        name: 'Assessor Atualizado',
      })
      expect(updated.name).toBe('Assessor Atualizado')
    },
  )

  it('denies advisor and leader from creating or assigning', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const leader = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const target = await fixtures.createCampaignUser('advisor')

    await expect(
      createAdvisorRecord(payload, advisor, {
        name: 'Bloqueado',
        email: `${fixtures.value('blocked')}@example.com`,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      createAdvisorRecord(payload, leader, {
        name: 'Bloqueado',
        email: `${fixtures.value('blocked-leader')}@example.com`,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)

    await expect(
      setAdvisorMunicipalitiesBatchRecord(payload, advisor, {
        advisorId: target.id,
        municipalityIds: [municipality.id],
        assigned: true,
      }),
    ).rejects.toThrow(/coordenação geral ou o candidato/i)
  })

  it('rejects duplicate advisor emails with a safe message', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const email = `${fixtures.value('dup')}@example.com`
    await createAdvisorRecord(payload, coordinator, {
      name: 'Primeiro',
      email,
    })

    await expect(
      createAdvisorRecord(payload, coordinator, {
        name: 'Segundo',
        email,
      }),
    ).rejects.toThrow('Já existe uma conta com este e-mail.')
  })

  it('blocks password reset for planilha placeholder emails', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const placeholder = await fixtures.createCampaignUser('advisor', {
      email: `${fixtures.value('slug')}@planilha.invalid`,
    })

    await expect(
      sendAdvisorPasswordResetRecord(payload, coordinator, { advisorId: placeholder.id }),
    ).rejects.toThrow(/e-mail placeholder da planilha/i)
  })

  it('keeps preventAssignedAdvisorDowngrade when the advisor still has municipalities', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()

    await assignMunicipalityAdvisorsRecord(payload, coordinator, {
      municipality: municipality.id,
      advisors: [advisor.id],
    })
    fixtures.touchMunicipality(municipality.id)

    await expect(
      payload.update({
        collection: 'campaignUser',
        id: advisor.id,
        data: { role: 'leader' },
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/Remova ou substitua este usuário da assessoria/i)
  })

  it('is idempotent when toggling municipality membership', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()

    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [municipality.id],
      assigned: true,
    })
    fixtures.touchMunicipality(municipality.id)

    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [municipality.id],
      assigned: true,
    })
    expect(await advisorIdsOf(municipality.id)).toEqual([advisor.id])

    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [municipality.id],
      assigned: false,
    })
    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [municipality.id],
      assigned: false,
    })
    expect(await advisorIdsOf(municipality.id)).toEqual([])
  })

  it('assigns and removes multiple municipalities in one batch', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    // Both municipios go through the allocation mechanism: globally unique
    // across parallel spec files AND purged of residue on claim. The old
    // arbitrary `id not_equals` pick could land on a municipio a parallel test
    // had just filled to the 10-advisor cap, making the batch throw.
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    expect(second.id).not.toBe(first.id)

    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [first.id, second.id],
      assigned: true,
    })
    fixtures.touchMunicipality(first.id)
    fixtures.touchMunicipality(second.id)

    const assigned = await payload.find({
      collection: 'municipality',
      where: { advisors: { contains: advisor.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(assigned.docs.map((doc) => doc.id).sort((a, b) => a - b)).toEqual(
      [first.id, second.id].sort((a, b) => a - b),
    )

    await setAdvisorMunicipalitiesBatchRecord(payload, coordinator, {
      advisorId: advisor.id,
      municipalityIds: [first.id, second.id],
      assigned: false,
    })

    const cleared = await payload.find({
      collection: 'municipality',
      where: { advisors: { contains: advisor.id } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(cleared.docs).toHaveLength(0)
  })
})
