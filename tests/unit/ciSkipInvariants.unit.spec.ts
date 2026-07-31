// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { E2E_AFFECTED_MANIFEST } from '../../scripts/lib/e2e-affected-manifest.mjs'
import {
  CANONICAL_E2E_SPEC_SUFFIX,
  CANONICAL_E2E_TEST_DIR,
  CANONICAL_INT_INCLUDE,
  CANONICAL_UNIT_INCLUDE,
  findMisplacedSpecPaths,
  findUncoveredE2eDomainPrefixes,
  HIGH_RISK_EXACT,
  isCanonicalSpecPath,
  isMisplacedSpecPath,
} from '../../scripts/lib/test-affected-core.mjs'
import { checkTestLocations } from '../../scripts/check-test-locations.mjs'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

describe('ciSkipInvariants', () => {
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

  it('skip classifiers and invariant specs are high-risk (force full suite)', () => {
    for (const path of [
      'scripts/lib/test-affected-core.mjs',
      'scripts/ci-scope.mjs',
      'scripts/check-test-locations.mjs',
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
