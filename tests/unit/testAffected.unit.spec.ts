// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  E2E_CURATED_SPECS,
  E2E_SMOKE_FALLBACK_SPEC,
} from '../../scripts/lib/e2e-affected-manifest.mjs'
import {
  classifyBuildScope,
  classifyStaticScope,
  classifyTestScope,
  HIGH_RISK_EXACT,
  HIGH_RISK_PREFIXES,
  selectE2eSpecs,
} from '../../scripts/lib/test-affected-core.mjs'

const changed = (path: string) => ({ path, status: 'M' })

describe('classifyTestScope (OPS5)', () => {
  it('runs the full suite when a high-risk path changes', () => {
    for (const path of [
      'src/migrations/20260730_000000_x.ts',
      'src/payload-types.ts',
      'pnpm-lock.yaml',
      'src/collections/Post.ts',
      'scripts/lib/seed-minimal-manifest.mjs',
      'scripts/worktree.mjs',
      'scripts/lib/test-affected-core.mjs',
      'tests/helpers/campaignFixtures.ts',
      'tests/unit/ciSkipInvariants.unit.spec.ts',
    ]) {
      expect(classifyTestScope([changed(path)]).mode, path).toBe('full')
    }
  })

  it('runs the full suite when a new src file appears', () => {
    expect(classifyTestScope([{ path: 'src/utilities/newThing.ts', status: 'A' }]).mode).toBe(
      'full',
    )
  })

  it('selects vitest --changed for a plain src/tests diff', () => {
    expect(classifyTestScope([changed('src/utilities/posts.ts')]).mode).toBe('changed')
    expect(classifyTestScope([changed('tests/int/api.int.spec.ts')]).mode).toBe('changed')
  })

  it('skips tests for a docs-only diff', () => {
    expect(classifyTestScope([changed('docs/AGENT-OPS.md'), changed('README.md')]).mode).toBe(
      'none',
    )
  })

  it('high-risk lists cover the harness files the CI relies on', () => {
    expect(HIGH_RISK_EXACT.has('vitest.config.mts')).toBe(true)
    expect(HIGH_RISK_EXACT.has('playwright.config.ts')).toBe(true)
    expect(HIGH_RISK_PREFIXES).toContain('tests/e2e/fixtures/')
  })
})

describe('classifyStaticScope', () => {
  it('runs for src/tests and type/graph config diffs', () => {
    expect(classifyStaticScope([changed('src/lib/foo.ts')]).mode).toBe('code')
    expect(classifyStaticScope([changed('tsconfig.json')]).mode).toBe('code')
    expect(classifyStaticScope([changed('package.json')]).mode).toBe('code')
    expect(classifyStaticScope([changed('eslint.config.mjs')]).mode).toBe('code')
  })

  it('skips for docs-only diffs', () => {
    expect(classifyStaticScope([changed('docs/AGENT-OPS.md')]).mode).toBe('none')
  })
})

describe('classifyBuildScope', () => {
  it('runs for build surface diffs', () => {
    expect(classifyBuildScope([changed('src/app/(frontend)/page.tsx')]).mode).toBe('build')
    expect(classifyBuildScope([changed('public/favicon.ico')]).mode).toBe('build')
    expect(classifyBuildScope([changed('next.config.mjs')]).mode).toBe('build')
    expect(classifyBuildScope([changed('package.json')]).mode).toBe('build')
  })

  it('skips for docs-only diffs', () => {
    expect(classifyBuildScope([changed('docs/AGENT-OPS.md')]).mode).toBe('none')
  })
})

describe('selectE2eSpecs (OPS5)', () => {
  const manifest = [
    { prefixes: ['src/components/campaign/municipality'], specs: ['campaignMunicipalities'] },
    { prefixes: ['src/app/(payload)'], specs: ['admin'] },
  ]

  it('maps src prefixes to specs via the manifest', () => {
    const result = selectE2eSpecs(
      [changed('src/components/campaign/municipality/MunicipalityTable.tsx')],
      manifest,
    )
    expect(result).toMatchObject({ mode: 'selected', specs: ['campaignMunicipalities'] })
  })

  it('runs a changed e2e spec directly', () => {
    const result = selectE2eSpecs([changed('tests/e2e/campaignAuth.e2e.spec.ts')], manifest)
    expect(result.mode).toBe('selected')
    expect(result.specs).toContain('campaignAuth')
  })

  it('skips deleted e2e specs (they cannot run)', () => {
    const result = selectE2eSpecs(
      [{ path: 'tests/e2e/campaignTerritories.e2e.spec.ts', status: 'D' }],
      manifest,
    )
    expect(result).toMatchObject({ mode: 'none', specs: [], unmapped: [] })
  })

  it('still maps deleted src files through the manifest', () => {
    const result = selectE2eSpecs(
      [{ path: 'src/components/campaign/municipality/MunicipalityTable.tsx', status: 'D' }],
      manifest,
    )
    expect(result).toMatchObject({ mode: 'selected', specs: ['campaignMunicipalities'] })
  })

  it('runs the curated e2e cross-section on high-risk paths (never zero, OPS86)', () => {
    for (const path of ['tests/e2e/fixtures/auth.ts', 'src/migrations/x.ts']) {
      const result = selectE2eSpecs([changed(path)], manifest)
      expect(result.mode, path).toBe('curated')
      expect(result.specs).toEqual(E2E_CURATED_SPECS)
      expect(result.unmapped).toEqual([])
    }
  })

  it('reports unmapped risk-area files even when a high-risk path wins (OPS86+)', () => {
    const result = selectE2eSpecs(
      [changed('src/migrations/x.ts'), changed('src/utilities/access/brandNewPolicy.ts')],
      manifest,
    )
    expect(result.mode).toBe('curated')
    expect(result.specs).toEqual(E2E_CURATED_SPECS)
    expect(result.unmapped).toEqual(['src/utilities/access/brandNewPolicy.ts'])
    expect(result.reason).toContain('curated + risk files without mapping')
  })

  it('wakes the home smoke for unmapped non-risk src files (never zero, OPS86)', () => {
    const result = selectE2eSpecs([changed('src/utilities/brandNewModule.ts')], manifest)
    expect(result.mode).toBe('selected')
    expect(result.specs).toEqual([E2E_SMOKE_FALLBACK_SPEC])
    expect(result.unmapped).toEqual(['src/utilities/brandNewModule.ts'])
  })

  it('fails closed (unmapped-risk) for risk-area files without a manifest entry', () => {
    const result = selectE2eSpecs([changed('src/utilities/access/brandNewPolicy.ts')], manifest)
    expect(result.mode).toBe('unmapped-risk')
    expect(result.specs).toEqual([])
    expect(result.unmapped).toEqual(['src/utilities/access/brandNewPolicy.ts'])
  })

  it('fails closed even when other specs would run (risk file is uncovered)', () => {
    const result = selectE2eSpecs(
      [
        changed('src/components/campaign/municipality/MunicipalityTable.tsx'),
        changed('src/lib/schemas/brandNewForm.ts'),
      ],
      manifest,
    )
    expect(result.mode).toBe('unmapped-risk')
    expect(result.unmapped).toEqual(['src/lib/schemas/brandNewForm.ts'])
  })

  it('skips e2e for diffs with no src/e2e changes', () => {
    const result = selectE2eSpecs([changed('docs/AGENT-OPS.md')], manifest)
    expect(result).toMatchObject({ mode: 'none', specs: [], unmapped: [] })
  })

  it('drops a setup-only selection (setup runs only in dev mode, OPS39)', () => {
    const result = selectE2eSpecs([changed('tests/e2e/setup.e2e.spec.ts')], manifest)
    expect(result).toMatchObject({ mode: 'none', specs: [], unmapped: [] })
    expect(result.reason).toContain('dev-mode-only')
  })

  it('keeps setup in a mixed selection (it matches no project, harmless)', () => {
    const result = selectE2eSpecs(
      [changed('tests/e2e/setup.e2e.spec.ts'), changed('src/app/(payload)/api/x.ts')],
      manifest,
    )
    expect(result.mode).toBe('selected')
    expect(result.specs).toContain('setup')
    expect(result.specs).toContain('admin')
  })
})
