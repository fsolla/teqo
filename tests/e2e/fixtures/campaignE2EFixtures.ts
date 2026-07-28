import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import { getPayload, type CollectionSlug, type Payload, type PayloadRequest } from 'payload'

import { municipalityCatalog } from '../../../src/lib/municipalityCatalog.js'
import config from '../../../src/payload.config.js'
import { withPayloadTransaction } from '../../../src/utilities/payloadTransaction.js'
import { assertTestDatabase } from '../../helpers/assertTestDatabase.js'
import { withInviteConsent } from '../../helpers/testDatabaseLease.js'
import { test as base, expect } from './e2eTest.js'

const defaultBaseURL = 'http://localhost:3000'
type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type OwnedCollection =
  | 'users'
  | 'campaignUser'
  | 'organization'
  | 'contact'
  | 'leadership'
  | 'votePledge'
  | 'campaignDemand'
  | 'allocationDecision'
  | 'municipalityUpdate'
  | 'activity'
  | 'campaignInvite'
  | 'consent'
  | 'supporter'

const deletionOrder: OwnedCollection[] = [
  'campaignInvite',
  'votePledge',
  'campaignDemand',
  'allocationDecision',
  'municipalityUpdate',
  'activity',
  'leadership',
  'supporter',
  'organization',
  'contact',
  'campaignUser',
  'consent',
  'users',
]

/**
 * Municipalities are SEEDED reference rows (435 from the static catalog): E2E tests
 * never create/delete them. `claimMunicipality` hands out a globally unique seeded
 * municipality per call (Postgres sequence — safe across parallel workers) and
 * cleanup resets the operational fields the test may have touched.
 */
class CampaignE2EOwnership {
  readonly payload: Payload
  readonly runID = randomUUID()
  private counter = 0
  private readonly touchedMunicipalities = new Set<number>()
  private readonly owned = new Map<OwnedCollection, Set<number>>(
    deletionOrder.map((collection) => [collection, new Set<number>()]),
  )

  constructor(private readonly rootPayload: Payload) {
    this.payload = new Proxy(Object.create(rootPayload) as Payload, {
      get: (_target, property) => {
        if (property === 'create') {
          return async (args: Parameters<Payload['create']>[0]) => {
            const document = await rootPayload.create(args)
            if (this.isOwnedCollection(args.collection) && typeof document.id === 'number') {
              this.own(args.collection, document.id)
            }
            return document
          }
        }
        const value = Reflect.get(rootPayload, property)
        return typeof value === 'function' ? value.bind(rootPayload) : value
      },
    }) as Payload
  }

  value(prefix: string): string {
    this.counter += 1
    return `${prefix}-${this.runID}-${this.counter}`
  }

  phone(): string {
    this.counter += 1
    const seed = BigInt(`0x${this.runID.replaceAll('-', '').slice(0, 12)}`)
    const suffix = ((seed + BigInt(this.counter)) % 90_000_000n) + 10_000_000n
    return `719${suffix}`
  }

  async claimMunicipality(): Promise<{ id: number; name: string; slug: string }> {
    await this.rootPayload.db.drizzle
      .execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "campaign_fixture_municipality_alloc"`))
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') return
        throw error
      })
    const result = await this.rootPayload.db.drizzle.execute(
      sql.raw(`SELECT nextval('"campaign_fixture_municipality_alloc"') AS "value"`),
    )
    const index =
      Number((result.rows[0] as { value: string | number }).value) % municipalityCatalog.length
    const slug = municipalityCatalog[index]!.slug
    const found = await this.rootPayload.find({
      collection: 'municipality',
      where: { slug: { equals: slug } },
      depth: 0,
      limit: 1,
      pagination: false,
    })
    const municipality = found.docs[0]
    if (!municipality)
      throw new Error(`Seeded municipality "${slug}" not found — run migrations first.`)
    this.touchedMunicipalities.add(municipality.id)
    // The catalog name, not the row's: since B34+ the chips label from
    // `municipalityCatalog`, so a row an int spec renamed and left behind would
    // make a specifier here miss the element the UI actually renders.
    return {
      id: municipality.id,
      name: municipalityCatalog[index]!.name,
      slug: municipality.slug,
    }
  }

  touchMunicipality(id: number): void {
    this.touchedMunicipalities.add(id)
  }

  /**
   * A leadership plus the `contact` it is required to point at — the pair every
   * spec that needs a row on `/campanha/liderancas` was writing out by hand.
   * Returns both, since assertions look the leadership up by id and find the row
   * by the contact's name.
   */
  async createStaffLeadership({
    namePrefix,
    municipalities,
    supportStatus = 'a_abordar',
    user,
  }: {
    namePrefix: string
    municipalities: { id: number; name: string }[]
    supportStatus?: 'a_abordar' | 'em_disputa' | 'engajado' | 'negativo'
    user?: number
  }): Promise<{ contactName: string; contactId: number; leadershipId: number }> {
    const contactName = this.value(namePrefix)
    const contact = await this.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phone: this.phone(),
        state: 'BA',
        city: municipalities[0]?.name ?? 'Salvador',
      },
      depth: 0,
    })

    const leadership = await this.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        municipalities: municipalities.map((municipality) => municipality.id),
        supportStatus,
        ...(user === undefined ? {} : { user }),
      },
      depth: 0,
    })

    return { contactName, contactId: contact.id, leadershipId: leadership.id }
  }

  private isOwnedCollection(collection: CollectionSlug): collection is OwnedCollection {
    return this.owned.has(collection as OwnedCollection)
  }

  private own(collection: OwnedCollection, id: number): void {
    this.owned.get(collection)!.add(id)
  }

  private ids(collection: OwnedCollection): number[] {
    return [...this.owned.get(collection)!]
  }

  private async discoverOwnedRows(): Promise<void> {
    const [users, campaignUsers, contacts, organizations, activities, consents] = await Promise.all(
      [
        this.rootPayload.find({
          collection: 'users',
          where: { email: { contains: this.runID } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignUser',
          where: {
            or: [
              { name: { contains: this.runID } },
              { email: { contains: this.runID } },
              { username: { contains: this.runID } },
            ],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'contact',
          where: {
            or: [{ name: { contains: this.runID } }, { email: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'organization',
          where: {
            or: [{ name: { contains: this.runID } }, { slug: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'activity',
          where: {
            or: [{ title: { contains: this.runID } }, { slug: { contains: this.runID } }],
          },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'consent',
          where: { key: { contains: this.runID } },
          depth: 0,
          pagination: false,
        }),
      ],
    )
    for (const user of users.docs) this.own('users', user.id)
    for (const user of campaignUsers.docs) this.own('campaignUser', user.id)
    for (const contact of contacts.docs) this.own('contact', contact.id)
    for (const organization of organizations.docs) this.own('organization', organization.id)
    for (const activity of activities.docs) this.own('activity', activity.id)
    for (const consent of consents.docs) this.own('consent', consent.id)

    const userIDs = this.ids('campaignUser')
    const contactIDs = this.ids('contact')
    const leaderships = await this.rootPayload.find({
      collection: 'leadership',
      where: {
        or: [
          ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
          ...(userIDs.length ? [{ user: { in: userIDs } }] : []),
          ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
        ],
      },
      depth: 0,
      pagination: false,
    })
    for (const leadership of leaderships.docs) this.own('leadership', leadership.id)

    const leadershipIDs = this.ids('leadership')
    if (leadershipIDs.length) {
      const [invites, pledges, demands] = await Promise.all([
        this.rootPayload.find({
          collection: 'campaignInvite',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'votePledge',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignDemand',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
        }),
      ])
      for (const invite of invites.docs) this.own('campaignInvite', invite.id)
      for (const pledge of pledges.docs) this.own('votePledge', pledge.id)
      for (const demand of demands.docs) this.own('campaignDemand', demand.id)
    }
    if (userIDs.length) {
      const [updates, demands] = await Promise.all([
        this.rootPayload.find({
          collection: 'municipalityUpdate',
          where: { author: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
        this.rootPayload.find({
          collection: 'campaignDemand',
          where: { createdBy: { in: userIDs } },
          depth: 0,
          pagination: false,
        }),
      ])
      for (const update of updates.docs) this.own('municipalityUpdate', update.id)
      for (const demand of demands.docs) this.own('campaignDemand', demand.id)
    }
    if (contactIDs.length || userIDs.length) {
      const supporters = await this.rootPayload.find({
        collection: 'supporter',
        where: {
          or: [
            ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
            ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
          ],
        },
        depth: 0,
        pagination: false,
      })
      for (const supporter of supporters.docs) this.own('supporter', supporter.id)
    }
  }

  async cleanup(): Promise<void> {
    await this.discoverOwnedRows()
    await withPayloadTransaction(this.rootPayload, async ({ req, transactionID }) => {
      const transaction = this.rootPayload.db.sessions?.[String(transactionID)]?.db as
        | { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }
        | undefined
      if (!transaction) throw new Error('Campaign E2E cleanup transaction is unavailable.')
      const userIDs = this.ids('campaignUser')
      if (userIDs.length) {
        await transaction.execute(sql`
          DELETE FROM "payload_preferences"
          WHERE "id" IN (
            SELECT "parent_id"
            FROM "payload_preferences_rels"
            WHERE "campaign_user_id" IN (${sql.join(
              userIDs.map((id) => sql`${id}`),
              sql`, `,
            )})
          )
        `)
      }
      for (const collection of deletionOrder) {
        const ids = this.ids(collection)
        if (!ids.length) continue
        const result = await this.rootPayload.delete({
          collection,
          where: { id: { in: ids } },
          depth: 0,
          req,
        })
        if (result.errors.length) {
          throw new AggregateError(result.errors, `Failed to clean owned ${collection} rows.`)
        }
      }
      for (const municipalityID of this.touchedMunicipalities) {
        await this.rootPayload.update({
          collection: 'municipality',
          id: municipalityID,
          data: {
            advisors: [],
            priority: 'normal',
            expectedVotes: { pessimistic: null, central: null, optimistic: null },
            politicalTrend: { status: null, note: null, recordedBy: null, recordedAt: null },
            strengths: [],
            risks: [],
            dobradinhaNotes: null,
            nextSteps: null,
            lastUpdateAt: null,
          },
          depth: 0,
          req,
        })
      }
    })
  }

  async expectNoOwnedRows(): Promise<void> {
    for (const collection of deletionOrder) {
      const ids = this.ids(collection)
      if (!ids.length) continue
      const remaining = await this.rootPayload.find({
        collection,
        where: { id: { in: ids } },
        depth: 0,
        limit: 1,
      })
      expect(remaining.totalDocs, `Owned ${collection} rows remain`).toBe(0)
    }
  }
}

/**
 * Waits for an auto-saving cell's write to actually land.
 *
 * Every cell in the B32+ family paints optimistically, so asserting on the text
 * proves nothing about the database — a `page.reload()` right after would race
 * the POST. Pair this with the interaction inside one `Promise.all`.
 */
export const expectPostResponse = (page: Page, urlFragment: string) =>
  page.waitForResponse(
    (response) =>
      response.url().includes(urlFragment) &&
      response.request().method() === 'POST' &&
      response.ok(),
  )

type CampaignE2EFixture = {
  baseURL: string
  fixtures: CampaignE2EOwnership
  login: (page: Page, identifier: string, password: string) => Promise<void>
  payload: Payload
  transaction: <Result>(
    operation: (payload: Payload, req: TransactionRequest) => Promise<Result>,
  ) => Promise<Result>
  withInviteConsent: typeof withInviteConsent
}

type CampaignE2ETestFixtures = {
  campaign: CampaignE2EFixture
}

export const test = base.extend<CampaignE2ETestFixtures>({
  campaign: async ({}, runFixture) => {
    assertTestDatabase(process.env.DATABASE_URL)
    const payload = await getPayload({ config })
    const fixtures = new CampaignE2EOwnership(payload)
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL

    let testFailure: unknown
    try {
      await runFixture({
        baseURL,
        fixtures,
        login: async (page, identifier, password) => {
          await page.context().clearCookies()
          await page.goto(`${baseURL}/campanha/login`)
          await page.getByLabel('E-mail ou celular').fill(identifier)
          await page.getByLabel('Senha').fill(password)
          // `exact`: the login screen also offers "Entrar com digital ou Face
          // ID" (B40) whenever the device has a platform authenticator — which
          // any spec adding a virtual one does.
          await page.getByRole('button', { name: 'Entrar', exact: true }).click()
          await page.waitForURL(`${baseURL}/campanha`)
        },
        payload: fixtures.payload,
        transaction: (operation) =>
          withPayloadTransaction(payload, ({ req }) => operation(fixtures.payload, req)),
        withInviteConsent,
      })
    } catch (error) {
      testFailure = error
      throw error
    } finally {
      let cleanupFailure: unknown
      try {
        assertTestDatabase(process.env.DATABASE_URL)
        await fixtures.cleanup()
        await fixtures.expectNoOwnedRows()
      } catch (error) {
        cleanupFailure = error
      }
      if (cleanupFailure !== undefined) {
        if (testFailure !== undefined) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            'Campaign E2E test and ownership cleanup both failed.',
          )
        }
        throw cleanupFailure
      }
    }
  },
})

export { expect }
