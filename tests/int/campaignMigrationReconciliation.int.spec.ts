// @vitest-environment node

import { createRequire } from 'node:module'

import { sql } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '@/migrations'

const require = createRequire(import.meta.resolve('@payloadcms/db-postgres'))
const { Pool } = require('pg') as {
  Pool: new (options: { connectionString: string }) => {
    connect: () => Promise<{ query: (statement: string) => Promise<unknown>; release: () => void }>
    end: () => Promise<void>
    query: (statement: string) => Promise<{ rows: Array<Record<string, unknown>> }>
  }
}

const adminUrl = 'postgresql://teqo:teqo@localhost:5432/postgres'
const consolidatedName = '20260718_010733_consolidate_campaign_schema'
let databaseSequence = 0
let databaseName = ''
let databasePool: InstanceType<typeof Pool> | undefined
let database: ReturnType<typeof drizzle> | undefined

const quoteIdentifier = (identifier: string): string => {
  if (!/^[a-z0-9_]+$/.test(identifier)) throw new Error(`Unsafe database identifier: ${identifier}`)
  return `"${identifier}"`
}

const schemaChecksum = async (): Promise<string> => {
  if (!database) throw new Error('Disposable database is not initialized.')
  const result = await database.execute(sql`
    WITH facts AS (
      SELECT
        'column|' || table_name || '|' || column_name || '|' || data_type || '|' ||
        coalesce(udt_name, '') || '|' || is_nullable || '|' || coalesce(column_default, '') AS fact
      FROM information_schema.columns
      WHERE table_schema = 'public'
      UNION ALL
      SELECT
        'constraint|' || rel.relname || '|' || con.conname || '|' ||
        con.contype::text || '|' || pg_get_constraintdef(con.oid, true)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'index|' || idx.relname || '|' || pg_get_indexdef(idx.oid)
      FROM pg_class idx
      JOIN pg_index i ON i.indexrelid = idx.oid
      JOIN pg_class rel ON rel.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'enum|' || t.typname || '|' || e.enumsortorder || '|' || e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    )
    SELECT md5(string_agg(fact, E'\n' ORDER BY fact)) AS checksum
    FROM facts
  `)
  return String(result.rows[0]?.checksum)
}

beforeEach(async () => {
  databaseName = `teqo_campaign_migration_${process.pid}_${databaseSequence++}_test`
  const adminPool = new Pool({ connectionString: adminUrl })
  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
  await adminPool.end()

  databasePool = new Pool({
    connectionString: `postgresql://teqo:teqo@localhost:5432/${databaseName}`,
  })
  database = drizzle(databasePool as never)

  for (const migration of migrations) {
    await migration.up({ db: database } as never)
  }
})

afterEach(async () => {
  await databasePool?.end()
  database = undefined
  databasePool = undefined

  if (databaseName) {
    const adminPool = new Pool({ connectionString: adminUrl })
    await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`)
    await adminPool.end()
  }
})

const partialSchemaMutations = [
  [
    'campaign user email nullability',
    'ALTER TABLE "campaign_user" ALTER COLUMN "email" SET NOT NULL',
  ],
  ['contact email nullability', 'ALTER TABLE "contact" ALTER COLUMN "email" SET NOT NULL'],
  ['contact city nullability', 'ALTER TABLE "contact" ALTER COLUMN "city" SET NOT NULL'],
  [
    'missing locked-document foreign key',
    'ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk"',
  ],
  [
    'wrong locked-document foreign-key delete action',
    `ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk";
     ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk"
      FOREIGN KEY ("campaign_invite_id") REFERENCES "campaign_invite"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION`,
  ],
  [
    'wrong locked-document foreign-key target',
    `ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk";
     ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk"
      FOREIGN KEY ("campaign_invite_id") REFERENCES "leadership"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
] as const

describe('campaign migration existing-schema reconciliation', () => {
  it.each(partialSchemaMutations)(
    'rejects %s without changing schema or recording the migration',
    async (_label, mutation) => {
      if (!database) throw new Error('Disposable database is not initialized.')
      await database.execute(sql.raw(mutation))
      const checksumBefore = await schemaChecksum()
      const consolidated = migrations.find((migration) => migration.name === consolidatedName)
      if (!consolidated) throw new Error('Consolidated campaign migration is not registered.')

      await expect(
        database.transaction(async (transaction) => {
          await consolidated.up({ db: transaction } as never)
          await transaction.execute(sql`
            INSERT INTO "payload_migrations" ("name", "batch", "updated_at", "created_at")
            VALUES (${consolidatedName}, 999, now(), now())
          `)
        }),
      ).rejects.toThrow('Refusing campaign schema reconciliation')

      expect(await schemaChecksum()).toBe(checksumBefore)
      const migrationRows = await database.execute(sql`
        SELECT count(*)::integer AS count
        FROM "payload_migrations"
        WHERE "name" = ${consolidatedName}
      `)
      expect(migrationRows.rows[0]?.count).toBe(0)
    },
    120_000,
  )

  it('rolls back consolidated and immutable campaign-user migrations on the empty path', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')
    const consolidated = migrations.find((migration) => migration.name === consolidatedName)
    const original = migrations.find(
      (migration) => migration.name === '20260716_010420_add_campaign_user',
    )
    const onda0Seed = migrations.find(
      (migration) => migration.name === '20260719_054707_seed_onda0_consent_and_privacy',
    )
    if (!consolidated || !original || !onda0Seed) {
      throw new Error('Campaign migrations are not registered.')
    }

    await onda0Seed.down({ db: database } as never)

    await consolidated.down({ db: database } as never)
    await original.down({ db: database } as never)

    const result = await database.execute(sql`
      SELECT
        to_regclass('public.campaign_user') IS NULL AS campaign_user_removed,
        NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('payload_locked_documents_rels', 'payload_preferences_rels')
            AND column_name = 'campaign_user_id'
        ) AS relation_columns_removed
    `)
    expect(result.rows[0]).toMatchObject({
      campaign_user_removed: true,
      relation_columns_removed: true,
    })
  })

  it('refuses a populated consolidated rollback before changing schema', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')
    const consolidated = migrations.find((migration) => migration.name === consolidatedName)
    if (!consolidated) throw new Error('Consolidated campaign migration is not registered.')
    await database.execute(sql`
      INSERT INTO "campaign_user" ("name", "email", "role", "updated_at", "created_at")
      VALUES ('Rollback sentinel', 'rollback-sentinel@example.test', 'geral', now(), now())
    `)
    const checksumBefore = await schemaChecksum()

    await expect(consolidated.down({ db: database } as never)).rejects.toThrow(
      'Refusing to roll back consolidated campaign schema',
    )

    expect(await schemaChecksum()).toBe(checksumBefore)
    const sentinel = await database.execute(sql`
      SELECT count(*)::integer AS count
      FROM "campaign_user"
      WHERE "email" = 'rollback-sentinel@example.test'
    `)
    expect(sentinel.rows[0]?.count).toBe(1)
  })
})
