// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../src/migrations/20260802_230000_strip_engagement_reversal_signals.ts',
    import.meta.url,
  ),
  'utf8',
)

describe('strip engagement reversal signals migration (B134)', () => {
  it('removes reversalSignals only from movimento snapshots', () => {
    expect(migration).toContain("snapshot = snapshot - 'reversalSignals'")
    expect(migration).toContain("outcome = 'movimento'")
    expect(migration).toContain("snapshot ? 'reversalSignals'")
    expect(migration).toContain('GET DIAGNOSTICS affected = ROW_COUNT')
  })

  it('does not attempt to restore dropped data on down', () => {
    const down = migration.indexOf('export async function down')
    expect(migration.indexOf('reversalSignals', down)).toBe(-1)
  })
})
