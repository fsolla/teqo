// @vitest-environment node

/**
 * Pass 2 D3: the public WhatsApp subscription flow resolves its Consent by the
 * stable key `whatsapp-inscricao` and FAILS CLOSED while the keyed document is
 * missing — the last hardcoded consent id (`consent: 2`) is gone.
 */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { submitWhatsapp } from '@/app/(frontend)/actions/submitWhatsapp'
import { WHATSAPP_SUBSCRIPTION_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const deleteWhatsappConsentRows = async () => {
  await payload.delete({
    collection: 'consent',
    where: { key: { equals: WHATSAPP_SUBSCRIPTION_CONSENT_KEY } },
    depth: 0,
    overrideAccess: true,
  })
}

describe('submitWhatsapp (consent by stable key)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  // Only this spec file touches the whatsapp key, so removing it here cannot
  // rob a parallel spec (unlike the shared campaign keys, which are leased).
  it('fails closed while the keyed Consent document is missing', async () => {
    await deleteWhatsappConsentRows()

    await expect(
      submitWhatsapp({
        name: campaignFixtures().personName('Contato'),
        email: `${campaignFixtures().value('whats')}@example.com`,
        phone: campaignFixtures().phone(),
        state: 'BA',
        city: 'Salvador',
      }),
    ).rejects.toThrow('Consentimento da inscrição no WhatsApp ainda não configurado.')
  })

  it('records contact + subscription linked to the keyed consent', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent({ key: WHATSAPP_SUBSCRIPTION_CONSENT_KEY })
    const phone = fixtures.phone()

    const result = await submitWhatsapp({
      name: fixtures.personName('Contato'),
      email: `${fixtures.value('whats')}@example.com`,
      phone,
      state: 'BA',
      city: 'Salvador',
      comment: 'Quero receber as novidades.',
    })
    expect(result).toEqual({ ok: true })

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const contact = contacts.docs[0]
    expect(contact).toBeDefined()

    const subscriptions = await payload.find({
      collection: 'subscription',
      where: { contact: { equals: contact!.id } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const subscription = subscriptions.docs[0]
    expect(subscription).toBeDefined()
    expect(
      typeof subscription!.consent === 'object' && subscription!.consent !== null
        ? subscription!.consent.id
        : subscription!.consent,
    ).toBe(consent.id)

    // The action's rows are not fixture-owned — clean them here so the
    // fixture's contact cleanup does not trip on the subscription FK.
    await payload.delete({
      collection: 'subscription',
      id: subscription!.id,
      depth: 0,
      overrideAccess: true,
    })
  })
})
