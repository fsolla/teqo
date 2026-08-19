// @vitest-environment node

/**
 * S9 — the public campaign "novidades" capture resolves its Consent by the
 * stable key `campanha-novidades` and FAILS CLOSED while the keyed document is
 * missing; the engagement-level toggle choice survives as
 * `subscription.campaignLevel` and a contact may be recorded without a state.
 */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { submitCampaignNewsletter } from '@/app/(frontend)/actions/submitCampaignNewsletter'
import { CAMPAIGN_NEWSLETTER_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const deleteNewsletterConsentRows = async () => {
  // Deleting a consent fails while a subscription references it
  // (`subscription.consent_id` is NOT NULL with an `ON DELETE SET NULL` FK),
  // so purge referencing subscriptions first — also covers crash leftovers.
  const consents = await payload.find({
    collection: 'consent',
    where: { key: { equals: CAMPAIGN_NEWSLETTER_CONSENT_KEY } },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
  })
  for (const consent of consents.docs) {
    await payload.delete({
      collection: 'subscription',
      where: { consent: { equals: consent.id } },
      depth: 0,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'consent',
      id: consent.id,
      depth: 0,
      overrideAccess: true,
    })
  }
}

const findSubscriptionByPhone = async (phone: string) => {
  const contacts = await payload.find({
    collection: 'contact',
    where: { 'phones.value': { equals: phone } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const contact = contacts.docs[0]
  if (!contact) return undefined

  const subscriptions = await payload.find({
    collection: 'subscription',
    where: { contact: { equals: contact.id } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return { contact, subscription: subscriptions.docs[0] }
}

describe('submitCampaignNewsletter (consent by stable key + level choice)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  // One row per key is what production assumes; deleting before each test
  // keeps the "most recent row wins" resolver deterministic without relying on
  // created-at precision.
  beforeEach(deleteNewsletterConsentRows)

  it('fails closed while the keyed Consent document is missing', async () => {
    await deleteNewsletterConsentRows()

    await expect(
      submitCampaignNewsletter({
        name: campaignFixtures().personName('Contato'),
        phone: campaignFixtures().phone(),
      }),
    ).rejects.toThrow('Consentimento de novidades da campanha ainda não configurado.')
  })

  it('records contact + subscription with the default "time" level', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent({ key: CAMPAIGN_NEWSLETTER_CONSENT_KEY })
    const phone = fixtures.phone()

    const result = await submitCampaignNewsletter({
      name: fixtures.personName('Contato'),
      phone,
      comment: 'Quero acompanhar a campanha.',
    })
    expect(result).toEqual({ ok: true })

    const { contact, subscription } = (await findSubscriptionByPhone(phone)) ?? {}
    expect(contact).toBeDefined()
    expect(subscription).toBeDefined()
    // depth 0 returns the raw relationship id — the consent link itself.
    expect(subscription!.consent).toBe(consent.id)
    // The toggle is pre-selected: the default level is recorded as data.
    expect(subscription!.campaignLevel).toBe('time')

    // The action's rows are not fixture-owned — clean them here so the
    // fixture's contact cleanup does not trip on the subscription FK.
    await payload.delete({
      collection: 'subscription',
      id: subscription!.id,
      depth: 0,
      overrideAccess: true,
    })
  })

  it('records the "esporadico" level and an optional state is not persisted', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent({ key: CAMPAIGN_NEWSLETTER_CONSENT_KEY })
    const phone = fixtures.phone()

    const result = await submitCampaignNewsletter({
      name: fixtures.personName('Contato'),
      phone,
      email: `${fixtures.value('nl')}@example.com`,
      city: 'Salvador',
      campaignLevel: 'esporadico',
    })
    expect(result).toEqual({ ok: true })

    const { contact, subscription } = (await findSubscriptionByPhone(phone)) ?? {}
    expect(contact).toBeDefined()
    expect(contact!.state).toBeNull()
    expect(contact!.city).toBe('Salvador')
    expect(subscription).toBeDefined()
    expect(subscription!.campaignLevel).toBe('esporadico')
    expect(subscription!.consent).toBe(consent.id)

    await payload.delete({
      collection: 'subscription',
      id: subscription!.id,
      depth: 0,
      overrideAccess: true,
    })
  })
})
