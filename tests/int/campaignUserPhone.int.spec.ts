// @vitest-environment node

import {
  getPayload,
  type Field,
  type FieldAccess,
  type Payload,
  type PayloadRequest,
} from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { CampaignUser as CampaignUserCollection } from '@/collections/CampaignUser'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'

import { withCampaignFixtures, type CampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

type FieldAccessArgs = Parameters<FieldAccess>[0]

let payload: Payload

// Builds the engaged Contact → Leadership link that grants contextual phone access.
const createEngagedPhoneAccessGraph = async (
  fixtures: CampaignFixtures,
  coordinator: CampaignUser,
  leader: CampaignUser,
  municipality: number,
) => {
  const contact = await fixtures.createContact({
    name: fixtures.value('Contato telefone'),
    phone: fixtures.phone(),
  })
  return fixtures.createLeadership({
    contact,
    municipalities: [municipality],
    user: leader,
    supportStatus: 'engajado',
    createdBy: coordinator,
  })
}

const phoneField = (): Extract<Field, { name: string }> => {
  const field = CampaignUserCollection.fields.find(
    (candidate): candidate is Extract<Field, { name: string }> =>
      'name' in candidate && candidate.name === 'phone',
  )
  if (!field) throw new Error('Campo phone não configurado.')
  return field
}

describe('campaign user contact phone', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('normalizes the optional non-auth contact phone', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const user = await fixtures.createCampaignUser('advisor', {
        phone: '+55 (71) 99999-1234',
      })

      expect(user.phone).toBe('71999991234')
      expect(user.username).toBeNull()
      expect(phoneField()).toMatchObject({
        name: 'phone',
        label: 'Celular de contato',
        type: 'text',
        index: true,
      })
    })
  })

  it('omits advisor contact phones from leader reads (lockdown)', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const advisorPhone = fixtures.phone()
      const advisor = await fixtures.createCampaignUser('advisor', {
        phone: advisorPhone,
      })
      const leader = await fixtures.createCampaignUser('leader', {
        phone: fixtures.phone(),
      })
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      await createEngagedPhoneAccessGraph(fixtures, coordinator, leader, municipality.id)

      // Leaders are lockdown accounts: even for advisors of their own linked
      // municipality, the phone field must be withheld.
      const advisorRead = await payload.findByID({
        collection: 'campaignUser',
        id: advisor.id,
        depth: 0,
        select: { name: true, phone: true },
        user: leader,
        overrideAccess: false,
      })

      expect(advisorRead.phone).toBeUndefined()
      expect(JSON.stringify(advisorRead)).not.toContain(advisorPhone)
    })
  })

  it('lets an advisor read a colleague advisor of a shared municipality only', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const colleaguePhone = fixtures.phone()
      const foreignPhone = fixtures.phone()
      const viewer = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })
      const colleague = await fixtures.createCampaignUser('advisor', { phone: colleaguePhone })
      const foreignAdvisor = await fixtures.createCampaignUser('advisor', {
        phone: foreignPhone,
      })
      const shared = await fixtures.getMunicipality()
      const foreignMunicipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(shared, [viewer, colleague])
      await fixtures.assignMunicipalityAdvisors(foreignMunicipality, [foreignAdvisor])

      const visibleColleague = await payload.findByID({
        collection: 'campaignUser',
        id: colleague.id,
        depth: 0,
        select: { name: true, phone: true },
        user: viewer,
        overrideAccess: false,
      })
      const hiddenForeign = await payload.findByID({
        collection: 'campaignUser',
        id: foreignAdvisor.id,
        depth: 0,
        select: { name: true, phone: true },
        user: viewer,
        overrideAccess: false,
      })

      expect(visibleColleague.phone).toBe(colleaguePhone)
      expect(hiddenForeign.phone).toBeUndefined()
    })
  })

  it('does not leak foreign phones through direct list API reads', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const advisorPhone = fixtures.phone()
      const foreignPhone = fixtures.phone()
      const advisor = await fixtures.createCampaignUser('advisor', {
        phone: advisorPhone,
      })
      const foreignAdvisor = await fixtures.createCampaignUser('advisor', {
        phone: foreignPhone,
      })
      const leader = await fixtures.createCampaignUser('leader', {
        phone: fixtures.phone(),
      })
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      await createEngagedPhoneAccessGraph(fixtures, coordinator, leader, municipality.id)

      const result = await payload.find({
        collection: 'campaignUser',
        where: { id: { in: [advisor.id, foreignAdvisor.id] } },
        depth: 0,
        pagination: false,
        select: { name: true, phone: true },
        user: leader,
        overrideAccess: false,
      })
      const byId = new Map(result.docs.map((doc) => [doc.id, doc]))

      // Leaders are lockdown accounts: no staff phone is visible, linked
      // municipality or not.
      expect(byId.get(advisor.id)?.phone).toBeUndefined()
      expect(byId.get(foreignAdvisor.id)?.phone).toBeUndefined()
      expect(JSON.stringify(result.docs)).not.toContain(advisorPhone)
      expect(JSON.stringify(result.docs)).not.toContain(foreignPhone)
    })
  })

  it('allows the record owner, coordinator, and Payload admin to read contact phone', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const phone = fixtures.phone()
      const owner = await fixtures.createCampaignUser('leader', { phone })
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const admin = await fixtures.createAdminUser({
        email: `${fixtures.value('phone-admin')}@example.com`,
        password: fixtures.value('password'),
      })

      for (const viewer of [owner, coordinator, admin]) {
        const visible = await payload.findByID({
          collection: 'campaignUser',
          id: owner.id,
          depth: 0,
          select: { name: true, phone: true },
          user: viewer,
          overrideAccess: false,
        })
        expect(visible.phone).toBe(phone)
      }
    })
  })

  it('lets advisor read contact phones of coordinator users', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinatorPhone = fixtures.phone()
      const coordinator = await fixtures.createCampaignUser('coordinator', {
        phone: coordinatorPhone,
      })
      const advisor = await fixtures.createCampaignUser('advisor', {
        phone: fixtures.phone(),
      })
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

      const visible = await payload.findByID({
        collection: 'campaignUser',
        id: coordinator.id,
        depth: 0,
        select: { name: true, phone: true },
        user: advisor,
        overrideAccess: false,
      })
      expect(visible.phone).toBe(coordinatorPhone)
    })
  })

  it('allows owner and coordinator field updates but protects create from ordinary users', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const owner = await fixtures.createCampaignUser('leader', {
        phone: fixtures.phone(),
      })
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const field = phoneField()
      if (field.type !== 'text') throw new Error('Campo phone deve ser text.')
      const ownerReq = {
        context: {},
        payload,
        user: owner,
      } as unknown as PayloadRequest
      const coordinatorReq = {
        context: {},
        payload,
        user: coordinator,
      } as unknown as PayloadRequest

      await expect(
        field.access?.update?.(stub<FieldAccessArgs>({ id: owner.id, req: ownerReq })),
      ).resolves.toBe(true)
      await expect(
        field.access?.update?.(stub<FieldAccessArgs>({ id: owner.id, req: coordinatorReq })),
      ).resolves.toBe(true)
      await expect(field.access?.create?.(stub<FieldAccessArgs>({ req: ownerReq }))).resolves.toBe(
        false,
      )
      await expect(
        field.access?.create?.(stub<FieldAccessArgs>({ req: coordinatorReq })),
      ).resolves.toBe(true)
    })
  })
})
