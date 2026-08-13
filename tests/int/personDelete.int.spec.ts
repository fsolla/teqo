// @vitest-environment node

import type { Payload, Where } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  PERSON_DELETE_FORBIDDEN_MESSAGE,
  PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE,
} from '@/lib/schemas/personDelete'
import config from '@/payload.config'
import { deletePersonRecord, loadPersonDeleteManifest } from '@/utilities/people/personDelete'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const countRemaining = async (
  collection:
    | 'contact'
    | 'leadership'
    | 'stateDeputy'
    | 'campaignUser'
    | 'votePledge'
    | 'supporter',
  where: Where,
): Promise<number> => {
  const result = await payload.find({
    collection,
    where,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return result.totalDocs
}

describe('C100 — apagar pessoa (manifest + cascata)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('lists every cascade target in the manifest', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    // OPS45 — the dobradinha name is a GLOBAL invariant
    // (`assertStateDeputyNameAvailable`): a fixed name would collide with any
    // residue row a crashed run left behind, so it must be unique per run.
    const contactName = fixtures.personName('Maria de Jesus')
    const contact = await fixtures.createContact({ name: contactName })
    const leadership = await fixtures.createLeadership({ contact, municipalities: [municipality] })
    await fixtures.createVotePledge({ leadership, municipality })
    const advisor = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
    await fixtures.createStateDeputy({ contact, party: 'PT' })
    await fixtures.createInvite({ leadership, createdBy: coordinator })
    await fixtures.createSupporter({ contact })

    const manifest = await loadPersonDeleteManifest(payload, contact.id)

    expect(manifest).not.toBeNull()
    expect(manifest?.contact.name).toBe(contactName)
    expect(manifest?.leaderships).toHaveLength(1)
    expect(manifest?.leaderships[0]?.municipalityNames).toContain(municipality.name)
    expect(manifest?.stateDeputies).toHaveLength(1)
    expect(manifest?.stateDeputies[0]?.party).toBe('PT')
    expect(manifest?.pledgeCount).toBe(1)
    expect(manifest?.inviteCount).toBe(1)
    expect(manifest?.supporterCount).toBe(1)
    expect(manifest?.accounts.map((account) => account.id)).toContain(advisor.id)
    expect(manifest?.hasProtectedAccount).toBe(false)
    expect(manifest?.fichaWillBeAnonymized).toBe(false)
  })

  it('cascade-deletes every campaign row and the ficha', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('João do Brejo') })
    const leadership = await fixtures.createLeadership({ contact, municipalities: [municipality] })
    await fixtures.createVotePledge({ leadership, municipality })
    await fixtures.createStateDeputy({ contact, party: 'PCdoB' })
    const advisor = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
    await fixtures.createSupporter({ contact })

    const result = await deletePersonRecord(payload, coordinator, contact.id)

    expect(result.removed).toBe(true)
    expect(result.contactDeleted).toBe(true)
    expect(result.contactAnonymized).toBe(false)
    expect(result.deletedAccounts).toBe(1)

    expect(await countRemaining('contact', { id: { equals: contact.id } })).toBe(0)
    expect(await countRemaining('leadership', { id: { equals: leadership.id } })).toBe(0)
    expect(await countRemaining('stateDeputy', { contact: { equals: contact.id } })).toBe(0)
    expect(await countRemaining('campaignUser', { id: { equals: advisor.id } })).toBe(0)
    expect(await countRemaining('votePledge', { leadership: { equals: leadership.id } })).toBe(0)
    expect(await countRemaining('supporter', { contact: { equals: contact.id } })).toBe(0)
  })

  it('anonymizes the ficha when a public join still references it', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('Ana Lima') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })
    const consent = await fixtures.createConsent()
    const subscription = await payload.create({
      collection: 'subscription',
      data: { contact: contact.id, consent: consent.id },
      depth: 0,
    })

    try {
      const manifest = await loadPersonDeleteManifest(payload, contact.id)
      expect(manifest?.fichaWillBeAnonymized).toBe(true)

      const result = await deletePersonRecord(payload, coordinator, contact.id)
      expect(result.contactDeleted).toBe(false)
      expect(result.contactAnonymized).toBe(true)

      const remaining = await payload.findByID({
        collection: 'contact',
        id: contact.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(remaining.name).toBe('Titular removido')
      expect(remaining.phones?.[0]?.value).toMatch(/^999\d{8}$/)
      expect(remaining.phones).toHaveLength(1)
      expect(remaining.email).toBeNull()
      expect(remaining.city).toBeNull()
    } finally {
      await payload.delete({
        collection: 'subscription',
        id: subscription.id,
        depth: 0,
        overrideAccess: true,
      })
    }
  })

  it('refuses to delete a person holding a coordinator account', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('Protegida') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })
    await fixtures.createCampaignUser('coordinator', { phone: contact.phone })

    const manifest = await loadPersonDeleteManifest(payload, contact.id)
    expect(manifest?.hasProtectedAccount).toBe(true)

    await expect(deletePersonRecord(payload, coordinator, contact.id)).rejects.toThrow(
      PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE,
    )
    expect(await countRemaining('leadership', { contact: { equals: contact.id } })).toBe(1)
  })

  it('refuses non-unrestricted actors', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('Alguém') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })

    await expect(deletePersonRecord(payload, advisor, contact.id)).rejects.toThrow(
      PERSON_DELETE_FORBIDDEN_MESSAGE,
    )
  })

  it('returns a null manifest for an unknown contact', async () => {
    const fixtures = campaignFixtures()
    await fixtures.createCampaignUser('coordinator')

    const manifest = await loadPersonDeleteManifest(payload, 999999999)
    expect(manifest).toBeNull()
  })
})
