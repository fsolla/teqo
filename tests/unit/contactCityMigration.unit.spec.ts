// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../src/migrations/20260718_010733_consolidate_campaign_schema.ts', import.meta.url),
  'utf8',
)

describe('Contact nullable fields in the consolidated migration', () => {
  it('creates the final nullable email and city schema directly', () => {
    expect(migration).toContain('ALTER TABLE "contact" ALTER COLUMN "email" DROP NOT NULL')
    expect(migration).toContain('ALTER TABLE "contact" ALTER COLUMN "city" DROP NOT NULL')
    expect(migration).toContain('ALTER TABLE "contact" ADD COLUMN "gender" "enum_contact_gender"')
  })

  it('refuses rollback before restoring required contact columns', () => {
    const down = migration.indexOf('export async function down')
    const guard = migration.indexOf(
      '"email" IS NULL OR "city" IS NULL OR "gender" IS NOT NULL',
      down,
    )
    const mutation = migration.indexOf(
      'ALTER TABLE "contact" ALTER COLUMN "email" SET NOT NULL',
      down,
    )

    expect(guard).toBeGreaterThan(down)
    expect(mutation).toBeGreaterThan(guard)
  })
})
