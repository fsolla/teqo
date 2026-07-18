// @vitest-environment node

import { createRequire } from 'node:module'

import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { sql } from '@payloadcms/db-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { migrations } from '@/migrations'
import { withCampaignFixtures } from '../helpers/campaignFixtures'

const require = createRequire(import.meta.resolve('@payloadcms/db-postgres'))
const { Pool } = require('pg') as {
  Pool: new (options: { connectionString: string }) => {
    end: () => Promise<void>
    query: (statement: string) => Promise<unknown>
  }
}

const adminUrl = 'postgresql://teqo:teqo@localhost:5432/postgres'

// This is the exact 15-table campaign fixture surface measured before Phase 4B.
// Electoral nuclei currently persist four array fields and one coordinators
// relationship table. There is no previousSlugs field/table: nucleus names and
// canonical slugs are immutable by design.
const campaignFixtureTables = [
  'campaign_user',
  'campaign_user_sessions',
  'consent',
  'contact',
  'electoral_nucleus',
  'electoral_nucleus_rels',
  'electoral_nucleus_tse_zones',
  'electoral_nucleus_voter_profiles',
  'electoral_nucleus_strengths',
  'electoral_nucleus_risks',
  'leadership',
  'campaign_invite',
  'nucleus_update',
  'payload_locked_documents',
  'payload_locked_documents_rels',
] as const

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
    expect(during[table], `${table} should contain a representative fixture row`).toBeGreaterThan(
      before[table],
    )
  }
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  databaseName = `teqo_campaign_fixture_counts_${process.pid}_test`
  databaseUrl = `postgresql://teqo:teqo@localhost:5432/${databaseName}`
  const adminPool = new Pool({ connectionString: adminUrl })
  await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`)
  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
  await adminPool.end()

  const migrationPool = new Pool({ connectionString: databaseUrl })
  const database = drizzle(migrationPool as never)
  for (const migration of migrations) {
    await migration.up({ db: database } as never)
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
      const general = await fixtures.createCampaignUser('geral')
      const consent = await fixtures.createConsent()
      const contact = await fixtures.createContact()
      const nucleus = await fixtures.createNucleus({
        coordinators: [general.id],
        tseZones: [{ zoneNumber: 1, label: fixtures.value('Zona') }],
        voterProfiles: [
          {
            label: fixtures.value('Perfil'),
            ageRange: '25–44',
            incomeBand: 'Até 3 salários mínimos',
            occupation: 'Trabalhadores de serviços',
            localTraits: 'Atuação comunitária',
            notes: 'Perfil representativo',
          },
        ],
        strengths: [{ text: fixtures.value('Força') }],
        risks: [{ text: fixtures.value('Risco') }],
      })
      const leadership = await fixtures.createLeadership({
        contact,
        nucleus,
        consent,
        createdBy: general,
      })
      await fixtures.createNucleusUpdate({ nucleus, author: general })
      await fixtures.createInvite({ leadership, createdBy: general })
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
          ${general.id},
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
          "electoral_nucleus_id"
        )
        VALUES (${lockedDocumentID}, 'relationTo', ${nucleus.id})
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
        const user = await fixtures.createCampaignUser('geral')
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
          nucleus: 999_999_999,
        })
      }),
    ).rejects.toThrow()
    expect(await readCampaignFixtureTableCounts()).toEqual(before)
  })
})
