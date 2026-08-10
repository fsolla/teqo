// @vitest-environment node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  classifyBuildScope,
  classifyStaticScope,
  classifyTestScope,
  e2eShardConfig,
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

  it('runs the full suite on high-risk paths', () => {
    expect(selectE2eSpecs([changed('tests/e2e/fixtures/auth.ts')], manifest).mode).toBe('full')
    expect(selectE2eSpecs([changed('src/migrations/x.ts')], manifest).mode).toBe('full')
  })

  it('reports unmapped src paths without failing and skips the run', () => {
    const result = selectE2eSpecs([changed('src/utilities/brandNewModule.ts')], manifest)
    expect(result.mode).toBe('none')
    expect(result.unmapped).toEqual(['src/utilities/brandNewModule.ts'])
  })

  it('skips e2e for diffs with no src/e2e changes', () => {
    const result = selectE2eSpecs([changed('docs/AGENT-OPS.md')], manifest)
    expect(result).toMatchObject({ mode: 'none', specs: [], unmapped: [] })
  })
})

describe('e2eShardConfig (OPS34)', () => {
  it('splits the full suite across 2 shards', () => {
    expect(e2eShardConfig('full')).toEqual({ matrix: [1, 2], total: 2 })
  })

  it('keeps selected and skipped runs on a single runner', () => {
    expect(e2eShardConfig('selected')).toEqual({ matrix: [1], total: 1 })
    expect(e2eShardConfig('none')).toEqual({ matrix: [1], total: 1 })
  })

  it('pins the ci.yml matrix literal against the single source', () => {
    const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')
    const { matrix } = e2eShardConfig('full')
    expect(workflow).toContain(`shard: [${matrix.join(', ')}]`)
  })
})
