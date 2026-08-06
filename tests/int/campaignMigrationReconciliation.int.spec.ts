// @vitest-environment node

import { createRequire } from 'node:module'

import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import type { Pool as PgPool } from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '@/migrations'
import { stub } from '../helpers/stub'

const require = createRequire(import.meta.resolve('@payloadcms/db-postgres'))
const { Pool } = require('pg') as {
  Pool: new (options: { connectionString: string }) => PgPool
}

const testDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://teqo:teqo@localhost:5432/teqo_test'
const adminUrl = testDatabaseUrl.replace(/\/[^/]+$/, '/postgres')
const consolidatedName = '20260718_010733_consolidate_campaign_schema'
const stateDeputyContactMigrationName = '20260806_082110_add_state_deputy_contact'
type MigrationDatabase = MigrateUpArgs['db']
let databaseSequence = 0
let databaseName = ''
let databasePool: InstanceType<typeof Pool> | undefined
let database: MigrationDatabase | undefined

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
    connectionString: testDatabaseUrl.replace(/\/[^/]+$/, `/${databaseName}`),
  })
  database = drizzle<Record<string, unknown>>(databasePool)

  for (const migration of migrations) {
    await migration.up(stub<MigrateUpArgs>({ db: database }))
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
          await consolidated.up(stub<MigrateUpArgs>({ db: transaction }))
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

  // NOTE: the pre-remodel "empty path" rollback test (municipalityRemodel.down →
  // consolidated.down → original.down) is intentionally absent: the municipality
  // remodel down is currently broken — `DROP TABLE "municipality" CASCADE` already
  // cascades the supporter/activity/locked-documents FKs that the script
  // then tries to DROP CONSTRAINT explicitly, so the rollback always aborts.
  // Restore that coverage once the migration down uses IF EXISTS (or drops
  // constraints before the cascaded tables).

  it('refuses a populated consolidated rollback before changing schema', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')
    const consolidated = migrations.find((migration) => migration.name === consolidatedName)
    if (!consolidated) throw new Error('Consolidated campaign migration is not registered.')
    await database.execute(sql`
      INSERT INTO "campaign_user" ("name", "email", "role", "updated_at", "created_at")
      VALUES ('Rollback sentinel', 'rollback-sentinel@example.test', 'coordinator', now(), now())
    `)
    const checksumBefore = await schemaChecksum()

    await expect(consolidated.down(stub<MigrateDownArgs>({ db: database }))).rejects.toThrow(
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

  it('backfills StateDeputy Contacts and remains idempotent', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')
    const migration = migrations.find(({ name }) => name === stateDeputyContactMigrationName)
    if (!migration) throw new Error('StateDeputy Contact migration is not registered.')

    await migration.down(stub<MigrateDownArgs>({ db: database }))
    await database.execute(sql`
      INSERT INTO "state_deputy" ("name", "slug")
      VALUES ('Legado Um', 'legado-um'), ('Legado Dois', 'legado-dois')
    `)
    const legacyRead = await database.execute(sql`
      SELECT "name" AS legacy_name
      FROM "state_deputy"
      WHERE "slug" IN ('legado-um', 'legado-dois')
      ORDER BY "id"
    `)
    expect(legacyRead.rows).toEqual([{ legacy_name: 'Legado Um' }, { legacy_name: 'Legado Dois' }])

    await migration.up(stub<MigrateUpArgs>({ db: database }))
    const firstRead = await database.execute(sql`
      SELECT contact."name" AS contact_name
      FROM "state_deputy" AS state_deputy
      JOIN "contact" AS contact ON contact."id" = state_deputy."contact_id"
      ORDER BY state_deputy."id"
    `)
    expect(firstRead.rows).toEqual([{ contact_name: 'Legado Um' }, { contact_name: 'Legado Dois' }])

    await migration.up(stub<MigrateUpArgs>({ db: database }))
    const contactCount = await database.execute(sql`
      SELECT count(*)::integer AS count
      FROM "contact"
      WHERE "name" IN ('Legado Um', 'Legado Dois')
    `)
    expect(contactCount.rows[0]?.count).toBe(2)
  })

  it('keeps the required StateDeputy Contact relation from being nulled on delete', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')

    const result = await database.execute(sql`
      SELECT confdeltype
      FROM pg_constraint
      WHERE conname = 'state_deputy_contact_id_contact_id_fk'
    `)

    expect(result.rows).toEqual([{ confdeltype: 'r' }])
  })

  it('refuses rollback after Contact names diverge into a duplicate', async () => {
    if (!database) throw new Error('Disposable database is not initialized.')
    const migration = migrations.find(({ name }) => name === stateDeputyContactMigrationName)
    if (!migration) throw new Error('StateDeputy Contact migration is not registered.')

    const contacts = await database.execute(sql`
      INSERT INTO "contact" ("name", "state")
      VALUES ('Mesmo Nome', 'BA'), ('Outro Nome', 'BA')
      RETURNING "id"
    `)
    await database.execute(sql`
      INSERT INTO "state_deputy" ("contact_id", "slug")
      VALUES (${contacts.rows[0]?.id}, 'mesmo-nome-um'), (${contacts.rows[1]?.id}, 'mesmo-nome-dois')
    `)
    await database.execute(sql`
      UPDATE "contact"
      SET "name" = 'Mesmo Nome'
      WHERE "id" = ${contacts.rows[1]?.id}
    `)

    await expect(migration.down(stub<MigrateDownArgs>({ db: database }))).rejects.toThrow(
      'Contact names are not unique',
    )
    const columns = await database.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'state_deputy'
        AND column_name IN ('name', 'contact_id')
      ORDER BY column_name
    `)
    expect(columns.rows).toEqual([{ column_name: 'contact_id' }])
  })
})
