// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  checkTestLocations,
  collectRepoRelativeFiles,
} from '../../scripts/check-test-locations.mjs'
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
  SCRIPTS_SPEC_PINNED,
} from '../../scripts/lib/test-affected-core.mjs'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

/** YAML with comment-only lines stripped — header prose must never satisfy a pin. */
const readWorkflow = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')

/** Unit/int spec files — the surface whose imports pin `scripts/**` modules. */
const specFiles = (): string[] =>
  collectRepoRelativeFiles().filter(
    (path) =>
      (path.startsWith('tests/unit/') && /\.unit\.spec\.tsx?$/.test(path)) ||
      (path.startsWith('tests/int/') && path.endsWith('.int.spec.ts')),
  )

/** Relative-import edges only — bare/alias imports cannot reach scripts/. */
const STATIC_IMPORT_RE = /(?:from|import)\s*(?:\(\s*)?['"](\.[^'"]+)['"]/g

const resolveRelativeImport = (specifier: string, fromDir: string): string | null => {
  for (const candidate of [
    specifier,
    `${specifier}.mjs`,
    `${specifier}.ts`,
    `${specifier}.tsx`,
    `${specifier}.js`,
  ]) {
    const full = join(fromDir, candidate)
    if (existsSync(full)) return full
  }
  return null
}

/**
 * Transitive `scripts/**` closure from `roots` (repo-relative spec paths).
 * Every relative edge is followed; only `scripts/**` nodes are collected, so a
 * spec reaching a lib through `tests/helpers` or `src/` is still pinned.
 */
const scriptsClosure = (roots: string[]): Set<string> => {
  const closure = new Set<string>()
  const visited = new Set<string>()
  const queue = roots.map((path) => join(repoRoot, path))
  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || visited.has(file)) continue
    visited.add(file)
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const match of source.matchAll(STATIC_IMPORT_RE)) {
      const resolved = resolveRelativeImport(match[1], dirname(file))
      if (!resolved) continue
      const relativePath = relative(repoRoot, resolved)
      if (relativePath.startsWith('scripts/')) closure.add(relativePath)
      if (!visited.has(resolved)) queue.push(resolved)
    }
  }
  return closure
}

describe('ciSkipInvariants', () => {
  it('exports shared path predicates used by classifiers and the lint guard', () => {
    expect(isSrcPath('src/lib/x.ts')).toBe(true)
    expect(isTestPath('tests/unit/x.unit.spec.ts')).toBe(true)
    expect(isCodePath('tsconfig.json')).toBe(true)
    expect(isCodePath('scripts/lib/cli.mjs')).toBe(true)
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

  it('launch/agent-session modules are high-risk — a lib-only diff cannot skip unit (OPS119+)', () => {
    // The pure launch libs are unit-pinned, so a diff touching only them must
    // still run the unit suite; the existence check keeps the entry from going
    // stale on a rename.
    for (const path of [
      'scripts/agent-session.mjs',
      'scripts/lib/agent-session.mjs',
      'scripts/lib/worktree.mjs',
    ]) {
      expect(HIGH_RISK_EXACT.has(path), path).toBe(true)
      expect(existsSync(join(repoRoot, path)), path).toBe(true)
    }
  })

  it('every scripts/ module reachable from a spec is high-risk (OPS119++ blast radius)', () => {
    // SCRIPTS_SPEC_PINNED is literal because test-affected-core is pure (no fs),
    // so the map sync is enforced here: recompute the spec import-graph closure
    // over scripts/** and require exact equality. Without the entry, a lib-only
    // diff classifies `none` and the covering spec never runs (S6).
    const closure = scriptsClosure(specFiles())
    // Self-check the walker sees real edges — direct and transitive — or the
    // equality below would fail for the wrong reason.
    expect(closure.has('scripts/lib/worktree-env.mjs')).toBe(true)
    expect(closure.has('scripts/lib/cityReportTerritory.mjs')).toBe(true)

    const missing = [...closure].filter((path) => !SCRIPTS_SPEC_PINNED.includes(path)).sort()
    const stale = SCRIPTS_SPEC_PINNED.filter((path) => !closure.has(path)).sort()
    expect(
      missing,
      `spec-pinned scripts/ modules missing from SCRIPTS_SPEC_PINNED:\n${missing.join('\n')}`,
    ).toEqual([])
    expect(
      stale,
      `SCRIPTS_SPEC_PINNED entries no longer reachable from a spec (rename/stale):\n${stale.join('\n')}`,
    ).toEqual([])
    // The map must stay folded into the high-risk set — a spec-pinned module
    // can never classify `none`.
    expect(SCRIPTS_SPEC_PINNED.every((path) => HIGH_RISK_EXACT.has(path))).toBe(true)
  })

  it('deploy starts on push to main with an active-run guard, dispatch kept (OPS104)', () => {
    // OPS104 supersedes the OPS71 manual-only pin: a push to main starts the
    // deploy run in the same workflow, and the preflight guard skips it when
    // another run is queued/in_progress (a `waiting` production approval does
    // NOT count — the script decision is pinned in deployTrigger.unit.spec.ts).
    // The manual dispatch stays as the escape. Comments are stripped first:
    // the header prose also mentions these keys and must never satisfy the pin.
    const deploy = readWorkflow('.github/workflows/deploy.yml')
    expect(deploy).toContain('workflow_dispatch:')
    expect(deploy).toContain('  push:')
    expect(deploy).toContain('    branches: [main]')
    expect(deploy).not.toMatch(/^\s*schedule:/m)
    // Trigger 1: push-only guard; the output default keeps a dispatch flowing.
    expect(deploy).toContain('  preflight:')
    expect(deploy).toContain('node scripts/deploy-preflight.mjs')
    expect(deploy).toContain("if: github.event_name == 'push'")
    expect(deploy).toContain("steps.guard.outputs.should_deploy || 'true'")
    expect(deploy).toContain("needs.preflight.outputs.should_deploy == 'true'")
    // Trigger 2: hosted requeue, token-native dispatch.
    expect(deploy).toContain('  requeue:')
    expect(deploy).toContain('node scripts/deploy-requeue.mjs')
    expect(deploy).toContain('actions: write')
    // Anti-goal: the requeue stays hosted and OUTSIDE the deploy concurrency
    // group — a run waiting on the production approval must not block it.
    const requeueBlock = deploy.slice(
      deploy.indexOf('  requeue:'),
      deploy.indexOf('  deploy-production:'),
    )
    expect(requeueBlock).toContain('runs-on: ubuntu-latest')
    expect(requeueBlock).not.toContain('concurrency:')

    // The OPS65 production-change gate died with the Forgejo ci.yml: the
    // full suite (verify) always runs before deploy, so no PR workflow may
    // reference the removed classifier.
    const ciPr = readFileSync(join(repoRoot, '.github/workflows/ci-pr.yml'), 'utf8')
    expect(ciPr).not.toContain('ci-classify-production.mjs')
  })

  it('deploy.yml chains verify → deploy-staging → deploy-production with separate environments (OPS103 + OPS107)', () => {
    // One dispatch, one verify, two separately approved deploys. The gate is
    // the GitHub Environment (reviewer on production, configured in the repo —
    // not in this YAML); the chain is needs-based so a red staging fail-closes
    // production. Comments are stripped first: the header prose also mentions
    // these keys, and it must never satisfy the pin.
    const deploy = readWorkflow('.github/workflows/deploy.yml')
    expect(deploy).toContain('  deploy-staging:')
    expect(deploy).toContain('  deploy-production:')
    expect(deploy).toContain('    environment: staging')
    expect(deploy).toContain('    environment: production')
    expect(deploy).toContain('    needs: [deploy-staging]')
    expect(deploy).toContain('      TEQO_ENV: staging')
    expect(deploy).toContain('      TEQO_ENV: production')
    expect(deploy).toContain("github.ref == 'refs/heads/main'")
    expect(deploy).toContain("needs.deploy-staging.result == 'success'")
    // OPS107: only staging holds the shared lane. Staging never waits on an
    // approval, so it always drains; the production approval must NOT hold a
    // concurrency group — a `waiting` job blocks every later run's staging
    // (the bug this delivers). Real serialization: the needs chain inside a
    // run, the single self-hosted runner and the host `flock`.
    const stagingBlock = deploy.slice(
      deploy.indexOf('  deploy-staging:'),
      deploy.indexOf('  requeue:'),
    )
    expect(stagingBlock).toContain('concurrency:')
    expect(stagingBlock).toContain('      group: deploy-homeserver')
    expect(stagingBlock).toContain('      cancel-in-progress: false')
    expect(stagingBlock).toContain('      queue: max')
    const productionBlock = deploy.slice(deploy.indexOf('  deploy-production:'))
    expect(productionBlock).not.toContain('concurrency:')
    // A workflow-level `concurrency:` would be acquired when the run starts
    // (before any approval) and reintroduce the same blockage.
    expect(deploy).not.toMatch(/^concurrency:/m)
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
