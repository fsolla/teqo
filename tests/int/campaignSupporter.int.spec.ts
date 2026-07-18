// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  confirmSupporterImportRecord,
  createSupporterRecord,
  previewSupporterImportText,
  removeSupporterDataRecord,
  setSupporterVoteIntentionRecord,
} from '@/app/(campaign)/campanha/actions/supporter'
import { supporterCreateSchema } from '@/lib/schemas/supporter'
import config from '@/payload.config'
import {
  SUPPORTER_REGISTRATION_CONSENT_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
} from '@/utilities/campaignConsent'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const ensureConsentByKey = async (
  fixtures: ReturnType<typeof campaignFixtures>,
  key: string,
) => {
  const existing = await payload.find({
    collection: 'consent',
    where: { key: { equals: key } },
    depth: 0,
    limit: 1,
    pagination: false,
  })
  if (existing.docs[0]) {
    fixtures.own('consent', existing.docs[0].id)
    return existing.docs[0]
  }
  return fixtures.createConsent({ key })
}

const ensureSupporterConsents = async (fixtures: ReturnType<typeof campaignFixtures>) => {
  const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
  const voteIntention = await ensureConsentByKey(fixtures, SUPPORTER_VOTE_INTENTION_CONSENT_KEY)
  return { registration, voteIntention }
}

describe('campaign supporter domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires phone and registration consent on create schema', () => {
    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phone: '71999990000',
        consentAccepted: true,
      }).success,
    ).toBe(true)

    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phone: '71999990000',
      }).success,
    ).toBe(false)

    expect(
      supporterCreateSchema.safeParse({
        name: 'Maria Silva',
        phone: 'invalid',
        consentAccepted: true,
      }).success,
    ).toBe(false)
  })

  it('fails closed when supporter registration consent is missing', async () => {
    const fixtures = campaignFixtures()
    const geral = await fixtures.createCampaignUser('geral')

    const existing = await payload.find({
      collection: 'consent',
      where: { key: { equals: SUPPORTER_REGISTRATION_CONSENT_KEY } },
      depth: 0,
      limit: 1,
    })
    if (existing.docs[0]) {
      await payload.delete({ collection: 'consent', id: existing.docs[0].id })
    }

    await expect(
      createSupporterRecord(payload, geral, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        consentAccepted: true,
      }),
    ).rejects.toThrow(/Consentimento de cadastro de apoiador ainda não configurado/)
  })

  it('creates a supporter with contact upsert and blocks leadership coexistence', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const geral = await fixtures.createCampaignUser('geral')
    const nucleus = await fixtures.createNucleus()
    const phone = fixtures.phone()

    const created = await createSupporterRecord(payload, geral, {
      name: fixtures.value('Apoiador'),
      phone,
      city: 'Salvador',
      consentAccepted: true,
    })
    fixtures.own('supporter', created.id)
    fixtures.own('contact', created.contact)

    expect(created.contactReused).toBe(false)
    expect(created.source).toBe('manual')

    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      nucleus: nucleus.id,
      createdBy: geral.id,
    })

    await expect(
      createSupporterRecord(payload, geral, {
        name: contact.name,
        phone: contact.phone,
        nucleus: nucleus.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/já é liderança neste núcleo/)
  })

  it('scopes coordinator create to accessible nuclei and blocks nucleus-less create', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const coordenador = await fixtures.createCampaignUser('coordenador')
    const nucleus = await fixtures.createNucleus({
      coordinators: [coordenador.id],
    })
    const otherNucleus = await fixtures.createNucleus()

    await expect(
      createSupporterRecord(payload, coordenador, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        consentAccepted: true,
      }),
    ).rejects.toThrow(/sem núcleo/)

    await expect(
      createSupporterRecord(payload, coordenador, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        nucleus: otherNucleus.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow()

    const created = await createSupporterRecord(payload, coordenador, {
      name: fixtures.value('Apoiador'),
      phone: fixtures.phone(),
      nucleus: nucleus.id,
      consentAccepted: true,
    })
    fixtures.own('supporter', created.id)
    fixtures.own('contact', created.contact)
    expect(created.id).toBeGreaterThan(0)
  })

  it('requires highlighted vote-intention consent before setting intention', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const geral = await fixtures.createCampaignUser('geral')
    const contact = await fixtures.createContact()
    const supporter = await fixtures.createSupporter({
      contact: contact.id,
      consent: registration.id,
      consentContentHash: 'hash',
      consentedAt: new Date().toISOString(),
      createdBy: geral.id,
    })

    const existingVoteConsent = await payload.find({
      collection: 'consent',
      where: { key: { equals: SUPPORTER_VOTE_INTENTION_CONSENT_KEY } },
      depth: 0,
      limit: 1,
    })
    if (existingVoteConsent.docs[0]) {
      await payload.delete({
        collection: 'consent',
        id: existingVoteConsent.docs[0].id,
      })
    }

    await expect(
      setSupporterVoteIntentionRecord(payload, geral, {
        id: supporter.id,
        voteIntention: 'certo',
        voteIntentionConsentAccepted: true,
      }),
    ).rejects.toThrow(/Consentimento de intenção de voto ainda não configurado/)

    await ensureConsentByKey(fixtures, SUPPORTER_VOTE_INTENTION_CONSENT_KEY)

    const updated = await setSupporterVoteIntentionRecord(payload, geral, {
      id: supporter.id,
      voteIntention: 'certo',
      voteIntentionConsentAccepted: true,
    })
    expect(updated.voteIntention).toBe('certo')
    expect(updated.voteIntentionConsentedAt).toBeTruthy()
  })

  it('previews and confirms CSV import for geral only', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const geral = await fixtures.createCampaignUser('geral')
    const coordenador = await fixtures.createCampaignUser('coordenador')
    const phoneOk = fixtures.phone()
    const phoneDup = fixtures.phone()
    const existing = await fixtures.createContact({ phone: phoneDup })
    await fixtures.createSupporter({
      contact: existing.id,
      createdBy: geral.id,
    })

    const csv = [
      'nome,telefone,municipio,intencao',
      `Ana Silva,${phoneOk},Salvador,certo`,
      `Bruno Costa,${phoneDup},Salvador,indeciso`,
      'Carla,119999,Salvador,certo',
      'Diego Souza,71988887777,Cidade Inventada,certo',
    ].join('\n')

    await expect(previewSupporterImportText(payload, coordenador, csv)).rejects.toThrow(
      /coordenação geral/,
    )

    const preview = await previewSupporterImportText(payload, geral, csv)
    expect(preview.counts.ok).toBe(1)
    expect(preview.counts.duplicate).toBe(1)
    expect(preview.counts.error).toBeGreaterThanOrEqual(2)

    const okRows = preview.rows
      .filter((row) => row.status === 'ok')
      .map((row) => ({
        nome: row.nome,
        telefone: row.normalizedPhone!,
        municipio: row.canonicalCity,
        intencao: row.voteIntention,
      }))

    const result = await confirmSupporterImportRecord(payload, geral, {
      operatorAttested: true,
      rows: okRows,
    })
    expect(result.created).toBe(1)

    const contact = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phoneOk } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(contact.totalDocs).toBe(1)
    fixtures.own('contact', contact.docs[0]!.id)

    const created = await payload.find({
      collection: 'supporter',
      where: { contact: { equals: contact.docs[0]!.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(created.totalDocs).toBe(1)
    fixtures.own('supporter', created.docs[0]!.id)
  })

  it('removes supporter and anonymizes contact when no other joins remain', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const geral = await fixtures.createCampaignUser('geral')
    const phone = fixtures.phone()
    const created = await createSupporterRecord(payload, geral, {
      name: fixtures.value('Apoiador'),
      phone,
      consentAccepted: true,
    })
    const contactID =
      typeof created.contact === 'number' ? created.contact : created.contact.id
    fixtures.own('supporter', created.id)
    fixtures.own('contact', contactID)

    const removed = await removeSupporterDataRecord(payload, geral, { id: created.id })
    expect(removed.removed).toBe(true)
    expect(removed.contactAnonymized).toBe(true)

    const contact = await payload.findByID({
      collection: 'contact',
      id: contactID,
      depth: 0,
    })
    expect(contact.name).toBe('Titular removido')
    expect(contact.phone).not.toBe(phone)
  })
})
