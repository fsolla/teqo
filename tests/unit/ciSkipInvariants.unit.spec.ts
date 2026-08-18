// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { checkTestLocations } from '../../scripts/check-test-locations.mjs'
import { E2E_AFFECTED_MANIFEST } from '../../scripts/lib/e2e-affected-manifest.mjs'
import {
  CANONICAL_E2E_SPEC_SUFFIX,
  CANONICAL_E2E_TEST_DIR,
  CANONICAL_INT_INCLUDE,
  CANONICAL_UNIT_INCLUDE,
  E2E_MANIFEST_DOMAIN_EXEMPT,
  findMisplacedSpecPaths,
  findUncoveredE2eDomainPrefixes,
  HIGH_RISK_EXACT,
  isBuildPath,
  isCanonicalSpecPath,
  isCodePath,
  isHighRisk,
  isMisplacedSpecPath,
  isSrcPath,
  isTestPath,
} from '../../scripts/lib/test-affected-core.mjs'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

describe('ciSkipInvariants', () => {
  it('exports shared path predicates used by classifiers and the lint guard', () => {
    expect(isSrcPath('src/lib/x.ts')).toBe(true)
    expect(isTestPath('tests/unit/x.unit.spec.ts')).toBe(true)
    expect(isCodePath('tsconfig.json')).toBe(true)
    expect(isBuildPath('public/favicon.ico')).toBe(true)
    expect(isHighRisk('src/migrations/x.ts')).toBe(true)
    expect(E2E_MANIFEST_DOMAIN_EXEMPT.has('shared')).toBe(true)
  })

  it('rejects misplaced *.spec|*.test files outside the three canonical trees', () => {
    expect(isCanonicalSpecPath('tests/unit/foo.unit.spec.ts')).toBe(true)
    expect(isCanonicalSpecPath('tests/unit/foo.unit.spec.tsx')).toBe(true)
    expect(isCanonicalSpecPath('tests/int/foo.int.spec.ts')).toBe(true)
    expect(isCanonicalSpecPath('tests/e2e/foo.e2e.spec.ts')).toBe(true)

    for (const path of [
      'src/utilities/foo.spec.ts',
      'scripts/bar.test.ts',
      'tests/unit/wrong.spec.ts',
      'tests/int/wrong.spec.ts',
      'tests/e2e/nested/foo.e2e.spec.ts',
      'foo.test.tsx',
    ]) {
      expect(isMisplacedSpecPath(path), path).toBe(true)
    }

    expect(findMisplacedSpecPaths(['tests/unit/ok.unit.spec.ts', 'src/x.spec.ts'])).toEqual([
      'src/x.spec.ts',
    ])
  })

  it('repo walk finds no misplaced specs (same check as the lint job)', () => {
    expect(checkTestLocations(repoRoot)).toEqual([])
  })

  it('vitest/playwright harness globs match the canonical constants', () => {
    const unitConfig = readFileSync(join(repoRoot, 'vitest.unit.config.mts'), 'utf8')
    const intConfig = readFileSync(join(repoRoot, 'vitest.config.mts'), 'utf8')
    const playwrightConfig = readFileSync(join(repoRoot, 'playwright.config.ts'), 'utf8')

    expect(unitConfig).toContain(`'${CANONICAL_UNIT_INCLUDE}'`)
    expect(intConfig).toContain(`'${CANONICAL_INT_INCLUDE}'`)
    expect(playwrightConfig).toContain(`'./${CANONICAL_E2E_TEST_DIR}'`)
    expect(CANONICAL_E2E_SPEC_SUFFIX).toBe('.e2e.spec.ts')
  })

  it('OPS62 X1: single sequential `checks` job with structural fail-fast', () => {
    for (const file of ['.forgejo/workflows/ci.yml', '.forgejo/workflows/ci-pr.yml']) {
      const source = readFileSync(join(repoRoot, file), 'utf8')
      // Exactly one job id `checks` — the status context automerge/branch
      // protection wait on. Fail-fast is structural: no siblings, no matrix,
      // no strategy fail-fast (anchored as YAML keys so comments can't trip).
      expect(source.match(/^jobs:\n  checks:\n/m) ?? [], file).toHaveLength(1)
      expect(source, file).not.toMatch(/^ {2,4}(?:matrix|fail-fast):/m)
      // e2e runs as one process with 4 workers (replaces the 2-shard matrix).
      expect(source, file).toContain('PLAYWRIGHT_WORKERS: 4')
      // Steps keep their own logs so diagnosis survives a failure.
      expect(source, file).toContain('name: Lint')
      expect(source, file).toContain('name: E2E tests')
    }

    const pr = readFileSync(join(repoRoot, '.forgejo/workflows/ci-pr.yml'), 'utf8')
    // Content guards fail before the suite (cheap, PR-scoped, fail fast).
    const guard = pr.indexOf('name: Changelog is append-only')
    const lint = pr.indexOf('name: Lint')
    const e2e = pr.indexOf('name: E2E tests (full suite')
    expect(guard).toBeGreaterThan(-1)
    expect(lint).toBeGreaterThan(guard)
    expect(e2e).toBeGreaterThan(lint)
    // ci-pr never runs on the host (OPS53 pin).
    expect(pr).not.toContain('runs-on: host')
    // The skip wiring is the critical piece: losing the `scope` step id or
    // the e2e gate silently skips the suite with a green run (the opposite
    // of the fail-fast this delivery sells).
    expect(pr).toMatch(/id: scope\n/)
    expect(pr).toMatch(/if: steps\.scope\.outputs\.e2e_mode == 'full'/)

    // main keeps the deploy gated on the checks job (OPS53) — anchored as a
    // YAML key so the header comment cannot satisfy the pin.
    const main = readFileSync(join(repoRoot, '.forgejo/workflows/ci.yml'), 'utf8')
    expect(main).toMatch(/^    needs: \[checks\]\n/m)
  })

  it('OPS62 X1: services are reached by name on the job network (no host ports)', () => {
    // Forgejo 9 does not expand expressions in `services.ports` (measured
    // live: run 730 failed 1s with the literal port string) and a fixed host
    // port would collide between concurrent runs — the single long-lived job
    // holds its services for the whole run. Pinned: DNS by name, no ports.
    for (const file of ['.forgejo/workflows/ci.yml', '.forgejo/workflows/ci-pr.yml']) {
      const source = readFileSync(join(repoRoot, file), 'utf8')
      expect(source, file).toContain('@postgres-int:5432/teqo_test')
      expect(source, file).toContain('@postgres-build:5432/teqo_test')
      expect(source, file).not.toMatch(/^ {6}ports:\n/m)
    }
  })

  it('keeps local e2e build artifacts outside the development dist directory', () => {
    for (const file of [
      '.forgejo/workflows/ci.yml',
      '.forgejo/workflows/ci-pr.yml',
      '.gitignore',
      '.prettierignore',
      'eslint.config.mjs',
      'playwright.config.ts',
      'scripts/run-e2e-affected.mjs',
      'tsconfig.json',
    ]) {
      const source = readFileSync(join(repoRoot, file), 'utf8')
      expect(source, file).not.toContain('.next/e2e')
      expect(source, file).toContain('.next-e2e')
    }
  })

  it('skip classifiers and invariant specs are high-risk (force full suite)', () => {
    for (const path of [
      'scripts/lib/test-affected-core.mjs',
      'scripts/ci-scope.mjs',
      'scripts/check-test-locations.mjs',
      'scripts/check-plans-only-pr-closes.mjs',
      'scripts/lib/plansOnlyClosesGuard.mjs',
      'scripts/test-affected.mjs',
      'scripts/e2e-affected.mjs',
      'tests/unit/ciSkipInvariants.unit.spec.ts',
      'tests/unit/testAffected.unit.spec.ts',
    ]) {
      expect(HIGH_RISK_EXACT.has(path), path).toBe(true)
    }
  })

  it('every campaign domain dir is covered by the e2e affected manifest', () => {
    const componentDirs = readdirSync(join(repoRoot, 'src/components/campaign'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const appRouteDirs = readdirSync(join(repoRoot, 'src/app/(campaign)/campanha/(app)'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const { missing } = findUncoveredE2eDomainPrefixes(
      componentDirs,
      appRouteDirs,
      E2E_AFFECTED_MANIFEST,
    )
    expect(missing, `unmapped domains:\n${missing.join('\n')}`).toEqual([])
  })
})
