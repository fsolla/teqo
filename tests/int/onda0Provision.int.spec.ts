// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { ONDA0_CONSENT_ENTRIES, ONDA0_CONSENT_KEY_LIST } from '@/lib/onda0ConsentTexts'
import config from '@/payload.config'
import { requireConsentByKey } from '@/utilities/campaignConsent'
import {
  provisionOnda0ConsentAndPrivacy,
  provisionOnda0ConsentAndPrivacyDb,
  removeOnda0ConsentAndPrivacyDb,
} from '@/utilities/onda0Provision'

import { assertTestDatabase } from '../helpers/assertTestDatabase'
import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
  SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_LEASE_KEY,
  restoreConsentRows,
  withSharedTestDatabaseLease,
  type ConsentSnapshot,
} from '../helpers/testDatabaseLease'

let payload: Payload

installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('Onda 0 provision (integration)', () => {
  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL)
    payload = await getPayload({ config })
  })

  it('upserts consent keys and publishes privacy-policy idempotently', async () => {
    // Shared leases on the stable keys other spec files exercise: the
    // provision UPSERTS the shared rows and the spec below REMOVES them, so
    // the writes must never interleave a parallel file's reads of the same
    // rows (D9 flake). SHARED — not exclusive — because this spec only
    // touches the four canonical keys and an exclusive holder here widened
    // the consent-lease deadlock surface with the invite-domain writers
    // (cascade under parallel load). The missing-consent fail-closed paths in
    // other files now serialize their own windows under the lease, and the
    // down-test below restores the removed rows with their original ids, so
    // the shared rows are never observed absent or re-created with a new id.
    // (The fourth Onda0 key, campanha-notificacoes-push, has no lease
    // constant because no spec file writes it today; the down-test below
    // still restores it.)
    await withSharedTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY, () =>
      withSharedTestDatabaseLease(payload, SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY, () =>
        withSharedTestDatabaseLease(
          payload,
          SUPPORTER_VOTE_INTENTION_CONSENT_LEASE_KEY,
          async () => {
            await provisionOnda0ConsentAndPrivacy(payload)
            await provisionOnda0ConsentAndPrivacy(payload)

            for (const { key } of ONDA0_CONSENT_ENTRIES) {
              const descriptor = await requireConsentByKey(payload, key)
              expect(descriptor.key).toBe(key)
              expect(descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/)
            }

            const privacy = await payload.findGlobal({
              slug: 'privacy-policy',
              overrideAccess: true,
            })
            expect(privacy.published).toBe(true)
            expect(privacy.body).toBeTruthy()
          },
        ),
      ),
    )
  })

  it('provisionOnda0ConsentAndPrivacyDb upserts and removes via SQL', async () => {
    await withSharedTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY, () =>
      withSharedTestDatabaseLease(payload, SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY, () =>
        withSharedTestDatabaseLease(
          payload,
          SUPPORTER_VOTE_INTENTION_CONSENT_LEASE_KEY,
          async () => {
            const db = payload.db.drizzle

            await provisionOnda0ConsentAndPrivacyDb(db)
            await provisionOnda0ConsentAndPrivacyDb(db)

            const consentRows = await db.execute(sql`
              SELECT "id", "key", "text", "updated_at", "created_at"
              FROM "consent"
              WHERE "key" IN (${sql.join(
                ONDA0_CONSENT_KEY_LIST.map((key) => sql`${key}`),
                sql`, `,
              )})
              ORDER BY "key"
            `)
            expect(consentRows.rows.map((row) => row.key)).toEqual(
              [...ONDA0_CONSENT_KEY_LIST].sort(),
            )

            const privacyRows = await db.execute(sql`
              SELECT "published", "body"
              FROM "privacy_policy"
              LIMIT 1
            `)
            expect(privacyRows.rows[0]?.published).toBe(true)
            expect(privacyRows.rows[0]?.body).toBeTruthy()

            await removeOnda0ConsentAndPrivacyDb(db)

            const consentAfterDown = await db.execute(sql`
              SELECT count(*)::integer AS count
              FROM "consent"
              WHERE "key" IN (${sql.join(
                ONDA0_CONSENT_KEY_LIST.map((key) => sql`${key}`),
                sql`, `,
              )})
            `)
            expect(consentAfterDown.rows[0]?.count).toBe(0)

            const privacyAfterDown = await db.execute(sql`
              SELECT "published"
              FROM "privacy_policy"
              LIMIT 1
            `)
            expect(privacyAfterDown.rows[0]?.published).toBe(false)

            // The down-migration must stay a no-op for parallel spec files:
            // restoring the removed rows with their ORIGINAL ids (inside the
            // exclusive lease, invisible to them) keeps the stable keys
            // present with unchanged ids, so no other file's restore assertion
            // can observe the absence (D9 flake).
            await restoreConsentRows(
              (query) => db.execute(query),
              consentRows.rows as ConsentSnapshot[],
            )
          },
        ),
      ),
    )
  })
})
