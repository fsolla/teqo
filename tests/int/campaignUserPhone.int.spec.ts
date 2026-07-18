// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Field, type Payload, type PayloadRequest } from 'payload'

import { CampaignUser as CampaignUserCollection } from '@/collections/CampaignUser'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'

import {
  type CampaignFixtures,
  withCampaignFixtures,
} from '../helpers/campaignFixtures'

let payload: Payload

// Builds the engaged Contact → Leadership link that grants contextual phone access.
const createEngagedPhoneAccessGraph = async (
  fixtures: CampaignFixtures,
  general: CampaignUser,
  leader: CampaignUser,
  nucleus: number,
) => {
  const contact = await fixtures.createContact({
    name: fixtures.value('Contato telefone'),
    phone: fixtures.phone(),
  })
  return fixtures.createLeadership({
    contact,
    nucleus,
    user: leader,
    supportStatus: 'engajado',
    createdBy: general,
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
      const user = await fixtures.createCampaignUser('coordenador', {
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

  it('lets an engaged leadership read only coordinators from accessible nuclei', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinatorPhone = fixtures.phone()
      const foreignPhone = fixtures.phone()
      const coordinator = await fixtures.createCampaignUser('coordenador', {
        phone: coordinatorPhone,
      })
      const foreignCoordinator = await fixtures.createCampaignUser('coordenador', {
        phone: foreignPhone,
      })
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const foreignLeader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      await fixtures.createNucleus({ coordinators: [foreignCoordinator.id] })
      await createEngagedPhoneAccessGraph(fixtures, general, leader, nucleus.id)

      const visibleCoordinator = await payload.findByID({
        collection: 'campaignUser',
        id: coordinator.id,
        depth: 0,
        select: { name: true, phone: true },
        user: leader,
        overrideAccess: false,
      })
      const hiddenForeignCoordinator = await payload.findByID({
        collection: 'campaignUser',
        id: foreignCoordinator.id,
        depth: 0,
        select: { name: true, phone: true },
        user: leader,
        overrideAccess: false,
      })
      const hiddenFromUnlinkedLeader = await payload.findByID({
        collection: 'campaignUser',
        id: coordinator.id,
        depth: 0,
        select: { name: true, phone: true },
        user: foreignLeader,
        overrideAccess: false,
      })

      expect(visibleCoordinator.phone).toBe(coordinatorPhone)
      expect(hiddenForeignCoordinator.phone).toBeUndefined()
      expect(hiddenFromUnlinkedLeader.phone).toBeUndefined()
    })
  })

  it('does not leak foreign phones through direct list API reads', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinatorPhone = fixtures.phone()
      const foreignPhone = fixtures.phone()
      const coordinator = await fixtures.createCampaignUser('coordenador', {
        phone: coordinatorPhone,
      })
      const foreignCoordinator = await fixtures.createCampaignUser('coordenador', {
        phone: foreignPhone,
      })
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      await createEngagedPhoneAccessGraph(fixtures, general, leader, nucleus.id)

      const result = await payload.find({
        collection: 'campaignUser',
        where: { id: { in: [coordinator.id, foreignCoordinator.id] } },
        depth: 0,
        pagination: false,
        select: { name: true, phone: true },
        user: leader,
        overrideAccess: false,
      })
      const byId = new Map(result.docs.map((doc) => [doc.id, doc]))

      expect(byId.get(coordinator.id)?.phone).toBe(coordinatorPhone)
      expect(byId.get(foreignCoordinator.id)?.phone).toBeUndefined()
      expect(JSON.stringify(result.docs)).not.toContain(foreignPhone)
    })
  })

  it('allows the record owner, geral, and Payload admin to read contact phone', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const phone = fixtures.phone()
      const owner = await fixtures.createCampaignUser('lideranca', { phone })
      const general = await fixtures.createCampaignUser('geral')
      const admin = await fixtures.createAdminUser({
        email: `${fixtures.value('phone-admin')}@example.com`,
        password: fixtures.value('password'),
      })

      for (const viewer of [owner, general, admin]) {
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

  it('allows owner and geral field updates but protects create from ordinary users', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const owner = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const general = await fixtures.createCampaignUser('geral')
      const field = phoneField()
      if (field.type !== 'text') throw new Error('Campo phone deve ser text.')
      const ownerReq = {
        context: {},
        payload,
        user: owner,
      } as unknown as PayloadRequest
      const generalReq = {
        context: {},
        payload,
        user: general,
      } as unknown as PayloadRequest

      await expect(field.access?.update?.({ id: owner.id, req: ownerReq } as never)).resolves.toBe(
        true,
      )
      await expect(field.access?.update?.({ id: owner.id, req: generalReq } as never)).resolves.toBe(
        true,
      )
      await expect(field.access?.create?.({ req: ownerReq } as never)).resolves.toBe(false)
      await expect(field.access?.create?.({ req: generalReq } as never)).resolves.toBe(true)
    })
  })
})
