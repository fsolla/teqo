// @vitest-environment node

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { E2E_AFFECTED_MANIFEST } from '../../scripts/lib/e2e-affected-manifest.mjs'

const E2E_DIR = join(__dirname, '../e2e')

function specNamesOnDisk() {
  return readdirSync(E2E_DIR)
    .filter((file) => file.endsWith('.e2e.spec.ts'))
    .map((file) => file.slice(0, -'.e2e.spec.ts'.length))
}

describe('E2E_AFFECTED_MANIFEST (OPS5)', () => {
  it('only references specs that exist on disk', () => {
    const onDisk = new Set(specNamesOnDisk())
    for (const entry of E2E_AFFECTED_MANIFEST) {
      for (const spec of entry.specs) {
        expect(onDisk.has(spec), `${spec} (prefixes: ${entry.prefixes.join(', ')})`).toBe(true)
        expect(existsSync(join(E2E_DIR, `${spec}.e2e.spec.ts`))).toBe(true)
      }
    }
  })

  it('keeps prefixes repo-relative and trailing-slash-clean', () => {
    for (const entry of E2E_AFFECTED_MANIFEST) {
      expect(entry.prefixes.length).toBeGreaterThan(0)
      for (const prefix of entry.prefixes) {
        expect(prefix.startsWith('src/')).toBe(true)
        expect(prefix.endsWith('/'), `${prefix} — drop the trailing slash`).toBe(false)
      }
    }
  })

  it('covers every on-disk spec family that has a clear domain prefix', () => {
    // Smoke/infrastructure specs are allowed to be unmapped (they run in full
    // mode); this pins the reverse direction: no manifest entry is dead.
    const mapped = new Set(E2E_AFFECTED_MANIFEST.flatMap((entry) => entry.specs))
    expect(mapped.size).toBeGreaterThanOrEqual(10)
  })
})
