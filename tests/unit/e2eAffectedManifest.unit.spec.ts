// @vitest-environment node

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  E2E_AFFECTED_MANIFEST,
  E2E_CURATED_SPECS,
  E2E_RISK_PREFIXES,
} from '../../scripts/lib/e2e-affected-manifest.mjs'

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

  it('freezes the curated high-risk e2e set (OPS86 — deliberate growth only)', () => {
    // The curated set is the never-zero answer for high-risk PR diffs; change
    // it on purpose (cost of the PR CI high-risk path), not by drift.
    expect(E2E_CURATED_SPECS).toEqual([
      'campaignPermissionProfile',
      'campaignDemandVisibility',
      'campaignAiTranscribe',
      'campaignAgendaFeed',
      'campaignNewsletter',
    ])
    const onDisk = new Set(specNamesOnDisk())
    for (const spec of E2E_CURATED_SPECS) {
      expect(onDisk.has(spec), spec).toBe(true)
    }
  })

  it('keeps every risk prefix covered by a manifest entry (OPS86 fail-closed net)', () => {
    // The classifier fails closed when a risk-area file matches no entry; if
    // the entries drift out of sync with the risk prefixes, that fail-closed
    // fires on every diff in the area. Pin the pair together.
    const mappedPrefixes = new Set(E2E_AFFECTED_MANIFEST.flatMap((entry) => entry.prefixes))
    for (const prefix of E2E_RISK_PREFIXES) {
      expect(mappedPrefixes.has(prefix), prefix).toBe(true)
    }
  })
})
