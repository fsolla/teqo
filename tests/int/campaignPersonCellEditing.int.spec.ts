// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  setPersonAdvisorMembershipRecord,
  setPersonAssessoraMembershipRecord,
  updatePersonContactRecord,
} from '@/app/(campaign)/campanha/actions/person'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
} from '@/lib/schemas/personCell'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('C116 — cell edits of the people list', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  describe('updatePersonContactRecord', () => {
    it('lets a coordinator edit name/email/city of a leadership-anchored person', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const municipality = await fixtures.getMunicipality()
      const contact = await fixtures.createContact({ city: 'Feira de Santana' })
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      await updatePersonContactRecord(payload, actor, {
        id: contact.id,
        field: 'name',
        name: 'Maria Nova da Silva',
      })
      await updatePersonContactRecord(payload, actor, {
        id: contact.id,
        field: 'city',
        city: 'Salvador',
      })
      await updatePersonContactRecord(payload, actor, {
        id: contact.id,
        field: 'phone',
        phone: '71999998888',
      })

      const updated = await payload.findByID({
        collection: 'contact',
        id: contact.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(updated.name).toBe('Maria Nova da Silva')
      expect(updated.city).toBe('Salvador')
      expect(updated.phone).toBe('71999998888')
    })

    it('lets an advisor edit a person anchored in his carteira', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      const contact = await fixtures.createContact()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      await updatePersonContactRecord(payload, advisor, {
        id: contact.id,
        field: 'name',
        name: 'Assessorada na Carteira',
      })

      const updated = await payload.findByID({
        collection: 'contact',
        id: contact.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(updated.name).toBe('Assessorada na Carteira')
    })

    it('denies an advisor a person whose entities are outside his carteira', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const outside = await fixtures.getMunicipality()
      const contact = await fixtures.createContact()
      await fixtures.createLeadership({ contact, municipalities: [outside] })

      await expect(
        updatePersonContactRecord(payload, advisor, {
          id: contact.id,
          field: 'name',
          name: 'Fora da Carteira',
        }),
      ).rejects.toThrow(PERSON_CELL_NOT_IN_SCOPE_MESSAGE)
    })

    it('denies an advisor a staff-only person (no leadership/dobradinha anchor)', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const contact = await fixtures.createContact()
      // The identity hook links the account to the existing ficha by phone.
      await fixtures.createCampaignUser('advisor', { phone: contact.phone })

      await expect(
        updatePersonContactRecord(payload, advisor, {
          id: contact.id,
          field: 'email',
          email: 'staff.only@example.com',
        }),
      ).rejects.toThrow(PERSON_CELL_NOT_IN_SCOPE_MESSAGE)
    })

    it('denies a leader actor', async () => {
      const fixtures = campaignFixtures()
      const leader = await fixtures.createCampaignUser('leader')
      const municipality = await fixtures.getMunicipality()
      const contact = await fixtures.createContact()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      await expect(
        updatePersonContactRecord(payload, leader, {
          id: contact.id,
          field: 'name',
          name: 'Líder não edita',
        }),
      ).rejects.toThrow(PERSON_CELL_STAFF_MESSAGE)
    })
  })

  describe('setPersonAssessoraMembershipRecord', () => {
    it('lets a coordinator toggle the single account of a person on municipalities', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      // The identity hook links the account to the existing ficha by phone.
      const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      const first = await fixtures.getMunicipality()
      const second = await fixtures.getMunicipality()

      await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [first.id, second.id],
        assigned: true,
      })

      for (const municipality of [first, second]) {
        const updated = await payload.findByID({
          collection: 'municipality',
          id: municipality.id,
          depth: 0,
          select: { advisors: true },
          overrideAccess: true,
        })
        expect(uniqueRelationshipIds(updated.advisors)).toContain(account.id)
      }

      await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [first.id],
        assigned: false,
      })
      const updatedFirst = await payload.findByID({
        collection: 'municipality',
        id: first.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(updatedFirst.advisors)).not.toContain(account.id)
    })

    it('refuses a person with more than one staff account', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      const municipality = await fixtures.getMunicipality()

      await expect(
        setPersonAssessoraMembershipRecord(payload, actor, {
          contactId: contact.id,
          municipalityIds: [municipality.id],
          assigned: true,
        }),
      ).rejects.toThrow(PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE)
    })

    it('refuses a person with no staff account', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()

      await expect(
        setPersonAssessoraMembershipRecord(payload, actor, {
          contactId: contact.id,
          municipalityIds: [municipality.id],
          assigned: true,
        }),
      ).rejects.toThrow(PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE)
    })

    it('denies an advisor actor', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()

      await expect(
        setPersonAssessoraMembershipRecord(payload, advisor, {
          contactId: contact.id,
          municipalityIds: [municipality.id],
          assigned: true,
        }),
      ).rejects.toThrow(PERSON_ASSESSORA_UNRESTRICTED_MESSAGE)
    })
  })

  describe('setPersonAdvisorMembershipRecord', () => {
    it('writes the advisor delta on EVERY entity of the person (leadership + dobradinha)', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })
      await fixtures.createStateDeputy({ contact })
      const advisor = await fixtures.createCampaignUser('advisor')

      await setPersonAdvisorMembershipRecord(payload, actor, {
        contactId: contact.id,
        advisorId: advisor.id,
        assigned: true,
      })

      const leadership = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const deputy = await payload.find({
        collection: 'stateDeputy',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(leadership.docs[0].advisors)).toContain(advisor.id)
      expect(uniqueRelationshipIds(deputy.docs[0].advisors)).toContain(advisor.id)

      await setPersonAdvisorMembershipRecord(payload, actor, {
        contactId: contact.id,
        advisorId: advisor.id,
        assigned: false,
      })
      const leadershipAfter = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const deputyAfter = await payload.find({
        collection: 'stateDeputy',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(leadershipAfter.docs[0].advisors)).not.toContain(advisor.id)
      expect(uniqueRelationshipIds(deputyAfter.docs[0].advisors)).not.toContain(advisor.id)
    })

    it('denies an advisor actor', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      await expect(
        setPersonAdvisorMembershipRecord(payload, advisor, {
          contactId: contact.id,
          advisorId: advisor.id,
          assigned: true,
        }),
      ).rejects.toThrow(PERSON_ADVISORS_UNRESTRICTED_MESSAGE)
    })
  })
})
