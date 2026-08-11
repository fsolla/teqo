// @vitest-environment node

import { readFileSync } from 'node:fs'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createLeadershipRecord,
  listMunicipalityLeaderships,
  updateLeadershipContactRecord,
  updateLeadershipInternalRecord,
} from '@/app/(campaign)/campanha/actions/leadership'
import { Contact } from '@/collections/Contact'
import { Leadership } from '@/collections/Leadership'
import { contactSchema } from '@/lib/schemas/contact'
import { leadershipCreateSchema, leadershipInternalUpdateSchema } from '@/lib/schemas/leadership'
import config from '@/payload.config'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const DUPLICATE_LEADERSHIP_MESSAGE =
  'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novos municípios.'
const OUT_OF_SCOPE_MUNICIPALITY_MESSAGE =
  'Você só pode vincular lideranças aos municípios que assessora.'

describe('campaign leadership domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('makes Contact email optional while public contact flows still require it', () => {
    expect(Contact.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'email', required: false }),
        expect.objectContaining({ name: 'phone', index: true }),
        expect.objectContaining({ name: 'gender', type: 'select' }),
      ]),
    )

    expect(
      contactSchema.safeParse({
        name: 'Maria Silva',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      }).success,
    ).toBe(false)
  })

  it('normalizes leadership phone input and excludes protected audit fields', () => {
    const parsed = leadershipCreateSchema.parse({
      municipalities: [1, 1, 2],
      name: 'Maria da Silva',
      phone: '+55 (71) 99999-0000',
      supportStatus: 'engajado',
      createdBy: 999,
      user: 999,
      consent: 999,
    })

    expect(parsed.phone).toBe('71999990000')
    expect(parsed.municipalities).toEqual([1, 2])
    expect(Object.hasOwn(parsed, 'createdBy')).toBe(false)
    expect(Object.hasOwn(parsed, 'user')).toBe(false)
    expect(Object.hasOwn(parsed, 'consent')).toBe(false)
    expect(() =>
      leadershipCreateSchema.parse({
        municipalities: [],
        name: 'Sem município',
        phone: '71999990000',
      }),
    ).toThrow()
    const update = leadershipInternalUpdateSchema.parse({
      id: 1,
      contact: 999,
      user: 999,
      createdBy: 999,
    })
    expect(update).toEqual({ id: 1 })
  })

  it('keeps direct leadership PATCH text states exact', () => {
    expect(
      leadershipInternalUpdateSchema.parse({
        id: 1,
        notes: '   ',
        exclusive: false,
      }),
    ).toEqual({
      id: 1,
      notes: null,
      exclusive: false,
    })
    expect(leadershipInternalUpdateSchema.parse({ id: 1 })).toEqual({ id: 1 })
  })

  it('declares contact as a unique field so each person has one leadership record', () => {
    expect(Leadership.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'contact', unique: true, required: true }),
        expect.objectContaining({ name: 'municipalities', hasMany: true, required: true }),
      ]),
    )
  })

  it('creates a Contact with the municipality city and rejects a second leadership for the same person', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const firstMunicipality = await campaignFixtures().getMunicipality()
    const secondMunicipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()

    const first = await createLeadershipRecord(payload, coordinator, {
      municipalities: [firstMunicipality.id],
      name: 'Maria de Jesus',
      phone: `+55 ${phone}`,
      email: '',
      gender: 'feminino',
      supportStatus: 'engajado',
    })

    expect(first.createdBy).toBe(coordinator.id)
    expect(first.contactReused).toBe(false)

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      pagination: false,
      depth: 0,
    })
    expect(contacts.totalDocs).toBe(1)
    expect(contacts.docs[0]?.name).toBe('Maria de Jesus')
    expect(contacts.docs[0]?.email).toBeNull()
    expect(contacts.docs[0]?.gender).toBe('feminino')
    expect(contacts.docs[0]?.city).toBe(firstMunicipality.city)

    await expect(
      createLeadershipRecord(payload, coordinator, {
        municipalities: [secondMunicipality.id],
        name: 'Nome que não sobrescreve contato existente',
        phone,
        supportStatus: 'a_abordar',
      }),
    ).rejects.toThrow(DUPLICATE_LEADERSHIP_MESSAGE)
  })

  it('reuses an existing Contact by normalized phone without overwriting it', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    const contact = await campaignFixtures().createContact({ name: 'Contato Existente', phone })

    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Nome que não sobrescreve contato existente',
      phone: `+55 ${phone}`,
      supportStatus: 'engajado',
    })

    expect(created.contactReused).toBe(true)
    expect(created.contact).toBe(contact.id)

    const persisted = await payload.findByID({ collection: 'contact', id: contact.id, depth: 0 })
    expect(persisted.name).toBe('Contato Existente')
  })

  it('serializes concurrent same-phone creates so only one leadership survives', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const firstMunicipality = await campaignFixtures().getMunicipality()
    const secondMunicipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    const originalFind = payload.find.bind(payload)
    let contactReads = 0
    let releaseFirstRead = () => {}
    const firstReadGate = new Promise<void>((resolve) => {
      releaseFirstRead = resolve
    })
    let markFirstRead = () => {}
    const firstReadReached = new Promise<void>((resolve) => {
      markFirstRead = resolve
    })
    const findSpy = vi.spyOn(payload, 'find').mockImplementation(async (args) => {
      const result = await originalFind(args)
      if (
        args.collection === 'contact' &&
        'where' in args &&
        JSON.stringify(args.where).includes(phone)
      ) {
        contactReads += 1
        if (contactReads === 1) {
          markFirstRead()
          await firstReadGate
        }
      }
      return result
    })

    const first = createLeadershipRecord(payload, coordinator, {
      municipalities: [firstMunicipality.id],
      name: 'Contato Concorrente',
      phone,
      supportStatus: 'engajado',
    })
    await firstReadReached

    const originalBeginTransaction = payload.db.beginTransaction.bind(payload.db)
    let resolveWaiterPID!: (pid: number) => void
    const waiterPID = new Promise<number>((resolve) => {
      resolveWaiterPID = resolve
    })
    const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
      const transactionID = await originalBeginTransaction()
      if (transactionID === null) {
        throw new Error('Expected the competing leadership transaction to start.')
      }
      resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
      return transactionID
    })
    const second = createLeadershipRecord(payload, coordinator, {
      municipalities: [secondMunicipality.id],
      name: 'Contato Concorrente Duplicado',
      phone: `+55 ${phone}`,
      supportStatus: 'a_abordar',
    })

    try {
      const expectedWaiterPID = await waiterPID
      const waiting = await waitForAdvisoryLockWaiter(payload, {
        key: `contact-phone:${phone}`,
        mode: 'ExclusiveLock',
        waiterPID: expectedWaiterPID,
      })
      expect(waiting).toMatchObject({
        activityDatabaseOID: waiting.databaseOID,
        classID: waiting.expectedClassID,
        granted: false,
        mode: 'ExclusiveLock',
        objectID: waiting.expectedObjectID,
        objectSubID: 1,
        pid: expectedWaiterPID,
      })
      expect(waiting.databaseOID).toBeGreaterThan(0)
      expect(contactReads).toBe(1)
    } finally {
      releaseFirstRead()
      beginSpy.mockRestore()
      findSpy.mockRestore()
    }
    const [firstResult, secondResult] = await Promise.allSettled([first, second])

    expect(firstResult.status).toBe('fulfilled')
    expect(secondResult.status).toBe('rejected')
    if (secondResult.status === 'rejected') {
      expect(String(secondResult.reason)).toContain(DUPLICATE_LEADERSHIP_MESSAGE)
    }

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      pagination: false,
      depth: 0,
    })
    expect(contacts.docs).toHaveLength(1)
    const leaderships = await payload.find({
      collection: 'leadership',
      where: { contact: { equals: contacts.docs[0]!.id } },
      pagination: false,
      depth: 0,
    })
    expect(leaderships.docs).toHaveLength(1)
  })

  it('allows a second Contact with the same phone and creates a fresh ficha on leadership create (C111)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()

    await payload.create({
      collection: 'contact',
      data: { name: 'Primeiro Contato', phone, state: 'BA', city: 'Salvador' },
    })

    // C111 — the phone is a contact channel, not a unique identity.
    await payload.create({
      collection: 'contact',
      data: { name: 'Segundo Contato', phone, state: 'BA', city: 'Salvador' },
    })

    // Two fichas already share the phone, so the leadership create cannot
    // match a person — the identity of the person being created is a fresh
    // ficha, never a guess among the existing ones.
    await expect(
      createLeadershipRecord(payload, coordinator, {
        municipalities: [municipality.id],
        name: 'Contato Reutilizado',
        phone,
        supportStatus: 'engajado',
      }),
    ).resolves.toMatchObject({ contactReused: false })
  })

  it('enforces the unique contact relationship at the database', async () => {
    const contact = await campaignFixtures().createContact({ name: 'Contato Único' })
    const firstMunicipality = await campaignFixtures().getMunicipality()
    const secondMunicipality = await campaignFixtures().getMunicipality()

    await campaignFixtures().createLeadership({
      contact: contact.id,
      municipalities: [firstMunicipality.id],
      supportStatus: 'engajado',
    })

    await expect(
      payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          municipalities: [secondMunicipality.id],
          supportStatus: 'a_abordar',
        },
      }),
    ).rejects.toThrow()
  })

  it('limits advisor management and listing to administered municipalities', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getMunicipality()
    const other = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(assigned, [advisor])
    await campaignFixtures().assignMunicipalityAdvisors(other, [otherAdvisor])

    const ownLeadership = await createLeadershipRecord(payload, advisor, {
      municipalities: [assigned.id],
      name: 'Liderança do município',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
      notes: 'Avaliação interna',
    })
    await createLeadershipRecord(payload, coordinator, {
      municipalities: [other.id],
      name: 'Liderança Alheia',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })

    const visible = await listMunicipalityLeaderships(payload, advisor, assigned.id)
    expect(visible.docs.map(({ id }) => id)).toContain(ownLeadership.id)

    const visibleContacts = await payload.find({
      collection: 'contact',
      user: advisor,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(visibleContacts.docs.map(({ id }) => id)).toContain(ownLeadership.contact)
    expect(visibleContacts.docs.map(({ name }) => name)).not.toContain('Liderança Alheia')

    const foreign = await listMunicipalityLeaderships(payload, advisor, other.id)
    expect(foreign.docs).toHaveLength(0)

    await expect(
      createLeadershipRecord(payload, advisor, {
        municipalities: [other.id],
        name: 'Cadastro Fora do Escopo',
        phone: campaignFixtures().phone(),
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow(OUT_OF_SCOPE_MUNICIPALITY_MESSAGE)
  })

  it('enforces scoped action success and denial for create and internal update', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getMunicipality()
    const other = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(assigned, [advisor])

    const own = await createLeadershipRecord(payload, advisor, {
      municipalities: [assigned.id],
      name: 'Ação Permitida',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })

    await expect(
      updateLeadershipInternalRecord(payload, advisor, {
        id: own.id,
        notes: 'Atualização permitida',
      }),
    ).resolves.toMatchObject({ notes: 'Atualização permitida' })

    await expect(
      updateLeadershipInternalRecord(payload, advisor, {
        id: own.id,
        municipalities: [assigned.id, other.id],
      }),
    ).rejects.toThrow(OUT_OF_SCOPE_MUNICIPALITY_MESSAGE)

    const otherLeadership = await createLeadershipRecord(payload, coordinator, {
      municipalities: [other.id],
      name: 'Outra Liderança',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    await expect(
      updateLeadershipInternalRecord(payload, advisor, {
        id: otherLeadership.id,
        notes: 'Atualização negada',
      }),
    ).rejects.toThrow()
  })

  it('denies leadership creation to leader accounts', async () => {
    const leader = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()

    await expect(
      createLeadershipRecord(payload, leader, {
        municipalities: [municipality.id],
        name: 'Criação por liderança',
        phone: campaignFixtures().phone(),
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow('Somente a coordenação e a assessoria podem gerenciar lideranças.')
  })

  it('denies direct advisor creation linked to an out-of-scope municipality', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherMunicipality = await campaignFixtures().getMunicipality()
    const contact = await campaignFixtures().createContact()

    await expect(
      payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          municipalities: [otherMunicipality.id],
          supportStatus: 'engajado',
        },
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('rolls back a newly created contact when leadership creation fails', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    const originalCreate = payload.create.bind(payload)
    const createSpy = vi.spyOn(payload, 'create').mockImplementation(async (args) => {
      if (args.collection === 'leadership') {
        throw new Error('falha forçada após contato')
      }
      return originalCreate(args)
    })

    await expect(
      createLeadershipRecord(payload, coordinator, {
        municipalities: [municipality.id],
        name: 'Contato que Deve Reverter',
        phone,
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow('falha forçada após contato')
    createSpy.mockRestore()

    const [contacts, leaderships] = await Promise.all([
      payload.find({
        collection: 'contact',
        where: { phone: { equals: phone } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'leadership',
        where: { municipalities: { in: [municipality.id] } },
        depth: 0,
        pagination: false,
      }),
    ])
    expect(contacts.totalDocs).toBe(0)
    expect(leaderships.totalDocs).toBe(0)
  })

  it('denies leaders read access to leadership records', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leaderAccount = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    const ownContact = await campaignFixtures().createContact({ name: 'Contato Próprio' })
    await campaignFixtures().createLeadership({
      contact: ownContact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
      notes: 'Não pode aparecer',
      createdBy: coordinator.id,
    })

    await expect(
      payload.find({
        collection: 'leadership',
        user: leaderAccount,
        overrideAccess: false,
        depth: 0,
        pagination: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('revokes leader contact access when the leadership is no longer engaged', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leaderAccount = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    const contact = await campaignFixtures().createContact({ name: 'Contato Revogado' })
    const link = await campaignFixtures().createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
      createdBy: coordinator.id,
    })

    const before = await payload.find({
      collection: 'contact',
      user: leaderAccount,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(before.docs.map(({ id }) => id)).toContain(contact.id)

    await updateLeadershipInternalRecord(payload, coordinator, {
      id: link.id,
      supportStatus: 'em_disputa',
    })

    const afterContacts = await payload.find({
      collection: 'contact',
      user: leaderAccount,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(afterContacts.docs.map(({ id }) => id)).not.toContain(contact.id)
  })

  it('denies leader accounts from updating internal fields', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leaderAccount = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    const contact = await campaignFixtures().createContact({
      name: 'Liderança sem Escrita Interna',
    })
    const link = await campaignFixtures().createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
      createdBy: coordinator.id,
    })

    await expect(
      payload.update({
        collection: 'leadership',
        id: link.id,
        data: {
          supportStatus: 'negativo',
          notes: 'Tentativa de alterar avaliação interna',
        },
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const unchanged = await payload.findByID({
      collection: 'leadership',
      id: link.id,
      depth: 0,
    })
    expect(unchanged.supportStatus).toBe('engajado')
    expect(unchanged.notes).toBeNull()
  })

  it('denies anonymous Contact listing and campaign hard deletes', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Registro Permanente',
      phone: campaignFixtures().phone(),
      supportStatus: 'a_abordar',
    })

    await expect(
      payload.find({
        collection: 'contact',
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'leadership',
        id: created.id,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({
        collection: 'contact',
        id: created.contact as number,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('guards migration rollback before any schema mutation when email is null', () => {
    const migration = readFileSync(
      new URL(
        '../../src/migrations/20260718_010733_consolidate_campaign_schema.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const down = migration.indexOf('export async function down')
    const guard = migration.indexOf(
      '"email" IS NULL OR "city" IS NULL OR "gender" IS NOT NULL',
      down,
    )
    const firstSchemaChange = migration.indexOf(
      'DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_invite_fk"',
      down,
    )

    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(firstSchemaChange)
    expect(migration).toContain('Refusing to roll back consolidated campaign schema')
  })

  it('updates leadership contact fields in place (B153)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const phone = fixtures.phone()
    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Nome Original',
      phone,
      email: 'original@example.com',
      supportStatus: 'engajado',
    })

    await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'name',
      name: 'Nome Corrigido',
    })
    await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'email',
      email: 'corrigido@example.com',
    })
    const newPhone = fixtures.phone()
    await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'phone',
      phone: newPhone,
    })

    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(created.contact)!,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.name).toBe('Nome Corrigido')
    expect(contact.email).toBe('corrigido@example.com')
    expect(contact.phone).toBe(newPhone)
  })

  it('shares a leadership contact phone with another person (C111)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const takenPhone = fixtures.phone()
    await fixtures.createContact({ phone: takenPhone })
    const leadership = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança Sem Conflito',
      phone: fixtures.phone(),
      supportStatus: 'engajado',
    })

    const updated = await updateLeadershipContactRecord(payload, coordinator, {
      id: leadership.id,
      field: 'phone',
      phone: takenPhone,
    })

    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(updated.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phone).toBe(takenPhone)

    const withPhone = await payload.find({
      collection: 'contact',
      where: { phone: { equals: takenPhone } },
      depth: 0,
      limit: 2,
      pagination: false,
      overrideAccess: true,
    })
    expect(withPhone.totalDocs).toBe(2)
  })

  it('denies leadership contact edits outside advisor municipality scope', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const home = await fixtures.getMunicipality()
    const away = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(home, [advisor])
    const leadership = await createLeadershipRecord(payload, coordinator, {
      municipalities: [away.id],
      name: 'Fora da Carteira',
      phone: fixtures.phone(),
      supportStatus: 'engajado',
    })

    await expect(
      updateLeadershipContactRecord(payload, advisor, {
        id: leadership.id,
        field: 'name',
        name: 'Tentativa',
      }),
    ).rejects.toThrow()
  })
})
