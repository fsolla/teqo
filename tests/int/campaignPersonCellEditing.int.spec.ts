// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  setPersonAdvisorMembershipRecord,
  setPersonAssessoraMembershipRecord,
  setPersonLeadershipMunicipalitiesRecord,
  setPersonStateDeputyMunicipalitiesRecord,
  updatePersonContactRecord,
} from '@/app/(campaign)/campanha/actions/person'
import { primaryPhoneOf } from '@/lib/phone'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CAPACITY_EXIT_SCOPE_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
} from '@/lib/schemas/personCell'
import { STATE_DEPUTY_CONFLICT_MESSAGE } from '@/lib/schemas/stateDeputy'
import config from '@/payload.config'
import { loadPersonCapacityExitManifest } from '@/utilities/people/personCapacityExit'

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
      // C112 shape: the cell edit set the PRIMARY phone, the ficha list carries it first.
      expect(primaryPhoneOf(updated.phones)).toBe('71999998888')
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

    it('creates the account on the first municipality (C128 lifecycle)', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const first = await fixtures.getMunicipality()

      await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [first.id],
        assigned: true,
      })

      // The account is born with the person's ficha, role advisor and a
      // placeholder e-mail — no usable credentials, login provisioned later.
      const accounts = await payload.find({
        collection: 'campaignUser',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(accounts.docs).toHaveLength(1)
      const account = accounts.docs[0]
      expect(account.role).toBe('advisor')
      expect(account.username).toBeFalsy()
      expect(account.email).toMatch(/@criado\.invalid$/)

      const updated = await payload.findByID({
        collection: 'municipality',
        id: first.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(updated.advisors)).toContain(account.id)
    })

    it('deletes the account when the last municipality leaves (C128 lifecycle)', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      const only = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(only, [account])

      await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [only.id],
        assigned: false,
      })

      const remaining = await payload.find({
        collection: 'campaignUser',
        where: { id: { equals: account.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(remaining.docs).toHaveLength(0)
      const updated = await payload.findByID({
        collection: 'municipality',
        id: only.id,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(updated.advisors)).not.toContain(account.id)
    })

    it('treats a removal on a person without an account as a no-op', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()

      const result = await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: false,
      })
      expect(result.accountId).toBeNull()
    })

    it('cascades authored rows when the account dies on the last municipality', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      const only = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(only, [account])
      const leadership = await fixtures.createLeadership({
        contact: await fixtures.createContact(),
        municipalities: [only],
      })
      await fixtures.createInvite({ leadership, createdBy: account })
      await fixtures.createMunicipalityUpdate({ municipality: only, author: account })

      await setPersonAssessoraMembershipRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [only.id],
        assigned: false,
      })

      const remaining = await payload.find({
        collection: 'campaignUser',
        where: { id: { equals: account.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(remaining.docs).toHaveLength(0)
      // The NOT NULL authored rows went down with the account (same order as
      // the person cascade).
      const invites = await payload.find({
        collection: 'campaignInvite',
        where: { createdBy: { equals: account.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(invites.docs).toHaveLength(0)
      const updates = await payload.find({
        collection: 'municipalityUpdate',
        where: { author: { equals: account.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(updates.docs).toHaveLength(0)
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

  describe('setPersonLeadershipMunicipalitiesRecord (C128 lifecycle)', () => {
    it('creates the leadership on the first municipality', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const first = await fixtures.getMunicipality()

      await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [first.id],
        assigned: true,
      })

      const leaderships = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(leaderships.docs).toHaveLength(1)
      expect(uniqueRelationshipIds(leaderships.docs[0].municipalities)).toContain(first.id)
    })

    it('lets an advisor create the leadership inside his carteira', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      const contact = await fixtures.createContact()

      await setPersonLeadershipMunicipalitiesRecord(payload, advisor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: true,
      })

      const leaderships = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(leaderships.docs).toHaveLength(1)
    })

    it('deletes the leadership with its pledges and invites on the last municipality', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality],
      })
      await fixtures.createVotePledge({ leadership, municipality, declaredVotes: 250 })
      const staff = await fixtures.createCampaignUser('advisor')
      await fixtures.createInvite({ leadership, createdBy: staff })

      await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: false,
      })

      const remaining = await payload.find({
        collection: 'leadership',
        where: { id: { equals: leadership.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(remaining.docs).toHaveLength(0)
      const pledges = await payload.find({
        collection: 'votePledge',
        where: { leadership: { equals: leadership.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(pledges.docs).toHaveLength(0)
      const invites = await payload.find({
        collection: 'campaignInvite',
        where: { leadership: { equals: leadership.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(invites.docs).toHaveLength(0)
    })

    it('lets an advisor empty a leadership fully inside his carteira', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const municipality = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      const contact = await fixtures.createContact()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality],
      })

      await setPersonLeadershipMunicipalitiesRecord(payload, advisor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: false,
      })

      const remaining = await payload.find({
        collection: 'leadership',
        where: { id: { equals: leadership.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(remaining.docs).toHaveLength(0)
    })

    it('refuses an advisor emptying a leadership with municipalities outside his carteira', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const inScope = await fixtures.getMunicipality()
      await fixtures.assignMunicipalityAdvisors(inScope, [advisor])
      const outside = await fixtures.getMunicipality()
      const contact = await fixtures.createContact()
      await fixtures.createLeadership({ contact, municipalities: [inScope, outside] })

      // The whole capacity in one batch: with `outside` out of the carteira,
      // the destructive exit must be refused server-side (the client never
      // renders that chip, but the server re-checks).
      await expect(
        setPersonLeadershipMunicipalitiesRecord(payload, advisor, {
          contactId: contact.id,
          municipalityIds: [inScope.id, outside.id],
          assigned: false,
        }),
      ).rejects.toThrow(PERSON_CAPACITY_EXIT_SCOPE_MESSAGE)
    })

    it('treats a removal on a person without a leadership as a no-op', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()

      const result = await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: false,
      })
      expect(result.leadershipID).toBeNull()
    })

    it('resolves an add on a person whose leadership already exists as a no-op', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      const result = await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: true,
      })
      expect(result.leadershipID).toBeNull()
    })

    it('re-creates the leadership when the undo toast re-adds after the exit', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality],
      })

      await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: false,
      })
      const gone = await payload.find({
        collection: 'leadership',
        where: { id: { equals: leadership.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(gone.docs).toHaveLength(0)

      // The undo path re-adds (`assigned=true`) — the lifecycle must bring the
      // entity back (fresh, empty).
      await setPersonLeadershipMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [municipality.id],
        assigned: true,
      })
      const reborn = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(reborn.docs).toHaveLength(1)
      expect(uniqueRelationshipIds(reborn.docs[0].municipalities)).toContain(municipality.id)
    })
  })

  describe('setPersonStateDeputyMunicipalitiesRecord (C128 lifecycle)', () => {
    it('creates the dobradinha on the first municipality with an auto-slug', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const first = await fixtures.getMunicipality()

      await setPersonStateDeputyMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [first.id],
        assigned: true,
      })

      const deputies = await payload.find({
        collection: 'stateDeputy',
        where: { contact: { equals: contact.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(deputies.docs).toHaveLength(1)
      expect(deputies.docs[0].slug).toBeTruthy()
      const updated = await payload.findByID({
        collection: 'municipality',
        id: first.id,
        depth: 0,
        select: { stateDeputies: true },
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(updated.stateDeputies)).toContain(deputies.docs[0].id)
    })

    it('deletes the dobradinha and its municipality links on the last municipality', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const only = await fixtures.getMunicipality()
      const deputy = await fixtures.createStateDeputy({ contact })
      await payload.update({
        collection: 'municipality',
        id: only.id,
        data: { stateDeputies: [deputy.id] },
        depth: 0,
        overrideAccess: true,
      })

      await setPersonStateDeputyMunicipalitiesRecord(payload, actor, {
        contactId: contact.id,
        municipalityIds: [only.id],
        assigned: false,
      })

      const remaining = await payload.find({
        collection: 'stateDeputy',
        where: { id: { equals: deputy.id } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      expect(remaining.docs).toHaveLength(0)
      const updated = await payload.findByID({
        collection: 'municipality',
        id: only.id,
        depth: 0,
        select: { stateDeputies: true },
        overrideAccess: true,
      })
      expect(uniqueRelationshipIds(updated.stateDeputies)).not.toContain(deputy.id)
    })

    it('refuses a dobradinha whose name is already taken', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const municipality = await fixtures.getMunicipality()
      // The second ficha must carry the same name to trip the unique-name rule.
      const existing = await fixtures.createContact()
      await fixtures.createStateDeputy({ contact: existing })
      const contact = await fixtures.createContact({ name: existing.name })

      await expect(
        setPersonStateDeputyMunicipalitiesRecord(payload, actor, {
          contactId: contact.id,
          municipalityIds: [municipality.id],
          assigned: true,
        }),
      ).rejects.toThrow(STATE_DEPUTY_CONFLICT_MESSAGE)
    })
  })

  describe('loadPersonCapacityExitManifest (C128 destructive exit)', () => {
    it('lists the declared votes and invites of a leadership', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality],
      })
      await fixtures.createVotePledge({ leadership, municipality, declaredVotes: 250 })
      const staff = await fixtures.createCampaignUser('advisor')
      await fixtures.createInvite({ leadership, createdBy: staff })

      const manifest = await loadPersonCapacityExitManifest(payload, actor, {
        capacity: 'leadership',
        contactId: contact.id,
      })
      expect(manifest).toMatchObject({
        capacity: 'leadership',
        declaredVoteCount: 250,
        inviteCount: 1,
      })
    })

    it('returns an empty-but-present manifest for a leadership without votes or invites', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      await fixtures.createLeadership({ contact, municipalities: [municipality] })

      const manifest = await loadPersonCapacityExitManifest(payload, actor, {
        capacity: 'leadership',
        contactId: contact.id,
      })
      expect(manifest).toMatchObject({
        capacity: 'leadership',
        declaredVoteCount: 0,
        inviteCount: 0,
      })
    })

    it('lists the account, authored rows and assessorado links of a staff person', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()
      const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
      const municipality = await fixtures.getMunicipality()
      const leadership = await fixtures.createLeadership({
        contact: await fixtures.createContact(),
        municipalities: [municipality],
      })
      await fixtures.createInvite({ leadership, createdBy: account })
      await fixtures.createMunicipalityUpdate({ municipality, author: account })

      const manifest = await loadPersonCapacityExitManifest(payload, actor, {
        capacity: 'account',
        contactId: contact.id,
      })
      expect(manifest).toMatchObject({
        capacity: 'account',
        accountName: account.name,
        authored: { inviteCount: 1, updateCount: 1, feedCount: 0, importBatchCount: 0 },
      })
    })

    it('refuses an advisor the account manifest', async () => {
      const fixtures = campaignFixtures()
      const advisor = await fixtures.createCampaignUser('advisor')
      const contact = await fixtures.createContact()
      await fixtures.createCampaignUser('advisor', { phone: contact.phone })

      await expect(
        loadPersonCapacityExitManifest(payload, advisor, {
          capacity: 'account',
          contactId: contact.id,
        }),
      ).rejects.toThrow(PERSON_CAPACITY_EXIT_SCOPE_MESSAGE)
    })

    it('is null when the capacity has no entity', async () => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser('coordinator')
      const contact = await fixtures.createContact()

      const manifest = await loadPersonCapacityExitManifest(payload, actor, {
        capacity: 'leadership',
        contactId: contact.id,
      })
      expect(manifest).toBeNull()
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
