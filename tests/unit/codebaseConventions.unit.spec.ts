import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  legacyCamelCaseFilenameIgnores,
  legacyComponentFilenameIgnores,
  legacyComponentSyntaxIgnores,
  legacyFrameworkExportIgnores,
} from '../../eslint-legacy-ignores.mjs'

// Programmatic guards for conventions that used to be enforced only by prose
// (codebase-map.mdc / docs/ARCHITECTURE.md) and drifted during Pass 2.

const repoRoot = process.cwd()

const walkSourceFiles = (root: string, extensions: readonly string[]): string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => resolve(entry.parentPath, entry.name))

const repoPath = (absolute: string) => relative(repoRoot, absolute)

describe('server-only boundary in src/utilities', () => {
  // Files that value-import Payload run server code; if they ever land in a
  // client bundle the failure must be a build error, not a runtime surprise.
  // W2 marked 21 loaders by hand — this pins the rule for every new module.
  // Deliberate exceptions go here, each with a justification:
  const allowlist = new Set<string>([])

  const isTypeOnlyClause = (clause: string): boolean => {
    if (/^type\b/.test(clause.trim())) return true
    const inner = clause.trim().match(/^\{([\s\S]*)\}$/)?.[1]
    if (inner === undefined) return false
    return inner
      .split(',')
      .map((specifier) => specifier.trim())
      .filter(Boolean)
      .every((specifier) => specifier.startsWith('type '))
  }

  it('marks every Payload-coupled utilities module with import server-only', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/utilities'), ['.ts', '.tsx'])) {
      const source = readFileSync(file, 'utf8')
      // Side-effect imports (`import 'x'`) never match: the clause group
      // cannot contain quotes, so it cannot swallow a bare specifier.
      const importsPayloadValues = [
        ...source.matchAll(/^import\s+([^'"]+?)\s+from\s+['"](payload|@payload-config)['"]/gm),
      ].some(([, clause]) => !isTypeOnlyClause(clause!))

      if (!importsPayloadValues) continue
      if (/^import 'server-only'/m.test(source)) continue
      if (allowlist.has(repoPath(file))) continue
      offenders.push(repoPath(file))
    }

    expect(offenders, "add `import 'server-only'` (or a justified allowlist entry)").toEqual([])
  })
})

describe('banned campaign terminology', () => {
  // "Praça"/"Núcleo" were replaced by "Município" (2026-07-23 remodel; W4f
  // swept the copy). The manual sweep still missed 4 consent drafts — this
  // keeps the invariant self-enforcing. Migrations are frozen history and
  // stay out of scope. Allowlisted files carry legitimate data, not copy:
  const allowlist = new Set<string>([
    'src/lib/cities.ts', // real locality names (e.g. "Núcleo Bandeirante" — DF)
  ])

  it('keeps Praça/Núcleo out of src (data catalogs allowlisted)', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src'), ['.ts', '.tsx'])) {
      const path = repoPath(file)
      if (path.startsWith('src/migrations/')) continue
      if (allowlist.has(path)) continue

      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (/praç|núcleo/i.test(line)) offenders.push(`${path}:${index + 1}`)
      }
    }

    expect(offenders, 'use "Município" (or allowlist genuine data)').toEqual([])
  })
})

describe('eslint legacy ignore lists', () => {
  // ESLint never validates ignore paths, so a file move silently orphans its
  // exemption (campaign-logo.tsx broke this way during Pass 2 W2).
  const unescapeGlob = (pattern: string) => pattern.replaceAll('\\[', '[').replaceAll('\\]', ']')

  it.each([
    ['legacyComponentFilenameIgnores', legacyComponentFilenameIgnores],
    ['legacyFrameworkExportIgnores', legacyFrameworkExportIgnores],
    ['legacyComponentSyntaxIgnores', legacyComponentSyntaxIgnores],
    ['legacyCamelCaseFilenameIgnores', legacyCamelCaseFilenameIgnores],
  ])('every %s entry still exists on disk', (_name, entries) => {
    const missing = entries.filter((entry) => !existsSync(resolve(repoRoot, unescapeGlob(entry))))
    expect(missing, 'file moved or deleted — update eslint-legacy-ignores.mjs').toEqual([])
  })
})

describe('campaign formActions convention', () => {
  // Every route-level formActions.ts goes through the shared wrappers
  // (runCampaignFormAction / runCampaignRedirectFormAction) so error mapping
  // and revalidation cannot drift per route (Pass 2 W4d). A file that truly
  // cannot use them gets an allowlist entry documenting why:
  const allowlist = new Set<string>([])

  it('routes every formActions.ts through a shared wrapper', () => {
    const offenders = walkSourceFiles(resolve(repoRoot, 'src/app/(campaign)'), ['.ts'])
      .filter((file) => file.endsWith('/formActions.ts'))
      .map(repoPath)
      .filter((path) => !allowlist.has(path))
      .filter(
        (path) =>
          !/runCampaign(Redirect)?FormAction/.test(readFileSync(resolve(repoRoot, path), 'utf8')),
      )

    expect(offenders, 'wrap with runCampaignFormAction/runCampaignRedirectFormAction').toEqual([])
  })
})
