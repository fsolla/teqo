import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pass 4 (2026-07-31): the four public globals spelled `update` as
// `({ req: { user } }) => Boolean(user)` — "any authenticated user" — and
// campaign JWTs authenticate against `/api/*`, so a campaign session (leader
// included) could PATCH the public site's settings, home, metadata and privacy
// policy. The lockdown is `payloadAdminOnly`; this guard keeps the
// any-authenticated shape out of global update access for good. Collections
// are covered elsewhere (every collection declares access; lockdown pins live
// in `collectionAccessLockdown.int.spec.ts`).
describe('global update access lockdown (Pass 4)', () => {
  const globalsRoot = resolve(process.cwd(), 'src/globals')

  it('never spells global update access as "any authenticated user"', () => {
    const offenders: string[] = []

    for (const entry of readdirSync(globalsRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
      const source = readFileSync(resolve(entry.parentPath, entry.name), 'utf8')
      if (/=>\s*Boolean\(user\)/.test(source)) offenders.push(entry.name)
    }

    expect(
      offenders,
      'global update access must name a policy (payloadAdminOnly, isPayloadAdmin…), not Boolean(user)',
    ).toEqual([])
  })
})
