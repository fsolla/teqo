import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'

// Miss #73 (2026-07-31): int specs pinning seeded municipality slugs
// (`getMunicipality('cairu')` et al.) and mutating them deadlocked
// `municipality_rels` under the parallel suite (Postgres 40P01), and e2e specs
// deep-linking `?municipio=cairu` raced the same row from two workers. The
// allocator (`getMunicipality()` / `claimMunicipality()`, Postgres sequence)
// hands out a unique row per claim; pinning is what breaks the contract.
//
// Rule 3 is the literal-regex sibling of the anchored-template guard (P3-C):
// `new RegExp(\`…\`)` was hardened there, but `/Cairu/i` literals dodged it —
// and catalog names are not prefix-unique (Conde/Condeúba, Barra ×4, Laje ×3).

const repoRoot = process.cwd()
const repoPath = (absolute: string) => relative(repoRoot, absolute)

const walkFiles = (root: string, extensions: readonly string[]): string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => resolve(entry.parentPath, entry.name))

const specFiles = [
  ...walkFiles(resolve(repoRoot, 'tests/int'), ['.ts']),
  ...walkFiles(resolve(repoRoot, 'tests/e2e'), ['.ts']),
]

/** `getMunicipality(…)` called with a non-empty argument (a pinned slug). */
const FIXED_SLUG_CALL = /\bgetMunicipality\s*\(\s*[^)\s]/

const MUTATION_PATTERN = new RegExp(
  [
    '\\b(?:assignMunicipalityAdvisors(?:Record)?|touchMunicipality|createLeadership|createVotePledge|createCampaignDemand|createMunicipalityUpdate|setStateDeputyMunicipalitiesBatchRecord)\\s*\\(',
    'payload\\.update\\(\\s*\\{\\s*collection:\\s*[\'"]municipality[\'"]',
  ].join('|'),
)

describe('municipality allocator discipline (miss #73)', () => {
  it('never pins a fixed-slug municipality in a spec that mutates municipalities', () => {
    const offenders: string[] = []

    for (const file of specFiles) {
      const source = readFileSync(file, 'utf8')
      if (!FIXED_SLUG_CALL.test(source)) continue
      if (!MUTATION_PATTERN.test(source)) continue
      offenders.push(repoPath(file))
    }

    expect(
      offenders,
      'allocate with getMunicipality() (no slug) — read-only catalog lookups belong to getMunicipalityCatalogEntry',
    ).toEqual([])
  })

  it('never deep-links a hardcoded municipality slug in e2e specs', () => {
    const offenders: string[] = []

    for (const file of walkFiles(resolve(repoRoot, 'tests/e2e'), ['.ts'])) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (/municipio=[a-z0-9-]/.test(line)) offenders.push(`${repoPath(file)}:${index + 1}`)
      }
    }

    expect(offenders, 'interpolate claimMunicipality().slug into wizard deep links').toEqual([])
  })

  it('anchors e2e name regexes that mention a catalog municipality', () => {
    const offenders: string[] = []
    const nameLiteral = /name:\s*\/([^/\n]+)\/i?\b/g
    const catalogNames = municipalityCatalog
      .map((entry) => entry.name)
      .filter((name) => name.length >= 4)

    for (const file of walkFiles(resolve(repoRoot, 'tests/e2e'), ['.ts'])) {
      const source = readFileSync(file, 'utf8')
      nameLiteral.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = nameLiteral.exec(source)) !== null) {
        const pattern = match[1]!
        if (pattern.startsWith('^')) continue
        const hit = catalogNames.find((name) => pattern.toLowerCase().includes(name.toLowerCase()))
        if (hit) {
          const line = source.slice(0, match.index).split('\n').length
          offenders.push(`${repoPath(file)}:${line} (unanchored, matches "${hit}")`)
        }
      }
    }

    expect(
      offenders,
      'anchor with ^ (or locate by href) — catalog names are not prefix-unique',
    ).toEqual([])
  })

  it('routes every claim through the shared allocator module (OPS46)', () => {
    // The claims registry (campaignMunicipalityAllocator.ts) is what makes the
    // purge-on-claim contract safe after the sequence wraps; a direct
    // nextval/sequence reference anywhere else reintroduces the collision it
    // exists to prevent.
    const offenders: string[] = []
    const allocatorModule = repoPath(
      resolve(repoRoot, 'tests/helpers/campaignMunicipalityAllocator.ts'),
    )
    const scanned = [
      ...specFiles,
      ...walkFiles(resolve(repoRoot, 'tests/helpers'), ['.ts']),
    ].filter((file) => repoPath(file) !== allocatorModule)

    for (const file of scanned) {
      const source = readFileSync(file, 'utf8')
      if (/nextval\(|campaign_fixture_municipality_alloc/.test(source)) {
        offenders.push(repoPath(file))
      }
    }

    expect(
      offenders,
      'claim through claimMunicipalityIndex — direct sequence access bypasses the claims registry',
    ).toEqual([])
  })
})
