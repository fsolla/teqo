// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { getNucleusShareRecipients } from '@/utilities/nucleusShareRecipients'

import { withCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload

describe('getNucleusShareRecipients', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns geral, nucleus coordinators, and engaged leaderships for staff', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const generalPhone = fixtures.phone()
      const coordinatorPhone = fixtures.phone()
      const engagedPhone = fixtures.phone()
      const general = await fixtures.createCampaignUser('geral', { phone: generalPhone })
      const coordinator = await fixtures.createCampaignUser('coordenador', {
        phone: coordinatorPhone,
      })
      const geralAsCoordinator = await fixtures.createCampaignUser('geral', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({
        coordinators: [coordinator.id, geralAsCoordinator.id],
      })
      const engagedContact = await fixtures.createContact({
        name: fixtures.value('Liderança engajada'),
        phone: engagedPhone,
      })
      const engaged = await fixtures.createLeadership({
        contact: engagedContact,
        nucleus: nucleus.id,
        supportStatus: 'engajado',
        createdBy: general,
      })
      const pendingContact = await fixtures.createContact({
        name: fixtures.value('Liderança pendente'),
        phone: fixtures.phone(),
      })
      await fixtures.createLeadership({
        contact: pendingContact,
        nucleus: nucleus.id,
        supportStatus: 'a_abordar',
        createdBy: general,
      })

      const recipients = await getNucleusShareRecipients(payload, general, nucleus.slug)

      expect(recipients.general.map((item) => item.id)).toEqual(
        expect.arrayContaining([general.id, geralAsCoordinator.id]),
      )
      expect(recipients.general.every((item) => Boolean(item.phone))).toBe(true)
      expect(recipients.coordinators).toEqual([
        { id: coordinator.id, name: coordinator.name, phone: coordinatorPhone },
      ])
      expect(recipients.leaderships).toEqual([
        { id: engaged.id, name: engagedContact.name, phone: engagedPhone },
      ])
    })
  })

  it('hides leadership recipients for lideranca and still exposes geral phones', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const generalPhone = fixtures.phone()
      const coordinatorPhone = fixtures.phone()
      const general = await fixtures.createCampaignUser('geral', { phone: generalPhone })
      const coordinator = await fixtures.createCampaignUser('coordenador', {
        phone: coordinatorPhone,
      })
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      const contact = await fixtures.createContact({
        name: fixtures.value('Contato líder'),
        phone: fixtures.phone(),
      })
      await fixtures.createLeadership({
        contact,
        nucleus: nucleus.id,
        user: leader,
        supportStatus: 'engajado',
        createdBy: general,
      })
      await fixtures.createLeadership({
        contact: await fixtures.createContact({
          name: fixtures.value('Outra liderança'),
          phone: fixtures.phone(),
        }),
        nucleus: nucleus.id,
        supportStatus: 'engajado',
        createdBy: general,
      })

      const recipients = await getNucleusShareRecipients(payload, leader, nucleus.slug)

      expect(
        recipients.general.some((item) => item.id === general.id && item.phone === generalPhone),
      ).toBe(true)
      expect(recipients.coordinators).toEqual([
        { id: coordinator.id, name: coordinator.name, phone: coordinatorPhone },
      ])
      expect(recipients.leaderships).toEqual([])
    })
  })

  it('omits recipients without a readable phone', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const generalWithPhone = await fixtures.createCampaignUser('geral', {
        phone: fixtures.phone(),
      })
      const generalWithoutPhone = await fixtures.createCampaignUser('geral')
      const coordinatorWithoutPhone = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus({
        coordinators: [coordinatorWithoutPhone.id],
      })

      const recipients = await getNucleusShareRecipients(
        payload,
        generalWithPhone,
        nucleus.slug,
      )

      expect(recipients.general.map((item) => item.id)).toContain(generalWithPhone.id)
      expect(recipients.general.map((item) => item.id)).not.toContain(generalWithoutPhone.id)
      expect(recipients.coordinators).toEqual([])
    })
  })

  it('rejects inaccessible nuclei', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const foreignCoordinator = await fixtures.createCampaignUser('coordenador', {
        phone: fixtures.phone(),
      })
      const outsider = await fixtures.createCampaignUser('coordenador', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({
        coordinators: [foreignCoordinator.id],
      })

      await expect(getNucleusShareRecipients(payload, outsider, nucleus.slug)).rejects.toThrow(
        'Núcleo não encontrado ou sem acesso.',
      )
    })
  })
})
