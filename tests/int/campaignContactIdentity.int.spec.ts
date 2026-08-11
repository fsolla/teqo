// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const fichaOf = async (accountId: number) =>
  payload.findByID({
    collection: 'campaignUser',
    id: accountId,
    depth: 0,
    select: { contact: true },
    overrideAccess: true,
  })

describe('campaignUser → Contact identity (C99)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('creates a BA ficha when the account is created with a phone', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
      name: 'Maria Assessora',
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact).toMatchObject({
      name: 'Maria Assessora',
      phone: user.phone,
      state: 'BA',
    })
  })

  it('links an existing ficha with the same phone instead of duplicating', async () => {
    const fixtures = campaignFixtures()
    const existing = await fixtures.createContact({ name: 'Ficha Existente' })
    const user = await fixtures.createCampaignUser('advisor', { phone: existing.phone })

    const account = await fichaOf(user.id)
    expect(relationId(account.contact)).toBe(existing.id)
  })

  it('lets two accounts share one ficha (one person, two roles)', async () => {
    const fixtures = campaignFixtures()
    const phone = fixtures.phone()
    const first = await fixtures.createCampaignUser('leader', { phone })
    const second = await fixtures.createCampaignUser('advisor', { phone })

    const firstAccount = await fichaOf(first.id)
    const secondAccount = await fichaOf(second.id)
    expect(relationId(firstAccount.contact)).toBe(relationId(secondAccount.contact))
    expect(relationId(secondAccount.contact)).not.toBeNull()
  })

  it('creates a name-only ficha when the account has no phone', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('advisor', { name: 'Sem Telefone' })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact).toMatchObject({ name: 'Sem Telefone', phone: null, state: 'BA' })
  })

  it('never copies placeholder e-mails to the ficha', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
      email: `${fixtures.value('assessor')}@criado.invalid`,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.email).toBeNull()
  })

  it('copies a real e-mail to the ficha', async () => {
    const fixtures = campaignFixtures()
    const realEmail = `${fixtures.value('maria')}@exemplo.com`
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
      email: realEmail,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.email).toBe(realEmail)
  })

  it('respects an explicit contact on create', async () => {
    const fixtures = campaignFixtures()
    const explicit = await fixtures.createContact()
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
    })
    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { contact: null },
      depth: 0,
      overrideAccess: true,
    })

    const relinked = await payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Usuário explícito'),
        email: `${fixtures.value('explicito')}@example.com`,
        password: fixtures.value('password'),
        role: 'advisor',
        contact: explicit.id,
      },
      depth: 0,
      overrideAccess: true,
    })
    const account = await fichaOf(relinked.id)
    expect(relationId(account.contact)).toBe(explicit.id)
  })

  it('syncs name and phone to the linked ficha on update', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })

    const nextPhone = fixtures.phone()
    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { name: 'Nome Atualizado', phone: nextPhone },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact).toMatchObject({ name: 'Nome Atualizado', phone: nextPhone })
  })

  it('shares the phone with another ficha when the account phone is updated (C111)', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })
    const other = await fixtures.createContact()

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { phone: other.phone },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    // The account's own ficha now carries the other ficha's phone; both remain.
    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phone).toBe(other.phone)

    const othersWithPhone = await payload.find({
      collection: 'contact',
      where: { phone: { equals: other.phone } },
      depth: 0,
      limit: 2,
      pagination: false,
      overrideAccess: true,
    })
    expect(othersWithPhone.totalDocs).toBe(2)
  })

  it('links a previously unlinked account by phone on update', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const unlinked = await payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Usuário sem vínculo'),
        email: `${fixtures.value('semvinculo')}@example.com`,
        password: fixtures.value('password'),
        role: 'advisor',
        contact: null,
      },
      depth: 0,
      overrideAccess: true,
    })
    const phone = fixtures.phone()

    const updated = await payload.update({
      collection: 'campaignUser',
      id: unlinked.id,
      data: { phone },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })
    expect(relationId(updated.contact)).not.toBeNull()
  })

  it('creates a fresh ficha when the phone already belongs to two fichas (C111)', async () => {
    const fixtures = campaignFixtures()
    const phone = fixtures.phone()
    // Two people sharing one phone is a legitimate C111 state; it is planted
    // directly because the collection hook no longer enforces uniqueness.
    await payload.db.drizzle.execute(
      sql.raw(`
      INSERT INTO "contact" ("name", "email", "phone", "state", "city")
      VALUES ('${fixtures.value('Compartilhado A')}', '', '${phone}', 'BA', ''),
             ('${fixtures.value('Compartilhado B')}', '', '${phone}', 'BA', '')
    `),
    )

    const user = await fixtures.createCampaignUser('advisor', { phone })
    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    // The identity of the person being created is the fresh ficha — never a
    // guess among the existing ones.
    expect(contact.name).toBe(user.name)
    expect(contact.phone).toBe(phone)

    const allWithPhone = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(allWithPhone.totalDocs).toBe(3)
  })

  it('lets the admin unlink explicitly without auto-relinking', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })

    const unlinked = await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { contact: null },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })
    expect(relationId(unlinked.contact)).toBeUndefined()
  })

  it('never links or syncs on an unauthenticated update (password-reset guard)', async () => {
    const fixtures = campaignFixtures()
    const unlinked = await payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Usuário de resgate'),
        email: `${fixtures.value('resgate')}@example.com`,
        password: fixtures.value('password'),
        role: 'leader',
        contact: null,
      },
      depth: 0,
      overrideAccess: true,
    })
    const phone = fixtures.phone()

    // `payload.forgotPassword` updates the doc with `overrideAccess` and no
    // `req.user` — the identity hook must be inert on that write.
    const untouched = await payload.update({
      collection: 'campaignUser',
      id: unlinked.id,
      data: { phone },
      depth: 0,
      overrideAccess: true,
    })
    expect(relationId(untouched.contact)).toBeUndefined()

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    expect(contacts.totalDocs).toBe(0)
  })

  it('clearing the account phone never clears the ficha phone', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { phone: null },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phone).toBe(user.phone)
  })

  it('does not rewrite the ficha on a non-identity update (username)', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', { phone: fixtures.phone() })

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { username: fixtures.phone() },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact).toMatchObject({ name: user.name, phone: user.phone })
  })

  it('swaps a placeholder e-mail for the real one on the ficha in update', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
      email: `${fixtures.value('assessor')}@criado.invalid`,
    })
    const realEmail = `${fixtures.value('maria')}@exemplo.com`

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { email: realEmail },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    const account = await fichaOf(user.id)
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(account.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.email).toBe(realEmail)
  })

  it('unlink is transient: the next identity edit re-links the same ficha by phone', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const phone = fixtures.phone()
    const user = await fixtures.createCampaignUser('advisor', { phone })

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { contact: null },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })

    const edited = await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { name: 'Editado Depois' },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })
    // The phone dedupe re-anchors the account on the ficha it already owns.
    expect(relationId(edited.contact)).toBe(relationId(user.contact))
  })

  it('respects an explicit relink on update (no sync into the old ficha)', async () => {
    const fixtures = campaignFixtures()
    const actor = await fixtures.createCampaignUser('coordinator')
    const user = await fixtures.createCampaignUser('advisor', {
      phone: fixtures.phone(),
      name: 'Nome da Conta',
    })
    const target = await fixtures.createContact({ name: 'Ficha de Destino' })

    const relinked = await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { contact: target.id, name: 'Nome Atualizado' },
      depth: 0,
      user: actor,
      overrideAccess: true,
    })
    expect(relationId(relinked.contact)).toBe(target.id)

    // The old ficha was NOT the sync target of the account rename.
    const oldFicha = await payload.findByID({
      collection: 'contact',
      id: relationId(user.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(oldFicha.name).toBe('Nome da Conta')
  })
})
