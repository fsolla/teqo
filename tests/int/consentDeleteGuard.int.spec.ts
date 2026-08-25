// @vitest-environment node

/**
 * S9+ (Issue #771, Fase 1): deleting a Consent still referenced by a versioned
 * legal-text consumer must refuse with a friendly 409 — not the raw Postgres
 * 23502 (NOT NULL consumers) nor a silent NULL (nullable consumers like
 * petition). The guard counts references across every consumer and composes a
 * message listing them.
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { APIError, getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// The Petition afterChange hook revalidates its ISR tag, which needs the Next
// runtime — neuter it (the revalidation itself is pinned elsewhere).
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

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

describe('Consent beforeDelete guard', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('blocks deletion and lists every referencing consumer (composite 409)', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent()
    const contact = await fixtures.createContact()

    // NOT NULL consumer (would trip 23502 today) + nested-group consumer
    // (petition.form.consent, which nulls silently today).
    const subscription = await payload.create({
      collection: 'subscription',
      data: { contact: contact.id, consent: consent.id },
      depth: 0,
      overrideAccess: true,
    })
    const petition = await payload.create({
      collection: 'petition',
      data: {
        id: `peticao-${fixtures.value('guard')}`,
        title: 'Petição de teste do guard',
        subtitle: 'Consentimento referenciado',
        enabled: true,
        body: petitionBody,
        form: { consent: consent.id },
        _status: 'published',
      },
      depth: 0,
      overrideAccess: true,
    })

    let guardError: unknown
    try {
      await payload.delete({ collection: 'consent', id: consent.id, overrideAccess: true })
    } catch (error) {
      guardError = error
    }

    expect(guardError).toBeInstanceOf(Error)
    expect((guardError as { status?: number }).status).toBe(409)
    const message = (guardError as Error).message
    expect(message).toContain('não é possível excluir')
    expect(message).toContain('inscrições')
    expect(message).toContain('petições')

    // Removing the references lets the delete through.
    await payload.delete({ collection: 'subscription', id: subscription.id, overrideAccess: true })
    await payload.delete({ collection: 'petition', id: petition.id, overrideAccess: true })
    await expect(
      payload.delete({ collection: 'consent', id: consent.id, overrideAccess: true }),
    ).resolves.toBeDefined()
  })

  it('allows deletion of a consent with no references', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent()

    await expect(
      payload.delete({ collection: 'consent', id: consent.id, overrideAccess: true }),
    ).resolves.toBeDefined()
  })

  it('raw SQL delete bypasses the guard (harness / Onda0 provision parity)', async () => {
    const fixtures = campaignFixtures()
    const consent = await fixtures.createConsent()
    const contact = await fixtures.createContact()
    const subscription = await payload.create({
      collection: 'subscription',
      data: { contact: contact.id, consent: consent.id },
      depth: 0,
      overrideAccess: true,
    })

    // A raw DELETE does NOT run the admin beforeDelete hook. A referenced
    // consent still fails — but with the DB's 23502 (FK SET NULL vs NOT NULL
    // column), never the friendly 409 the hook would raise. This is exactly why
    // the test harness / Onda0 provision purge consents via raw SQL while
    // holding the lease that guarantees no live references.
    let rawError: unknown
    try {
      await payload.db.drizzle.execute(sql`DELETE FROM "consent" WHERE "id" = ${consent.id}`)
    } catch (error) {
      rawError = error
    }

    // Cleanup first (always): drop the reference, then the now-unreferenced
    // consent deletes (the hook lets it through), freeing the fixture-owned
    // contact.
    await payload.delete({ collection: 'subscription', id: subscription.id, overrideAccess: true })
    await payload.delete({ collection: 'consent', id: consent.id, overrideAccess: true })

    expect(rawError).toBeInstanceOf(Error)
    // The hook would have thrown APIError(409); a raw DELETE fails at the DB
    // layer instead, proving beforeDelete did not run.
    expect(rawError).not.toBeInstanceOf(APIError)
  })
})
