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

  it('keeps local e2e build artifacts outside the development dist directory', () => {
    for (const file of [
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
      'scripts/run-e2e-affected.mjs',
      'scripts/vitest-changed-or-full.mjs',
      'tests/unit/ciSkipInvariants.unit.spec.ts',
      'tests/unit/testAffected.unit.spec.ts',
    ]) {
      expect(HIGH_RISK_EXACT.has(path), path).toBe(true)
    }
  })

  it('deploy is manual-only — never a push/schedule trigger (OPS71)', () => {
    const deploy = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8')
    expect(deploy).toContain('workflow_dispatch:')
    expect(deploy).not.toMatch(/^\s*push:/m)
    expect(deploy).not.toMatch(/^\s*schedule:/m)

    // The OPS65 production-change gate died with the Forgejo ci.yml: the
    // manual dispatch always runs the full suite (verify) before deploy, so
    // no PR workflow may reference the removed classifier.
    const ciPr = readFileSync(join(repoRoot, '.github/workflows/ci-pr.yml'), 'utf8')
    expect(ciPr).not.toContain('ci-classify-production.mjs')
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

  it('ci-pr wires the OPS86 never-zero fallbacks (curated e2e, unmapped-risk fail, changed-or-full)', () => {
    // The fail-closed behavior IS the workflow wiring — pin it like the
    // other CI contracts in this file.
    const ciPr = readFileSync(join(repoRoot, '.github/workflows/ci-pr.yml'), 'utf8')
    expect(ciPr).toContain("e2e_mode == 'selected' || steps.scope.outputs.e2e_mode == 'curated'")
    expect(ciPr).toContain("e2e_mode == 'unmapped-risk'")
    expect(ciPr).toContain('vitest-changed-or-full.mjs')
    // The PR never runs e2e full.
    expect(ciPr).not.toContain("e2e_mode == 'full'")
  })

  it('vitest-changed-or-full mirrors the package.json test scripts (config + unit DB guard)', () => {
    // The wrapper re-declares the vitest config paths and the unit
    // invalid-DATABASE_URL guard from the `test:unit`/`test:int` scripts; a
    // drift changes what `--changed` detects and is silent. Pin the sync.
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const wrapper = readFileSync(join(repoRoot, 'scripts/vitest-changed-or-full.mjs'), 'utf8')

    expect(pkg.scripts['test:unit']).toContain('./vitest.unit.config.mts')
    expect(pkg.scripts['test:int']).toContain('./vitest.config.mts')
    expect(wrapper).toContain('./vitest.unit.config.mts')
    expect(wrapper).toContain('./vitest.config.mts')

    const invalidUnitDbUrl = 'postgresql://invalid:invalid@127.0.0.1:1/unit_tests_must_not_connect'
    expect(pkg.scripts['test:unit']).toContain(invalidUnitDbUrl)
    expect(wrapper).toContain(invalidUnitDbUrl)
  })
})
