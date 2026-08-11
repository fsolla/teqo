// @vitest-environment node

/**
 * P3-B: the public petition-signature flow resolves the consent SERVER-SIDE
 * from the petition's own `form.consent` — a client-posted `consentId` is
 * inert (dropped at the input boundary), so a signature always records the
 * document whose text the page rendered, never one the caller chose.
 */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// The Petition afterChange hook revalidates its ISR tag, which needs the Next
// runtime — neuter it (the revalidation itself is pinned elsewhere).
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

import { submitPetitionSignature } from '@/app/(frontend)/actions/submitPetitionSignature'
import type { Petition } from '@/payload-types'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const petitionBody: Petition['body'] = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Corpo da petição de teste', version: 1 }],
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

const relationIdOf = (value: unknown): number =>
  typeof value === 'object' && value !== null ? (value as { id: number }).id : (value as number)

describe('submitPetitionSignature (server-side consent resolution)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('records the petition consent and ignores a tampered posted consentId', async () => {
    const fixtures = campaignFixtures()
    const petitionConsent = await fixtures.createConsent()
    const otherConsent = await fixtures.createConsent()
    const petition = await payload.create({
      collection: 'petition',
      data: {
        id: `peticao-${fixtures.value('p3b')}`,
        title: 'Petição de teste P3-B',
        subtitle: 'Consentimento resolvido no servidor',
        enabled: true,
        body: petitionBody,
        form: { consent: petitionConsent.id },
        _status: 'published',
      },
      depth: 0,
      overrideAccess: true,
    })

    const phone = fixtures.phone()
    const result = await submitPetitionSignature({
      name: fixtures.personName('Assinante'),
      email: `${fixtures.value('sign')}@example.com`,
      phone,
      state: 'BA',
      city: 'Salvador',
      petitionId: String(petition.id),
      // Tampered extra field: the input boundary drops it, so it must be inert.
      consentId: otherConsent.id,
    } as Parameters<typeof submitPetitionSignature>[0] & { consentId: number })

    expect(result.ok).toBe(true)
    expect(result.signatureNumber).toBeGreaterThan(0)

    const contacts = await payload.find({
      collection: 'contact',
      where: { 'phones.value': { equals: phone } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const contact = contacts.docs[0]
    expect(contact).toBeDefined()

    const signatures = await payload.find({
      collection: 'signature',
      where: { contact: { equals: contact!.id } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const signature = signatures.docs[0]
    expect(signature).toBeDefined()
    expect(relationIdOf(signature!.consent)).toBe(petitionConsent.id)

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
    expect(relationIdOf(subscription!.consent)).toBe(petitionConsent.id)

    // The action's rows are not fixture-owned — delete them here so the
    // fixture's contact cleanup does not trip on the FKs; the petition row is
    // not tracked by the fixtures either.
    await payload.delete({
      collection: 'signature',
      id: signature!.id,
      depth: 0,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'subscription',
      id: subscription!.id,
      depth: 0,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'petition',
      id: petition.id,
      depth: 0,
      overrideAccess: true,
    })
  })
})
