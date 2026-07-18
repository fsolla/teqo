// @vitest-environment node

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const migrationSource = (name: string): string =>
  readFileSync(new URL(`../../src/migrations/${name}.ts`, import.meta.url), 'utf8')

describe('campaign migration rollback safety', () => {
  const consolidatedName = '20260718_010733_consolidate_campaign_schema'

  it('keeps the committed campaign-user migration byte-identical to HEAD', () => {
    const source = migrationSource('20260716_010420_add_campaign_user')
    const headSource = execFileSync(
      'git',
      ['show', 'HEAD:src/migrations/20260716_010420_add_campaign_user.ts'],
      { encoding: 'utf8' },
    )

    expect(createHash('sha256').update(source).digest('hex')).toBe(
      'cb1e897e41ecb30145d2183b8153941fc747888cee0b296697854ba1aa48f14b',
    )
    expect(source).toBe(headSource)
  })

  it('validates an existing final schema and refuses every partial mismatch', () => {
    const source = migrationSource(consolidatedName)
    expect(source).toContain("('campaign_user', 'email')")
    expect(source).toContain("('contact', 'email')")
    expect(source).toContain("('contact', 'city')")
    expect(source).toContain("'foreign-key|'")
    expect(source).toContain('confupdtype')
    expect(source).toContain('confdeltype')
    expect(source).toContain('existingSchema.featureCount > 0')
    expect(source).toContain('await assertFinalSchema(db)')
    expect(source.indexOf('await assertFinalSchema(db)')).toBeLessThan(
      source.indexOf('CREATE TYPE "public"."enum_campaign_user_role"'),
    )
  })

  it('backfills committed campaign users before creating final auth indexes', () => {
    const source = migrationSource(consolidatedName)
    expect(source.indexOf('UPDATE "campaign_user" SET "role" = \'geral\'')).toBeLessThan(
      source.indexOf('CREATE UNIQUE INDEX "campaign_user_username_idx"'),
    )
  })

  it('guards the consolidated rollback before its first schema mutation', () => {
    const source = migrationSource(consolidatedName)
    const down = source.indexOf('export async function down')
    const guard = source.indexOf('Refusing to roll back consolidated campaign schema', down)
    const destructive = source.indexOf(
      'DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_invite_fk"',
      down,
    )

    expect(guard).toBeGreaterThan(down)
    expect(destructive).toBeGreaterThan(guard)
  })

  it('leaves compatibility constraints for the immutable original rollback', () => {
    const source = migrationSource(consolidatedName)
    const down = source.indexOf('export async function down')
    const compatibilityConstraint = source.indexOf(
      'FOREIGN KEY ("campaign_user_id") REFERENCES "public"."users"("id")',
      down,
    )

    expect(compatibilityConstraint).toBeGreaterThan(down)
  })
})
