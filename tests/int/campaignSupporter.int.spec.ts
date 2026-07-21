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
import { loadSupporterListOverviewData, loadSupportersPageData } from '@/utilities/supporterPageData'
import { buildSupporterListWhere } from '@/utilities/supporterUi'

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
    const coordinator = await fixtures.createCampaignUser('coordinator')

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
      createSupporterRecord(payload, coordinator, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        consentAccepted: true,
      }),
    ).rejects.toThrow(/Consentimento de cadastro de apoiador ainda não configurado/)
  })

  it('creates a supporter with contact upsert and blocks leadership coexistence', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const plaza = await fixtures.getPlaza()
    const phone = fixtures.phone()

    const created = await createSupporterRecord(payload, coordinator, {
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
      plazas: [plaza.id],
      createdBy: coordinator.id,
    })

    await expect(
      createSupporterRecord(payload, coordinator, {
        name: contact.name,
        phone: contact.phone,
        plaza: plaza.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/já é liderança nesta Praça/)
  })

  it('scopes advisor create to administered plazas and blocks plaza-less create', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const advisor = await fixtures.createCampaignUser('advisor')
    const plaza = await fixtures.getPlaza()
    const otherPlaza = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(plaza, [advisor])

    await expect(
      createSupporterRecord(payload, advisor, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        consentAccepted: true,
      }),
    ).rejects.toThrow(/sem Praça/)

    await expect(
      createSupporterRecord(payload, advisor, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        plaza: otherPlaza.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow()

    const created = await createSupporterRecord(payload, advisor, {
      name: fixtures.value('Apoiador'),
      phone: fixtures.phone(),
      plaza: plaza.id,
      consentAccepted: true,
    })
    fixtures.own('supporter', created.id)
    fixtures.own('contact', created.contact)
    expect(created.id).toBeGreaterThan(0)
  })

  it('requires highlighted vote-intention consent before setting intention', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const contact = await fixtures.createContact()
    const supporter = await fixtures.createSupporter({
      contact: contact.id,
      consent: registration.id,
      consentContentHash: 'hash',
      consentedAt: new Date().toISOString(),
      createdBy: coordinator.id,
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
      setSupporterVoteIntentionRecord(payload, coordinator, {
        id: supporter.id,
        voteIntention: 'certo',
        voteIntentionConsentAccepted: true,
      }),
    ).rejects.toThrow(/Consentimento de intenção de voto ainda não configurado/)

    await ensureConsentByKey(fixtures, SUPPORTER_VOTE_INTENTION_CONSENT_KEY)

    const updated = await setSupporterVoteIntentionRecord(payload, coordinator, {
      id: supporter.id,
      voteIntention: 'certo',
      voteIntentionConsentAccepted: true,
    })
    expect(updated.voteIntention).toBe('certo')
    expect(updated.voteIntentionConsentedAt).toBeTruthy()
  })

  it('previews and confirms CSV import for the coordinator only', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const phoneOk = fixtures.phone()
    const phoneDup = fixtures.phone()
    const existing = await fixtures.createContact({ phone: phoneDup })
    await fixtures.createSupporter({
      contact: existing.id,
      createdBy: coordinator.id,
    })

    const csv = [
      'nome,telefone,municipio,intencao',
      `Ana Silva,${phoneOk},Salvador,certo`,
      `Bruno Costa,${phoneDup},Salvador,indeciso`,
      'Carla,119999,Salvador,certo',
      'Diego Souza,71988887777,Cidade Inventada,certo',
    ].join('\n')

    await expect(previewSupporterImportText(payload, advisor, csv)).rejects.toThrow(
      /Coordenador Geral/,
    )

    const preview = await previewSupporterImportText(payload, coordinator, csv)
    expect(preview.counts.ok).toBe(1)
    expect(preview.counts.duplicate).toBe(1)
    expect(preview.counts.error).toBeGreaterThanOrEqual(2)
    expect(preview.importToken).toBeTruthy()
    expect(preview.sampleRows.length).toBeGreaterThan(0)

    const result = await confirmSupporterImportRecord(payload, coordinator, {
      operatorAttested: true,
      importToken: preview.importToken,
    })
    expect(result.created).toBe(1)

    // Single-use token: a second confirm with the same token must fail.
    await expect(
      confirmSupporterImportRecord(payload, coordinator, {
        operatorAttested: true,
        importToken: preview.importToken,
      }),
    ).rejects.toThrow(/não encontrado|expirado|inválido/)

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

  it('rejects a tampered import token and a token issued to another actor', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const otherCoordinator = await fixtures.createCampaignUser('coordinator')
    const phoneOk = fixtures.phone()
    const csv = `nome,telefone,municipio,intencao\nAna Silva,${phoneOk},Salvador,certo`

    const preview = await previewSupporterImportText(payload, coordinator, csv)
    expect(preview.counts.ok).toBe(1)

    const [batchId, expiresAt, sig] = preview.importToken.split('.')
    const tampered = `${batchId}.${expiresAt}.${sig.slice(0, -2)}xx`
    await expect(
      confirmSupporterImportRecord(payload, coordinator, {
        operatorAttested: true,
        importToken: tampered,
      }),
    ).rejects.toThrow(/inválido|expirado/)

    // Token bound to a different actor cannot be redeemed by another coordinator.
    await expect(
      confirmSupporterImportRecord(payload, otherCoordinator, {
        operatorAttested: true,
        importToken: preview.importToken,
      }),
    ).rejects.toThrow(/não encontrado|inválido|expirado/)

    // Cleanup: consume the still-valid token so it does not leak into other tests.
    await confirmSupporterImportRecord(payload, coordinator, {
      operatorAttested: true,
      importToken: preview.importToken,
    })
    const contact = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phoneOk } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    fixtures.own('contact', contact.docs[0]!.id)
    const created = await payload.find({
      collection: 'supporter',
      where: { contact: { equals: contact.docs[0]!.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    if (created.docs[0]) fixtures.own('supporter', created.docs[0].id)
  })

  it('removes supporter and anonymizes contact when no other joins remain', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const phone = fixtures.phone()
    const created = await createSupporterRecord(payload, coordinator, {
      name: fixtures.value('Apoiador'),
      phone,
      consentAccepted: true,
    })
    const contactID =
      typeof created.contact === 'number' ? created.contact : created.contact.id
    fixtures.own('supporter', created.id)
    fixtures.own('contact', contactID)

    const removed = await removeSupporterDataRecord(payload, coordinator, { id: created.id })
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

  it('aggregates supporter overview KPIs in a single SQL query for the coordinator', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const intentions: Array<{ voteIntention: 'certo' | 'tende_a_certo' | 'indeciso' | 'outro' | null }> = [
      { voteIntention: 'certo' },
      { voteIntention: 'certo' },
      { voteIntention: 'tende_a_certo' },
      { voteIntention: 'indeciso' },
      { voteIntention: 'indeciso' },
      { voteIntention: 'outro' },
      { voteIntention: null },
    ]
    const searchTag = fixtures.value('OverviewKpi')
    for (const { voteIntention } of intentions) {
      const contact = await fixtures.createContact({ name: searchTag })
      await fixtures.createSupporter({
        contact: contact.id,
        consent: registration.id,
        consentContentHash: 'hash',
        consentedAt: new Date().toISOString(),
        createdBy: coordinator.id,
        ...(voteIntention ? { voteIntention } : {}),
      })
    }

    const list = await payload.find({
      collection: 'supporter',
      where: buildSupporterListWhere({ page: 1, q: searchTag }),
      depth: 0,
      pagination: false,
      user: coordinator,
      overrideAccess: false,
    })

    const overview = await loadSupporterListOverviewData(
      payload,
      coordinator,
      { page: 1, q: searchTag },
      list.totalDocs,
    )
    expect(overview).not.toBeNull()
    expect(overview!.total).toBe(intentions.length)
    expect(overview!.certoAndTende).toBe(3)
    expect(overview!.indeciso).toBe(2)

    // `total` is the caller's contract: a 0 total skips the aggregate query
    // entirely and hides the panel, even if rows technically exist.
    expect(await loadSupporterListOverviewData(payload, coordinator, { page: 1 }, 0)).toBeNull()
  })

  it('scopes the overview aggregate to administered plazas for an advisor and applies filters', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const advisor = await fixtures.createCampaignUser('advisor')
    const assigned = await fixtures.getPlaza()
    const other = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(assigned, [advisor])

    const makeSupporter = async (
      plazaId: number | undefined,
      voteIntention: 'certo' | 'indeciso' | null,
      city = 'Salvador',
      name = fixtures.value('Apoiador'),
    ) => {
      const contact = await fixtures.createContact({ city, name })
      await fixtures.createSupporter({
        contact: contact.id,
        consent: registration.id,
        consentContentHash: 'hash',
        consentedAt: new Date().toISOString(),
        createdBy: advisor.id,
        ...(plazaId ? { plaza: plazaId } : {}),
        ...(voteIntention ? { voteIntention } : {}),
      })
    }

    await makeSupporter(assigned.id, 'certo')
    await makeSupporter(assigned.id, 'indeciso')
    await makeSupporter(assigned.id, null, 'Feira de Santana')
    await makeSupporter(other.id, 'certo') // outside scope — must not be counted

    const overview = await loadSupporterListOverviewData(payload, advisor, { page: 1 }, 3)
    expect(overview).not.toBeNull()
    expect(overview!.total).toBe(3)
    expect(overview!.certoAndTende).toBe(1)
    expect(overview!.indeciso).toBe(1)

    const filtered = await loadSupporterListOverviewData(
      payload,
      advisor,
      { page: 1, city: 'Feira de Santana' },
      1,
    )
    expect(filtered).not.toBeNull()
    expect(filtered!.total).toBe(1)
  })

  it('ignores single-character search queries in list and overview filters', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const uniqueName = fixtures.value('ApoiadorUnico')
    const contact = await fixtures.createContact({ name: uniqueName })
    await fixtures.createSupporter({
      contact: contact.id,
      consent: registration.id,
      consentContentHash: 'hash',
      consentedAt: new Date().toISOString(),
      createdBy: coordinator.id,
    })

    const shortQuery = uniqueName.slice(0, 1)
    const listWhere = buildSupporterListWhere({ page: 1, q: shortQuery })
    const list = await payload.find({
      collection: 'supporter',
      where: listWhere,
      depth: 0,
      pagination: false,
      user: coordinator,
      overrideAccess: false,
    })

    expect(list.totalDocs).toBeGreaterThanOrEqual(1)

    const overview = await loadSupporterListOverviewData(
      payload,
      coordinator,
      { page: 1, q: shortQuery },
      list.totalDocs,
    )
    expect(overview).not.toBeNull()
    expect(overview!.total).toBe(list.totalDocs)
  })

  it('keeps list and overview totals aligned for multi-character search', async () => {
    const fixtures = campaignFixtures()
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const uniqueName = fixtures.value('ApoiadorBusca')
    const contact = await fixtures.createContact({ name: uniqueName })
    await fixtures.createSupporter({
      contact: contact.id,
      consent: registration.id,
      consentContentHash: 'hash',
      consentedAt: new Date().toISOString(),
      createdBy: coordinator.id,
    })

    const q = uniqueName.slice(0, 8)
    const list = await payload.find({
      collection: 'supporter',
      where: buildSupporterListWhere({ page: 1, q }),
      depth: 0,
      pagination: false,
      user: coordinator,
      overrideAccess: false,
    })

    expect(list.totalDocs).toBeGreaterThanOrEqual(1)

    const overview = await loadSupporterListOverviewData(
      payload,
      coordinator,
      { page: 1, q },
      list.totalDocs,
    )
    expect(overview).not.toBeNull()
    expect(overview!.total).toBe(list.totalDocs)
    expect(overview!.certoAndTende + overview!.indeciso).toBeLessThanOrEqual(list.totalDocs)
  })

  it('loads supporters page data scoped to the administered plazas of an advisor', async () => {
    const fixtures = campaignFixtures()
    await ensureSupporterConsents(fixtures)
    const advisor = await fixtures.createCampaignUser('advisor')
    const assigned = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(assigned, [advisor])
    const registration = await ensureConsentByKey(fixtures, SUPPORTER_REGISTRATION_CONSENT_KEY)

    const contact = await fixtures.createContact()
    await fixtures.createSupporter({
      contact: contact.id,
      plaza: assigned.id,
      consent: registration.id,
      consentContentHash: 'hash',
      consentedAt: new Date().toISOString(),
      createdBy: advisor.id,
    })

    const pageData = await loadSupportersPageData(payload, advisor, {})
    expect(pageData.advisorPlazaIds).toContain(assigned.id)
    expect(pageData.plazaOptions.map((option) => option.id)).toEqual([assigned.id])
    expect(pageData.result.totalDocs).toBeGreaterThanOrEqual(1)
    expect(pageData.overview).not.toBeNull()
  })
})
