// @vitest-environment node

import { createRequire } from 'node:module'

import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { getPayload, type Payload } from 'payload'
import type { Pool as PgPool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { migrations } from '@/migrations'
import { withCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

const require = createRequire(import.meta.resolve('@payloadcms/db-postgres'))
const { Pool } = require('pg') as {
  Pool: new (options: { connectionString: string }) => PgPool
}

const testDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://teqo:teqo@localhost:5432/teqo_test'
const adminUrl = testDatabaseUrl.replace(/\/[^/]+$/, '/postgres')

// The campaign fixture surface after the Município remodel. Municipalities are seeded
// reference rows: `municipality` itself never changes count, while `municipality_rels`
// (advisors) and the strategy array tables must return to their baseline
// after cleanup resets every touched municipality.
const campaignFixtureTables = [
  'campaign_user',
  'campaign_user_sessions',
  'consent',
  'contact',
  'municipality',
  'municipality_rels',
  'municipality_strengths',
  'municipality_risks',
  'organization',
  'organization_rels',
  'leadership',
  'leadership_rels',
  'vote_pledge',
  'campaign_demand',
  'campaign_demand_status_history',
  'municipality_update',
  'supporter',
  'campaign_invite',
  'payload_locked_documents',
  'payload_locked_documents_rels',
] as const

/** Seeded reference tables: their counts must never grow, only stay equal. */
const seededTables = new Set<CampaignFixtureTable>(['municipality'])

type CampaignFixtureTable = (typeof campaignFixtureTables)[number]
type CampaignFixtureTableCounts = Record<CampaignFixtureTable, number>

let databaseName = ''
let databaseUrl = ''
let originalDatabaseUrl: string | undefined
let payload: Payload

const quoteIdentifier = (identifier: string): string => {
  if (!/^[a-z0-9_]+$/.test(identifier)) throw new Error(`Unsafe database identifier: ${identifier}`)
  return `"${identifier}"`
}

const readCampaignFixtureTableCounts = async (): Promise<CampaignFixtureTableCounts> => {
  const availableResult = await payload.db.drizzle.execute(sql`
    SELECT "tablename"
    FROM "pg_tables"
    WHERE "schemaname" = 'public'
  `)
  const available = new Set(availableResult.rows.map(({ tablename }) => String(tablename)))
  const missing = campaignFixtureTables.filter((table) => !available.has(table))
  if (missing.length > 0) {
    throw new Error(`Missing expected campaign fixture tables: ${missing.join(', ')}`)
  }

  const entries = await Promise.all(
    campaignFixtureTables.map(async (table) => {
      const result = await payload.db.drizzle.execute(
        sql.raw(`SELECT count(*)::integer AS "count" FROM "${table}"`),
      )
      return [table, Number(result.rows[0]?.count)] as const
    }),
  )
  return Object.fromEntries(entries) as CampaignFixtureTableCounts
}

const expectEveryTableToGrow = (
  before: CampaignFixtureTableCounts,
  during: CampaignFixtureTableCounts,
): void => {
  for (const table of campaignFixtureTables) {
    if (seededTables.has(table)) {
      expect(during[table], `${table} is seeded and must not change count`).toBe(before[table])
      continue
    }
    expect(during[table], `${table} should contain a representative fixture row`).toBeGreaterThan(
      before[table],
    )
  }
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  databaseName = `teqo_campaign_fixture_counts_${process.pid}_test`
  databaseUrl = testDatabaseUrl.replace(/\/[^/]+$/, `/${databaseName}`)
  const adminPool = new Pool({ connectionString: adminUrl })
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`)
  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
  await adminPool.end()

  const migrationPool = new Pool({ connectionString: databaseUrl })
  const database = drizzle<Record<string, unknown>>(migrationPool)
  for (const migration of migrations) {
    await migration.up(stub<MigrateUpArgs>({ db: database }))
  }
  await migrationPool.end()

  process.env.DATABASE_URL = databaseUrl
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
}, 120_000)

afterAll(async () => {
  await payload.db.destroy?.()
  const pool = payload.db.pool as typeof payload.db.pool & {
    _clients?: Array<{ release?: () => void }>
    _idle?: Array<{ client: object }>
  }
  const idleClients = new Set(pool._idle?.map(({ client }) => client))
  const poolEnd = pool.end()
  for (const client of pool._clients ?? []) {
    if (!idleClients.has(client)) client.release?.()
  }
  await poolEnd
  if (databaseName) {
    const adminPool = new Pool({ connectionString: adminUrl })
    await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`)
    await adminPool.end()
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
}, 30_000)

describe('campaign fixture PostgreSQL row-count invariant', () => {
  it('restores exact counts after a representative full graph', async () => {
    const before = await readCampaignFixtureTableCounts()
    let during: CampaignFixtureTableCounts | undefined

    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const advisor = await fixtures.createCampaignUser('advisor')
      const consent = await fixtures.createConsent()
      const contact = await fixtures.createContact()
      const supporterContact = await fixtures.createContact()
      const municipality = await fixtures.getMunicipality()

      await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
      await payload.update({
        collection: 'municipality',
        id: municipality.id,
        data: {
          priority: 'alta',
          strengths: [{ text: fixtures.value('Força') }],
          risks: [{ text: fixtures.value('Risco') }],
        },
        depth: 0,
      })

      const organization = await fixtures.createOrganization({ municipalities: [municipality.id] })
      const leadership = await fixtures.createLeadership({
        contact,
        municipalities: [municipality.id],
        organizations: [organization.id],
        consent,
        createdBy: coordinator,
      })
      await fixtures.createVotePledge({ leadership, municipality })
      await fixtures.createCampaignDemand({ municipality, leadership, createdBy: coordinator })
      await fixtures.createMunicipalityUpdate({ municipality, author: coordinator })
      await fixtures.createSupporter({
        contact: supporterContact,
        municipality,
        createdBy: coordinator,
      })
      await fixtures.createInvite({ leadership, createdBy: coordinator })
      await payload.db.drizzle.execute(sql`
        INSERT INTO "campaign_user_sessions" (
          "_order",
          "_parent_id",
          "id",
          "created_at",
          "expires_at"
        )
        VALUES (
          1,
          ${coordinator.id},
          ${fixtures.value('campaign-session')},
          now(),
          now() + interval '1 hour'
        )
      `)
      const lockedDocument = await payload.db.drizzle.execute(sql`
        INSERT INTO "payload_locked_documents" ("updated_at", "created_at")
        VALUES (now(), now())
        RETURNING "id"
      `)
      const lockedDocumentID = Number(lockedDocument.rows[0]?.id)
      await payload.db.drizzle.execute(sql`
        INSERT INTO "payload_locked_documents_rels" (
          "parent_id",
          "path",
          "leadership_id"
        )
        VALUES (${lockedDocumentID}, 'relationTo', ${leadership.id})
      `)
      during = await readCampaignFixtureTableCounts()
    })

    if (!during) throw new Error('Representative fixture graph was not measured.')
    expectEveryTableToGrow(before, during)
    expect(await readCampaignFixtureTableCounts()).toEqual(before)
  })

  it('restores exact counts after callback and partial-setup failures', async () => {
    const before = await readCampaignFixtureTableCounts()

    await expect(
      withCampaignFixtures(payload, async (fixtures) => {
        const user = await fixtures.createCampaignUser('coordinator')
        await payload.db.drizzle.execute(sql`
          INSERT INTO "campaign_user_sessions" (
            "_order",
            "_parent_id",
            "id",
            "created_at",
            "expires_at"
          )
          VALUES (
            1,
            ${user.id},
            ${fixtures.value('failed-session')},
            now(),
            now() + interval '1 hour'
          )
        `)
        throw new Error('row-count callback failure')
      }),
    ).rejects.toThrow('row-count callback failure')
    expect(await readCampaignFixtureTableCounts()).toEqual(before)

    await expect(
      withCampaignFixtures(payload, async (fixtures) => {
        await fixtures.createContact()
        await fixtures.createLeadership({
          contact: 999_999_999,
          municipalities: [999_999_999],
        })
      }),
    ).rejects.toThrow()
    expect(await readCampaignFixtureTableCounts()).toEqual(before)
  })
})
