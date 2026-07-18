// @vitest-environment node

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  createLeadershipRecord,
  listNucleusLeaderships,
  updateLeadershipInternalRecord,
} from '@/app/(campaign)/campanha/actions/leadership'
import { updateElectoralNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import { Contact } from '@/collections/Contact'
import { Leadership } from '@/collections/Leadership'
import { contactSchema } from '@/lib/schemas/contact'
import { leadershipCreateSchema, leadershipInternalUpdateSchema } from '@/lib/schemas/leadership'
import config from '@/payload.config'
import {
  getNucleusLeadershipPageData,
  getSelectedNucleusLeadershipPageData,
} from '@/utilities/leadershipPageData'
import { resolveAccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
  withInviteConsent,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

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
      nucleus: 1,
      name: 'Maria da Silva',
      phone: '+55 (71) 99999-0000',
      supportStatus: 'engajado',
      createdBy: 999,
      user: 999,
      consent: 999,
    } as never)

    expect(parsed.phone).toBe('71999990000')
    expect(Object.hasOwn(parsed, 'createdBy')).toBe(false)
    expect(Object.hasOwn(parsed, 'user')).toBe(false)
    expect(Object.hasOwn(parsed, 'consent')).toBe(false)
    expect(() =>
      leadershipInternalUpdateSchema.parse({
        id: 1,
        contact: 999,
        nucleus: 999,
        createdBy: 999,
      } as never),
    ).not.toThrow()
    const update = leadershipInternalUpdateSchema.parse({
      id: 1,
      contact: 999,
      nucleus: 999,
      createdBy: 999,
    } as never)
    expect(update).toEqual({ id: 1 })
  })

  it('keeps direct leadership PATCH text states exact', () => {
    expect(
      leadershipInternalUpdateSchema.parse({
        id: 1,
        sectorNotes: '   ',
        notes: null,
        consentNote: '  Registro removível  ',
      }),
    ).toEqual({
      id: 1,
      sectorNotes: null,
      notes: null,
      consentNote: 'Registro removível',
    })
    expect(leadershipInternalUpdateSchema.parse({ id: 1 })).toEqual({ id: 1 })
  })

  it('declares the unique contact and nucleus compound index', () => {
    expect(Leadership.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fields: ['contact', 'nucleus'],
          unique: true,
        }),
      ]),
    )
  })

  it('creates a Contact once and reuses it by normalized phone', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const firstNucleus = await campaignFixtures().createNucleus()
    const secondNucleus = await campaignFixtures().createNucleus()
    const phone = campaignFixtures().phone()

    const first = await createLeadershipRecord(payload, general, {
      nucleus: firstNucleus.id,
      name: 'Maria de Jesus',
      phone: `+55 ${phone}`,
      email: '',
      gender: 'feminino',
      sector: 'comunitario',
      supportStatus: 'engajado',
    })
    const second = await createLeadershipRecord(payload, general, {
      nucleus: secondNucleus.id,
      name: 'Nome que não sobrescreve contato existente',
      phone,
      supportStatus: 'a_abordar',
    })

    expect(first.contact).toBe(second.contact)
    expect(first.createdBy).toBe(general.id)
    expect(second.createdBy).toBe(general.id)

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
  })

  it('serializes concurrent phone dedupe and links both nuclei to one Contact', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const firstNucleus = await campaignFixtures().createNucleus()
    const secondNucleus = await campaignFixtures().createNucleus()
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
      const result = await originalFind(args as never)
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
      return result as never
    })

    const first = createLeadershipRecord(payload, general, {
      nucleus: firstNucleus.id,
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
    const second = createLeadershipRecord(payload, general, {
      nucleus: secondNucleus.id,
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
    const fulfilled = await Promise.all([first, second])

    const [contacts, leaderships] = await Promise.all([
      payload.find({
        collection: 'contact',
        where: { phone: { equals: phone } },
        pagination: false,
        depth: 0,
      }),
      payload.find({
        collection: 'leadership',
        where: {
          nucleus: { in: [firstNucleus.id, secondNucleus.id] },
        },
        pagination: false,
        depth: 0,
      }),
    ])

    expect(contacts.docs).toHaveLength(1)
    expect(leaderships.docs).toHaveLength(2)
    expect(fulfilled).toHaveLength(2)
    expect(fulfilled.every(({ contact }) => contact === contacts.docs[0]?.id)).toBe(true)
    expect(fulfilled.map(({ contactReused }) => contactReused).sort()).toEqual([false, true])
  })

  it('rejects a duplicate Contact write before leadership dedupe can become ambiguous', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const phone = campaignFixtures().phone()

    await payload.create({
      collection: 'contact',
      data: { name: 'Primeiro Contato', phone, state: 'BA', city: 'Salvador' },
    })

    await expect(
      payload.create({
        collection: 'contact',
        data: { name: 'Segundo Contato', phone, state: 'BA', city: 'Salvador' },
      }),
    ).rejects.toThrow('Já existe outro contato com este celular')

    await expect(
      createLeadershipRecord(payload, general, {
        nucleus: nucleus.id,
        name: 'Contato Reutilizado',
        phone,
        supportStatus: 'engajado',
      }),
    ).resolves.toMatchObject({ contactReused: true })
  })

  it('enforces unique contact and nucleus relationships at the database', async () => {
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Contato Único',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const nucleus = await campaignFixtures().createNucleus()

    await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        supportStatus: 'engajado',
      },
    })

    await expect(
      payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          nucleus: nucleus.id,
          supportStatus: 'a_abordar',
        },
      }),
    ).rejects.toThrow()
  })

  it('limits coordinator management and listing to assigned nuclei', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    const other = await campaignFixtures().createNucleus({ coordinators: [otherCoordinator.id] })

    const ownLeadership = await createLeadershipRecord(payload, coordinator, {
      nucleus: assigned.id,
      name: 'Liderança do Núcleo',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
      notes: 'Avaliação interna',
    })
    await createLeadershipRecord(payload, general, {
      nucleus: other.id,
      name: 'Liderança Alheia',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })

    const visible = await listNucleusLeaderships(payload, coordinator, assigned.id)
    expect(visible.docs.map(({ id }) => id)).toContain(ownLeadership.id)

    const visibleContacts = await payload.find({
      collection: 'contact',
      user: coordinator,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(visibleContacts.docs.map(({ id }) => id)).toContain(ownLeadership.contact)
    expect(visibleContacts.docs.map(({ name }) => name)).not.toContain('Liderança Alheia')

    await expect(listNucleusLeaderships(payload, coordinator, other.id)).rejects.toThrow()
    await expect(
      createLeadershipRecord(payload, coordinator, {
        nucleus: other.id,
        name: 'Cadastro Fora do Escopo',
        phone: campaignFixtures().phone(),
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow()
  })

  it('enforces scoped action success and denial for create, update, and primary contact', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    const other = await campaignFixtures().createNucleus({ coordinators: [otherCoordinator.id] })

    const own = await createLeadershipRecord(payload, coordinator, {
      nucleus: assigned.id,
      name: 'Ação Permitida',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    await expect(
      createLeadershipRecord(payload, coordinator, {
        nucleus: other.id,
        name: 'Ação Negada',
        phone: campaignFixtures().phone(),
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow()

    await expect(
      updateLeadershipInternalRecord(payload, coordinator, {
        id: own.id,
        notes: 'Atualização permitida',
      }),
    ).resolves.toMatchObject({ notes: 'Atualização permitida' })

    const otherLeadership = await createLeadershipRecord(payload, general, {
      nucleus: other.id,
      name: 'Outra Liderança',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    await expect(
      updateLeadershipInternalRecord(payload, coordinator, {
        id: otherLeadership.id,
        notes: 'Atualização negada',
      }),
    ).rejects.toThrow()

    await expect(
      updateElectoralNucleus(payload, coordinator, {
        id: assigned.id,
        primaryContact: own.contact as number,
      }),
    ).resolves.toMatchObject({ primaryContact: own.contact })
    await expect(
      updateElectoralNucleus(payload, coordinator, {
        id: other.id,
        primaryContact: otherLeadership.contact as number,
      }),
    ).rejects.toThrow()
  })

  it('denies direct coordinator creation in an out-of-scope nucleus', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherNucleus = await campaignFixtures().createNucleus({
      coordinators: [otherCoordinator.id],
    })
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Contato Fora do Escopo',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })

    await expect(
      payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          nucleus: otherNucleus.id,
          supportStatus: 'engajado',
        },
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('rolls back a newly created contact when leadership creation fails', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const phone = campaignFixtures().phone()
    const originalCreate = payload.create.bind(payload)
    const createSpy = vi.spyOn(payload, 'create').mockImplementation(async (args) => {
      if (args.collection === 'leadership') {
        throw new Error('falha forçada após contato')
      }
      return originalCreate(args as never)
    })

    await expect(
      createLeadershipRecord(payload, general, {
        nucleus: nucleus.id,
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
        where: { nucleus: { equals: nucleus.id } },
        depth: 0,
        pagination: false,
      }),
    ])
    expect(contacts.totalDocs).toBe(0)
    expect(leaderships.totalDocs).toBe(0)
  })

  it('lets engaged leadership read only its own scoped records without internal fields', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const otherNucleus = await campaignFixtures().createNucleus()
    const ownContact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Contato Próprio',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const otherContact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Contato Alheio',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const own = await payload.create({
      collection: 'leadership',
      data: {
        contact: ownContact.id,
        nucleus: nucleus.id,
        user: leadershipUser.id,
        supportStatus: 'engajado',
        notes: 'Não pode aparecer',
        createdBy: general.id,
      },
    })
    await payload.create({
      collection: 'leadership',
      data: {
        contact: otherContact.id,
        nucleus: otherNucleus.id,
        supportStatus: 'engajado',
        notes: 'Alheia',
        createdBy: general.id,
      },
    })

    const visibleLinks = await payload.find({
      collection: 'leadership',
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(visibleLinks.docs).toHaveLength(1)
    expect(visibleLinks.docs[0]?.id).toBe(own.id)
    expect(Object.hasOwn(visibleLinks.docs[0]!, 'supportStatus')).toBe(false)
    expect(Object.hasOwn(visibleLinks.docs[0]!, 'notes')).toBe(false)
    expect(Object.hasOwn(visibleLinks.docs[0]!, 'consentNote')).toBe(false)
    expect(Object.hasOwn(visibleLinks.docs[0]!, 'createdBy')).toBe(false)

    const visibleContacts = await payload.find({
      collection: 'contact',
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(visibleContacts.docs.map(({ id }) => id)).toEqual([ownContact.id])
  })

  it('keeps internal evaluation out of the liderança page payload', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Ficha Segura',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        user: leadershipUser.id,
        supportStatus: 'engajado',
        notes: 'Avaliação interna que não pode sair do servidor',
        consentNote: 'Registro interno que não pode sair do servidor',
        createdBy: general.id,
      },
    })

    const context = await resolveAccessibleNucleusContext(payload, leadershipUser, nucleus.slug)
    const pageData = await withInviteConsent(payload, () =>
      getNucleusLeadershipPageData(payload, leadershipUser, context),
    )
    const serialized = JSON.stringify(pageData)

    expect(serialized).toContain('Ficha Segura')
    expect(serialized).not.toContain('supportStatus')
    expect(serialized).not.toContain('Avaliação interna')
    expect(serialized).not.toContain('Registro interno')
  })

  it('resolves only one selected staff DTO inside the accessible nucleus context', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const foreignNucleus = await campaignFixtures().createNucleus()
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Seleção Escopada',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const selected = await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        supportStatus: 'engajado',
        notes: 'Avaliação selecionada',
        createdBy: general.id,
      },
    })
    const context = await resolveAccessibleNucleusContext(payload, general, nucleus.slug)
    const foreignContext = await resolveAccessibleNucleusContext(
      payload,
      general,
      foreignNucleus.slug,
    )

    const result = await withInviteConsent(payload, () =>
      getSelectedNucleusLeadershipPageData(payload, general, context, selected.id),
    )
    const serialized = JSON.stringify(result)

    expect(result).toMatchObject({
      id: selected.id,
      contactId: contact.id,
      name: 'Seleção Escopada',
      supportStatus: 'engajado',
      notes: 'Avaliação selecionada',
    })
    expect(serialized.match(/Seleção Escopada/g)).toHaveLength(1)
    await expect(
      getSelectedNucleusLeadershipPageData(payload, general, foreignContext, selected.id),
    ).resolves.toBeNull()
    await expect(
      getSelectedNucleusLeadershipPageData(payload, leadershipUser, context, selected.id),
    ).resolves.toBeNull()
  })

  it('revokes leadership nucleus and contact access immediately when no longer engaged', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Contato Revogado',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const link = await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        user: leadershipUser.id,
        supportStatus: 'engajado',
        createdBy: general.id,
      },
    })

    const before = await payload.find({
      collection: 'electoralNucleus',
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(before.docs.map(({ id }) => id)).toContain(nucleus.id)

    await updateLeadershipInternalRecord(payload, general, {
      id: link.id,
      supportStatus: 'em_disputa',
    })

    const afterNuclei = await payload.find({
      collection: 'electoralNucleus',
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
    })
    const afterContacts = await payload.find({
      collection: 'contact',
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(afterNuclei.docs.map(({ id }) => id)).not.toContain(nucleus.id)
    expect(afterContacts.docs.map(({ id }) => id)).not.toContain(contact.id)
  })

  it('denies leadership users from updating internal fields', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: 'Liderança sem Escrita Interna',
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      },
    })
    const link = await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        nucleus: nucleus.id,
        user: leadershipUser.id,
        supportStatus: 'engajado',
        createdBy: general.id,
      },
    })

    await expect(
      payload.update({
        collection: 'leadership',
        id: link.id,
        data: {
          supportStatus: 'negativo',
          notes: 'Tentativa de alterar avaliação interna',
        },
        user: leadershipUser,
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

  it('blocks a non-engaged status while the leadership is the primary contact', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Contato Principal',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { primaryContact: created.contact as number },
    })

    await expect(
      updateLeadershipInternalRecord(payload, general, {
        id: created.id,
        supportStatus: 'negativo',
      }),
    ).rejects.toThrow('contato principal')
  })

  it('blocks choosing a non-engaged leadership as primary contact', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Contato Ainda Não Engajado',
      phone: campaignFixtures().phone(),
      supportStatus: 'a_abordar',
    })

    await expect(
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: { primaryContact: created.contact as number },
      }),
    ).rejects.toThrow('engajada')
  })

  it('serializes concurrent primary selection and leadership disengagement', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Contato Principal Concorrente',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })

    await Promise.allSettled([
      payload.update({
        collection: 'electoralNucleus',
        id: nucleus.id,
        data: { primaryContact: created.contact as number },
      }),
      payload.update({
        collection: 'leadership',
        id: created.id,
        data: { supportStatus: 'negativo' },
      }),
    ])

    const [persistedNucleus, persistedLeadership] = await Promise.all([
      payload.findByID({ collection: 'electoralNucleus', id: nucleus.id, depth: 0 }),
      payload.findByID({ collection: 'leadership', id: created.id, depth: 0 }),
    ])
    expect(
      persistedNucleus.primaryContact === created.contact &&
        persistedLeadership.supportStatus !== 'engajado',
    ).toBe(false)
  })

  it('waits on the exact primary-contact namespace before validating the relationship', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Contato Principal Bloqueado',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    const holderID = await payload.db.beginTransaction()
    if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
    await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [
      `primary-contact:${nucleus.id}`,
    ])

    const originalBegin = payload.db.beginTransaction.bind(payload.db)
    let resolveWaiterPID!: (pid: number) => void
    const waiterPID = new Promise<number>((resolve) => {
      resolveWaiterPID = resolve
    })
    const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
      const transactionID = await originalBegin()
      if (transactionID === null) throw new Error('Expected primary-contact transaction.')
      resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
      return transactionID
    })
    const pending = payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { primaryContact: created.contact as number },
      depth: 0,
    })

    try {
      const expectedPID = await waiterPID
      await expect(
        waitForAdvisoryLockWaiter(payload, {
          key: `primary-contact:${nucleus.id}`,
          mode: 'ExclusiveLock',
          waiterPID: expectedPID,
        }),
      ).resolves.toMatchObject({ granted: false, pid: expectedPID })
      await payload.db.rollbackTransaction(holderID)
      await expect(pending).resolves.toMatchObject({ primaryContact: created.contact })
    } catch (error) {
      await payload.db.rollbackTransaction(holderID).catch(() => undefined)
      throw error
    } finally {
      beginSpy.mockRestore()
    }
  })

  it('denies anonymous Contact listing and campaign hard deletes', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
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
        user: general,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({
        collection: 'contact',
        id: created.contact as number,
        user: general,
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
})
