// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { CampaignUser } from '@/payload-types'

const authState = vi.hoisted(() => ({
  user: null as CampaignUser | null,
}))
const requestHeadersState = vi.hoisted(() => ({
  value: new Headers({ origin: 'http://localhost:3212' }),
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: async () => authState.user,
}))
vi.mock('next/headers', () => ({
  headers: async () => requestHeadersState.value,
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  createLeadershipRecord,
  updateLeadershipContactRecord,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  createSupporterRecord,
  updateSupporterContactRecord,
} from '@/app/(campaign)/campanha/actions/supporter'
import {
  CAMPAIGN_INVITE_CONSENT_KEY,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
} from '@/lib/campaignConsentKeys'
import {
  BRAZILIAN_PHONE_DUPLICATE_MESSAGE,
  BRAZILIAN_PHONE_INVALID_MESSAGE,
  primaryPhoneOf,
  reorderWithPrimaryPhone,
} from '@/lib/phone'
import config from '@/payload.config'
import { toSupporterDetailViewModel } from '@/utilities/supporter/supporterViewModels'
import {
  CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
  ensureLeasedConsent,
  SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('C112 — múltiplos telefones por pessoa', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('keeps order = priority through the pure helpers', () => {
    expect(primaryPhoneOf(null)).toBeNull()
    expect(primaryPhoneOf([])).toBeNull()
    expect(primaryPhoneOf([{ value: '71911110000' }, { value: '71922220000' }])).toBe('71911110000')

    expect(reorderWithPrimaryPhone([], '71911110000')).toEqual(['71911110000'])
    expect(
      reorderWithPrimaryPhone([{ value: '71911110000' }, { value: '71922220000' }], '71922220000'),
    ).toEqual(['71922220000', '71911110000'])
    expect(reorderWithPrimaryPhone([{ value: '71911110000' }], null)).toEqual([])
  })

  it('creates a ficha with N phones on leadership create and lists the primary', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const primary = campaignFixtures().phone()
    const secondary = campaignFixtures().phone()

    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança Multi Telefones',
      phones: [primary, secondary],
      supportStatus: 'engajado',
    })

    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(created.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([primary, secondary])

    const summary = await payload.find({
      collection: 'leadership',
      where: { id: { equals: created.id } },
      depth: 1,
      limit: 1,
      pagination: false,
      user: coordinator,
      overrideAccess: false,
    })
    const contactSummary = summary.docs[0]?.contact
    expect(
      typeof contactSummary === 'object' && contactSummary !== null
        ? primaryPhoneOf(contactSummary.phones)
        : null,
    ).toBe(primary)
  })

  it('rejects the same number twice in one ficha (dedupe within the person)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()

    await expect(
      createLeadershipRecord(payload, coordinator, {
        municipalities: [municipality.id],
        name: 'Liderança Repetida',
        phones: [phone, phone],
        supportStatus: 'engajado',
      }),
    ).rejects.toThrow(BRAZILIAN_PHONE_DUPLICATE_MESSAGE)

    await expect(
      payload.create({
        collection: 'contact',
        data: {
          name: 'Ficha Repetida',
          phones: [{ value: phone }, { value: phone }],
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        overrideAccess: true,
      }),
    ).rejects.toThrow(BRAZILIAN_PHONE_DUPLICATE_MESSAGE)

    // The invalid-number refusal is unchanged.
    await expect(
      payload.create({
        collection: 'contact',
        data: {
          name: 'Ficha Inválida',
          phones: [{ value: '1199999999' }],
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        overrideAccess: true,
      }),
    ).rejects.toThrow(BRAZILIAN_PHONE_INVALID_MESSAGE)
  })

  it('sets the primary phone preserving the rest through the inline edit', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const first = campaignFixtures().phone()
    const second = campaignFixtures().phone()

    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança Troca Principal',
      phones: [first, second],
      supportStatus: 'engajado',
    })

    const updated = await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'phone',
      phone: second,
    })
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(updated.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([second, first])

    // Clearing the primary removes it — the rest shifts up.
    await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'phone',
      phone: null,
    })
    const afterClear = await payload.findByID({
      collection: 'contact',
      id: relationId(created.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterClear.phones?.map((entry) => entry.value)).toEqual([first])
  })

  it('writes the full list through the phones branch (ficha editor)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança Editor',
      phones: [campaignFixtures().phone()],
      supportStatus: 'engajado',
    })
    const kept = campaignFixtures().phone()
    const added = campaignFixtures().phone()

    const updated = await updateLeadershipContactRecord(payload, coordinator, {
      id: created.id,
      field: 'phones',
      phones: [kept, added],
    })
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(updated.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([kept, added])
  })

  it('supporter detail shows every number and the list still shows the primary', async () => {
    const fixtures = campaignFixtures()
    await ensureLeasedConsent(payload, {
      consentKey: SUPPORTER_REGISTRATION_CONSENT_KEY,
      leaseKey: SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
    })
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const primary = fixtures.phone()
    const secondary = fixtures.phone()

    const created = await createSupporterRecord(payload, coordinator, {
      name: fixtures.value('Apoiador Multi Telefones'),
      phones: [primary, secondary],
      municipality: municipality.id,
      city: 'Salvador',
      consentAccepted: true,
    })
    const supporter = await payload.findByID({
      collection: 'supporter',
      id: created.id,
      depth: 1,
      overrideAccess: true,
    })
    const detail = toSupporterDetailViewModel(supporter)
    expect(detail.phones).toEqual([primary, secondary])
    expect(detail.phone).toBe(primary)

    // The supporter ficha editor (phones branch) replaces the whole list.
    const third = fixtures.phone()
    const updated = await updateSupporterContactRecord(payload, coordinator, {
      id: created.id,
      field: 'phones',
      phones: [third, primary],
    })
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(updated.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([third, primary])
  })
})

describe('C112 — busca e convite com números secundários', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('finds the supporter by a NON-primary number (payload and SQL search paths)', async () => {
    const fixtures = campaignFixtures()
    await ensureLeasedConsent(payload, {
      consentKey: SUPPORTER_REGISTRATION_CONSENT_KEY,
      leaseKey: SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
    })
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const primary = fixtures.phone()
    const secondary = fixtures.phone()

    const created = await createSupporterRecord(payload, coordinator, {
      name: fixtures.value('Apoiador Busca Secundária'),
      phones: [primary, secondary],
      municipality: municipality.id,
      city: 'Salvador',
      consentAccepted: true,
    })

    // Payload where path: the list search terms normalize to the full number.
    const { toPayloadWhere } = await import('@/utilities/supporter/supporterListFilters')
    const where = toPayloadWhere({ q: secondary })
    const hits = await payload.find({
      collection: 'supporter',
      where,
      depth: 1,
      limit: 10,
      pagination: false,
      overrideAccess: true,
    })
    expect(hits.docs.map((doc) => doc.id)).toContain(created.id)

    // SQL aggregate path: the raw-conditions builder must match a secondary too.
    const { toAggregateSqlConditions } =
      await import('@/utilities/supporter/supporterListSqlFilters')
    const sql = await import('@payloadcms/db-postgres')
    const { conditions, needsContactJoin } = toAggregateSqlConditions({
      q: secondary,
    })
    expect(needsContactJoin).toBe(true)
    expect(conditions.length).toBeGreaterThan(0)
    const conditionSql = sql.sql.join(conditions, sql.sql` AND `)
    const result = await payload.db.drizzle.execute(
      sql.sql`SELECT "supporter"."id" FROM "supporter"
        JOIN "contact" ON "contact"."id" = "supporter"."contact_id"
        WHERE ${conditionSql}`,
    )
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows: unknown }).rows as Array<{ id: number }>)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(created.id)
  })

  it('builds the invite WhatsApp link with the PRIMARY of a multi-phone ficha', async () => {
    const { buildCampaignInviteWhatsAppLink } = await import('@/utilities/campaignInvite')
    const primary = campaignFixtures().phone()
    const secondary = campaignFixtures().phone()
    const url = buildCampaignInviteWhatsAppLink({
      phone: primary,
      recipientName: 'Liderança',
      senderName: 'Coordenação',
      inviteUrl: 'https://jorgesolla1313.com.br/campanha/convite/abc',
      kind: 'autopreenchimento',
    })
    expect(url).toContain(`wa.me/55${primary}`)
    expect(url).not.toContain(`wa.me/55${secondary}`)

    // And the invitation creation gate uses the ficha's primary.
    await ensureLeasedConsent(payload, {
      consentKey: CAMPAIGN_INVITE_CONSENT_KEY,
      leaseKey: CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
    })
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: campaignFixtures().value('Liderança Convite Multi'),
      phones: [primary, secondary],
      supportStatus: 'engajado',
    })
    const { createCampaignInvite } = await import('@/app/(campaign)/campanha/actions/invite')
    authState.user = coordinator
    const invite = await createCampaignInvite({
      leadership: created.id,
      kind: 'autopreenchimento',
    })
    expect(invite.whatsappUrl).toContain(`wa.me/55${primary}`)
  })
})

describe('C112 — dobradinha e assessor com N telefones', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('writes the dobradinha ficha list through the phones branch', async () => {
    const { updateStateDeputyContactRecord } =
      await import('@/app/(campaign)/campanha/actions/stateDeputy')
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({
      name: `${fixtures.value('Dobradinha')} Multi`,
    })
    const first = fixtures.phone()
    const second = fixtures.phone()

    const updated = await updateStateDeputyContactRecord(payload, coordinator, {
      id: stateDeputy.id,
      field: 'phones',
      phones: [first, second],
    })
    const contact = await payload.findByID({
      collection: 'contact',
      id: relationId(updated.contact) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([first, second])
  })

  it('writes the advisor ficha list and rejects duplicates', async () => {
    const { updateAdvisorContactFicha } = await import('@/app/(campaign)/campanha/actions/advisor')
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    authState.user = coordinator
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessora Multi Telefones'),
    })
    const first = fixtures.phone()
    const second = fixtures.phone()

    const contactID = relationId(
      await payload
        .findByID({
          collection: 'campaignUser',
          id: advisor.id,
          depth: 0,
          select: { contact: true },
          overrideAccess: true,
        })
        .then((account) => account.contact),
    )
    expect(contactID).not.toBeNull()

    await updateAdvisorContactFicha({ contactId: contactID!, phones: [first, second] })
    const contact = await payload.findByID({
      collection: 'contact',
      id: contactID!,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phones?.map((entry) => entry.value)).toEqual([first, second])

    await expect(
      updateAdvisorContactFicha({ contactId: contactID!, phones: [first, first] }),
    ).rejects.toThrow(BRAZILIAN_PHONE_DUPLICATE_MESSAGE)
  })
})

describe('C112 — CSV import com telefone compartilhado como secundário', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('flags a CSV phone carried as SECONDARY by two fichas (preview = confirm fail-closed)', async () => {
    const fixtures = campaignFixtures()
    await ensureLeasedConsent(payload, {
      consentKey: SUPPORTER_REGISTRATION_CONSENT_KEY,
      leaseKey: SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
    })
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const sharedSecondary = fixtures.phone()
    // Two fichas whose PRIMARY differs but which both carry the CSV number.
    await fixtures.createContact({
      phones: [{ value: fixtures.phone() }, { value: sharedSecondary }],
    })
    await fixtures.createContact({
      phones: [{ value: fixtures.phone() }, { value: sharedSecondary }],
    })

    const { previewSupporterImportText } =
      await import('@/app/(campaign)/campanha/actions/supporterImport')
    const csv = `nome,telefone,municipio,intencao\nMaria Souza,${sharedSecondary},Salvador,certo`
    const preview = await previewSupporterImportText(payload, coordinator, csv)
    expect(preview.counts.ok).toBe(0)
    expect(preview.sampleRows.some((row) => row.status === 'telefone_compartilhado')).toBe(true)
  })
})
