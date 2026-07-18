import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import { getPayload, type CollectionSlug, type Payload, type PayloadRequest } from 'payload'

import config from '../../../src/payload.config.js'
import { withPayloadTransaction } from '../../../src/utilities/payloadTransaction.js'
import { assertTestDatabase } from '../../helpers/assertTestDatabase.js'
import { withInviteConsent } from '../../helpers/testDatabaseLease.js'
import { expect, test as base } from './e2eTest.js'

const defaultBaseURL = 'http://localhost:3000'
type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type OwnedCollection =
  | 'users'
  | 'campaignUser'
  | 'electoralNucleus'
  | 'contact'
  | 'leadership'
  | 'nucleusUpdate'
  | 'campaignInvite'
  | 'consent'

const deletionOrder: OwnedCollection[] = [
  'campaignInvite',
  'nucleusUpdate',
  'leadership',
  'electoralNucleus',
  'contact',
  'campaignUser',
  'consent',
  'users',
]

class CampaignE2EOwnership {
  readonly payload: Payload
  readonly runID = randomUUID()
  private counter = 0
  private readonly owned = new Map<OwnedCollection, Set<number>>(
    deletionOrder.map((collection) => [collection, new Set<number>()]),
  )

  constructor(private readonly rootPayload: Payload) {
    this.payload = new Proxy(Object.create(rootPayload) as Payload, {
      get: (_target, property) => {
        if (property === 'create') {
          return async (args: Parameters<Payload['create']>[0]) => {
            const document = await rootPayload.create(args as never)
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
    const [users, campaignUsers, contacts, nuclei, consents] = await Promise.all([
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
        collection: 'electoralNucleus',
        where: {
          or: [{ name: { contains: this.runID } }, { slug: { contains: this.runID } }],
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
    ])
    for (const user of users.docs) this.own('users', user.id)
    for (const user of campaignUsers.docs) this.own('campaignUser', user.id)
    for (const contact of contacts.docs) this.own('contact', contact.id)
    for (const nucleus of nuclei.docs) this.own('electoralNucleus', nucleus.id)
    for (const consent of consents.docs) this.own('consent', consent.id)

    const userIDs = this.ids('campaignUser')
    const nucleusIDs = this.ids('electoralNucleus')
    const contactIDs = this.ids('contact')
    const leaderships = await this.rootPayload.find({
      collection: 'leadership',
      where: {
        or: [
          ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
          ...(userIDs.length ? [{ user: { in: userIDs } }] : []),
          ...(nucleusIDs.length ? [{ nucleus: { in: nucleusIDs } }] : []),
          ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
        ],
      },
      depth: 0,
      pagination: false,
    })
    for (const leadership of leaderships.docs) this.own('leadership', leadership.id)

    const leadershipIDs = this.ids('leadership')
    if (leadershipIDs.length) {
      const invites = await this.rootPayload.find({
        collection: 'campaignInvite',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        pagination: false,
      })
      for (const invite of invites.docs) this.own('campaignInvite', invite.id)
    }
    if (nucleusIDs.length || userIDs.length) {
      const updates = await this.rootPayload.find({
        collection: 'nucleusUpdate',
        where: {
          or: [
            ...(nucleusIDs.length ? [{ nucleus: { in: nucleusIDs } }] : []),
            ...(userIDs.length ? [{ author: { in: userIDs } }] : []),
          ],
        },
        depth: 0,
        pagination: false,
      })
      for (const update of updates.docs) this.own('nucleusUpdate', update.id)
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

export type CampaignE2EFixture = {
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

const removeSentinel = async (payload: Payload, sentinelID: number): Promise<void> => {
  await withPayloadTransaction(payload, async ({ req }) => {
    const result = await payload.delete({
      collection: 'electoralNucleus',
      where: { id: { equals: sentinelID } },
      depth: 0,
      req,
    })
    if (result.errors.length) {
      throw new AggregateError(result.errors, 'Failed to remove the E2E ownership sentinel.')
    }
  })
}

export const test = base.extend<CampaignE2ETestFixtures>({
  campaign: async ({}, runFixture) => {
    assertTestDatabase(process.env.DATABASE_URL)
    const payload = await getPayload({ config })
    const fixtures = new CampaignE2EOwnership(payload)
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL
    const sentinelName = `Sentinela E2E não relacionada ${randomUUID()}`
    const sentinel = await withPayloadTransaction(payload, ({ req }) =>
      payload.create({
        collection: 'electoralNucleus',
        data: {
          name: sentinelName,
          city: 'Salvador',
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      }),
    )

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
          await page.getByRole('button', { name: 'Entrar' }).click()
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
        const preserved = await payload.findByID({
          collection: 'electoralNucleus',
          id: sentinel.id,
          depth: 0,
        })
        expect(preserved.name).toBe(sentinelName)
      } catch (error) {
        cleanupFailure = error
      }
      try {
        await removeSentinel(payload, sentinel.id)
      } catch (error) {
        cleanupFailure =
          cleanupFailure === undefined
            ? error
            : new AggregateError(
                [cleanupFailure, error],
                'Campaign E2E cleanup and sentinel removal both failed.',
              )
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
