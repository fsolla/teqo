// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import type { Consent } from '@/payload-types'
import { createCampaignFixtures, withCampaignFixtures } from '../helpers/campaignFixtures'
import { withInviteConsent, withMutableConsentFixture } from '../helpers/testDatabaseLease'

let payload: Payload

const fixtureConsentText: Consent['text'] = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Consentimento da fixture', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}

const exists = async (
  collection:
    | 'users'
    | 'campaignUser'
    | 'contact'
    | 'consent'
    | 'leadership'
    | 'votePledge'
    | 'campaignDemand'
    | 'organization'
    | 'municipalityUpdate',
  id: number,
): Promise<boolean> => {
  const result = await payload.find({
    collection,
    where: { id: { equals: id } },
    depth: 0,
    limit: 1,
  })
  return result.docs.length === 1
}

describe('campaign integration fixtures', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('cleans a partial setup when creation fails', async () => {
    let createdID = 0

    await expect(
      withCampaignFixtures(payload, async (fixtures) => {
        createdID = (await fixtures.createCampaignUser('coordinator')).id
        await fixtures.createLeadership({
          contact: 999_999_999,
          municipalities: [999_999_999],
        })
      }),
    ).rejects.toThrow()

    expect(await exists('campaignUser', createdID)).toBe(false)
  })

  it('cleans owned records when the callback fails', async () => {
    let createdID = 0

    await expect(
      withCampaignFixtures(payload, async (fixtures) => {
        createdID = (await fixtures.createContact()).id
        throw new Error('callback failure')
      }),
    ).rejects.toThrow('callback failure')

    expect(await exists('contact', createdID)).toBe(false)
  })

  it('cleans owned admin users and consent rows when the callback fails', async () => {
    let adminID = 0
    let consentID = 0

    await expect(
      withCampaignFixtures(payload, async (fixtures) => {
        adminID = (await fixtures.createAdminUser()).id
        consentID = (await fixtures.createConsent()).id
        throw new Error('callback failure')
      }),
    ).rejects.toThrow('callback failure')

    expect(await exists('users', adminID)).toBe(false)
    expect(await exists('consent', consentID)).toBe(false)
  })

  it('cleans the full municipality-scoped graph and resets touched municipality fields', async () => {
    let leadershipID = 0
    let pledgeID = 0
    let demandID = 0
    let organizationID = 0
    let updateID = 0
    let municipalityID = 0

    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const advisor = await fixtures.createCampaignUser('advisor')
      const contact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()
      municipalityID = municipality.id

      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      await payload.update({
        collection: 'municipality',
        id: municipality.id,
        data: {
          priority: 'alta',
          voteGoals: { good: 100, regular: 50, minimum: 10 },
          strengths: [{ text: fixtures.value('Força') }],
          risks: [{ text: fixtures.value('Risco') }],
          nextSteps: fixtures.value('Encaminhamento'),
        },
        depth: 0,
      })

      const organization = await fixtures.createOrganization({ municipalities: [municipality.id] })
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality.id],
        organizations: [organization.id],
        createdBy: coordinator,
      })
      const pledge = await fixtures.createVotePledge({
        leadership,
        municipality,
        declaredVotes: 120,
      })
      const demand = await fixtures.createCampaignDemand({
        municipality,
        leadership,
        createdBy: coordinator,
      })
      const update = await fixtures.createMunicipalityUpdate({ municipality, author: coordinator })

      leadershipID = leadership.id
      pledgeID = pledge.id
      demandID = demand.id
      organizationID = organization.id
      updateID = update.id
    })

    expect(await exists('leadership', leadershipID)).toBe(false)
    expect(await exists('votePledge', pledgeID)).toBe(false)
    expect(await exists('campaignDemand', demandID)).toBe(false)
    expect(await exists('organization', organizationID)).toBe(false)
    expect(await exists('municipalityUpdate', updateID)).toBe(false)

    const municipality = await payload.findByID({ collection: 'municipality', id: municipalityID, depth: 0 })
    expect(municipality.advisors ?? []).toEqual([])
    expect(municipality.priority).toBe('normal')
    expect(municipality.voteGoals).toMatchObject({ good: null, regular: null, minimum: null })
    expect(municipality.strengths ?? []).toEqual([])
    expect(municipality.risks ?? []).toEqual([])
    expect(municipality.nextSteps ?? null).toBeNull()
    expect(municipality.lastUpdateAt ?? null).toBeNull()
  })

  it('tracks admin users and ordinary consents created through the fixture payload', async () => {
    let adminID = 0
    let consentID = 0

    await withCampaignFixtures(payload, async (fixtures) => {
      const admin = await fixtures.payload.create({
        collection: 'users',
        data: {
          email: `${fixtures.value('proxy-admin')}@example.com`,
          password: fixtures.value('password'),
        },
        depth: 0,
      })
      const consent = await fixtures.payload.create({
        collection: 'consent',
        data: {
          key: fixtures.value('proxy-consent'),
          text: fixtureConsentText,
        },
        depth: 0,
      })
      adminID = admin.id
      consentID = consent.id
    })

    expect(await exists('users', adminID)).toBe(false)
    expect(await exists('consent', consentID)).toBe(false)
  })

  it('discovers marked rows created outside the fixture payload', async () => {
    const fixtures = createCampaignFixtures(payload)
    const contact = await payload.create({
      collection: 'contact',
      data: {
        name: fixtures.value('Contato criado pelo servidor E2E'),
        phone: fixtures.phone(),
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })

    await fixtures.cleanup()

    expect(await exists('contact', contact.id)).toBe(false)
    await expect(fixtures.expectNoOwnedRows()).resolves.toBeUndefined()
  })

  it('preserves the stable invite consent unless it is explicitly test-owned', async () => {
    await withInviteConsent(payload, async (stableConsent) => {
      await withCampaignFixtures(payload, async (fixtures) => {
        const reused = await fixtures.payload.findByID({
          collection: 'consent',
          id: stableConsent.id,
          depth: 0,
        })
        expect(reused.id).toBe(stableConsent.id)
      })
      expect(await exists('consent', stableConsent.id)).toBe(true)
    })
  })

  it('deletes the stable invite consent when createConsent explicitly owns it', async () => {
    let consentID = 0

    await withMutableConsentFixture(payload, async (configuredConsent) => {
      await payload.update({
        collection: 'consent',
        id: configuredConsent.id,
        data: { key: `temporarily-unkeyed-${configuredConsent.id}` },
        depth: 0,
      })
      await withCampaignFixtures(payload, async (fixtures) => {
        consentID = (
          await fixtures.createConsent({
            key: 'lideranca-autopreenchimento',
          })
        ).id
      })

      expect(await exists('consent', consentID)).toBe(false)
      await payload.update({
        collection: 'consent',
        id: configuredConsent.id,
        data: { key: 'lideranca-autopreenchimento' },
        depth: 0,
      })
    })
  })

  // Fixed sentinel phones can survive an aborted previous run — reuse them.
  const findOrCreateSentinelContact = async (name: string, phone: string) => {
    const existing = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      depth: 0,
      limit: 1,
    })
    if (existing.docs[0]) return existing.docs[0]
    return payload.create({
      collection: 'contact',
      data: { name, phone, state: 'BA', city: 'Salvador' },
      depth: 0,
    })
  }

  it('preserves unrelated sentinel rows', async () => {
    const sentinel = await findOrCreateSentinelContact('Sentinela não pertencente', '71900000001')

    try {
      await withCampaignFixtures(payload, async (fixtures) => {
        await fixtures.createContact()
      })
      expect(await exists('contact', sentinel.id)).toBe(true)
    } finally {
      await payload.delete({ collection: 'contact', id: sentinel.id, depth: 0 })
    }
  })

  it('preserves a pre-existing contact reused by an owned leadership', async () => {
    const sentinel = await findOrCreateSentinelContact(
      'Contato existente reutilizado',
      '71900000002',
    )
    // Leftover leadership from an aborted run would violate the unique contact.
    await payload.delete({
      collection: 'leadership',
      where: { contact: { equals: sentinel.id } },
      depth: 0,
    })

    try {
      await withCampaignFixtures(payload, async (fixtures) => {
        const coordinator = await fixtures.createCampaignUser('coordinator')
        const municipality = await fixtures.getMunicipality()
        await fixtures.createLeadership({
          contact: sentinel,
          municipalities: [municipality.id],
          createdBy: coordinator,
        })
      })
      expect(await exists('contact', sentinel.id)).toBe(true)
    } finally {
      await payload.delete({ collection: 'contact', id: sentinel.id, depth: 0 })
    }
  })

  it('preserves unrelated admin-user and consent sentinels', async () => {
    const marker = `${process.pid}-${Date.now()}`
    const admin = await payload.create({
      collection: 'users',
      data: {
        email: `sentinel-${marker}@example.com`,
        password: `password-${marker}`,
      },
      depth: 0,
    })
    const consent = await payload.create({
      collection: 'consent',
      data: {
        key: `sentinel-${marker}`,
        text: fixtureConsentText,
      },
      depth: 0,
    })

    try {
      await withCampaignFixtures(payload, async (fixtures) => {
        await fixtures.createAdminUser()
        await fixtures.createConsent()
      })
      expect(await exists('users', admin.id)).toBe(true)
      expect(await exists('consent', consent.id)).toBe(true)
    } finally {
      await payload.delete({ collection: 'users', id: admin.id, depth: 0 })
      await payload.delete({ collection: 'consent', id: consent.id, depth: 0 })
    }
  })

  it('hands out distinct seeded municipalities to isolated parallel builders', async () => {
    const first = createCampaignFixtures(payload)
    const second = createCampaignFixtures(payload)
    const [firstMunicipality, secondMunicipality, firstContact, secondContact] = await Promise.all([
      first.getMunicipality(),
      second.getMunicipality(),
      first.createContact(),
      second.createContact(),
    ])

    expect(first.runID).not.toBe(second.runID)
    expect(firstMunicipality.id).not.toBe(secondMunicipality.id)
    await first.cleanup()
    expect(await exists('contact', firstContact.id)).toBe(false)
    expect(await exists('contact', secondContact.id)).toBe(true)
    await second.cleanup()
    expect(await exists('contact', secondContact.id)).toBe(false)
  })

  it('makes cleanup idempotent and leaves zero owned rows', async () => {
    const fixtures = createCampaignFixtures(payload)
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [coordinator])
    await fixtures.cleanup()
    await fixtures.cleanup()

    await expect(fixtures.expectNoOwnedRows()).resolves.toBeUndefined()
    const persistedMunicipality = await payload.findByID({ collection: 'municipality', id: municipality.id, depth: 0 })
    expect(persistedMunicipality.advisors ?? []).toEqual([])
  })
})
