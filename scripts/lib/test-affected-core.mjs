/**
 * Pure selection logic for affected-test CI jobs (OPS5). No git, no fs, no
 * process — the CLI wrappers feed it the changed file list and it decides.
 * Unit-pinned in tests/unit/testAffected.unit.spec.ts,
 * tests/unit/ciSkipInvariants.unit.spec.ts, and
 * tests/unit/e2eAffectedManifest.unit.spec.ts.
 */

/**
 * Paths whose blast radius is the whole app: schema, test harness, lockfile,
 * skip classifiers. Any diff touching them runs the FULL suites — selection
 * is unsafe there.
 */
export const HIGH_RISK_EXACT = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'playwright.config.ts',
  'vitest.config.mts',
  'vitest.unit.config.mts',
  'vitest.setup.ts',
  'src/payload-types.ts',
  'src/payload.config.ts',
  'scripts/seed-minimal.mjs',
  'scripts/lib/seed-minimal-manifest.mjs',
  'scripts/worktree.mjs',
  'scripts/lib/test-affected-core.mjs',
  'scripts/lib/e2e-affected-manifest.mjs',
  'scripts/test-affected.mjs',
  'scripts/e2e-affected.mjs',
  'scripts/run-e2e-affected.mjs',
  'scripts/ci-scope.mjs',
  'scripts/check-test-locations.mjs',
  'scripts/check-plans-only-pr-closes.mjs',
  'scripts/lib/plansOnlyClosesGuard.mjs',
  'scripts/gate-ci.mjs',
  'tests/unit/ciSkipInvariants.unit.spec.ts',
  'tests/unit/testAffected.unit.spec.ts',
  '.env.test',
])

export const HIGH_RISK_PREFIXES = [
  'src/migrations/',
  'src/collections/',
  'src/globals/',
  'tests/helpers/',
  'tests/e2e/fixtures/',
]

/** Canonical vitest/playwright globs — keep in sync with config files. */
export const CANONICAL_UNIT_INCLUDE = 'tests/unit/**/*.unit.spec.{ts,tsx}'
export const CANONICAL_INT_INCLUDE = 'tests/int/**/*.int.spec.ts'
export const CANONICAL_E2E_TEST_DIR = 'tests/e2e'
export const CANONICAL_E2E_SPEC_SUFFIX = '.e2e.spec.ts'

const CODE_CONFIG_EXACT = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.tsbuildinfo',
  'eslint.config.mjs',
  'eslint.config.js',
  'knip.json',
  'knip.ts',
  'knip.config.ts',
  '.eslintrc.cjs',
  '.eslintrc.js',
])

const CODE_CONFIG_PREFIXES = ['tsconfig']

const BUILD_SURFACE_EXACT = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'src/payload.config.ts',
  'src/payload-types.ts',
  'tsconfig.json',
])

const BUILD_SURFACE_PREFIXES = [
  'src/',
  'public/',
  'src/migrations/',
  'src/collections/',
  'src/globals/',
  'tsconfig',
]

const SPEC_FILE_RE = /\.(?:spec|test)\.(?:ts|tsx)$/
const UNIT_SPEC_RE = /^tests\/unit\/.+\.unit\.spec\.(?:ts|tsx)$/
const INT_SPEC_RE = /^tests\/int\/.+\.int\.spec\.ts$/
const E2E_SPEC_RE = /^tests\/e2e\/[^/]+\.e2e\.spec\.ts$/

/** Cross-cutting dirs under campaign components (no dedicated e2e family). */
export const E2E_MANIFEST_DOMAIN_EXEMPT = new Set(['shared'])

export function isHighRisk(path) {
  return HIGH_RISK_EXACT.has(path) || HIGH_RISK_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function isTestPath(path) {
  return path.startsWith('tests/')
}

export function isSrcPath(path) {
  return path.startsWith('src/')
}

/**
 * Paths that affect typecheck / knip / madge (and therefore those PR jobs).
 */
export function isCodePath(path) {
  if (isSrcPath(path) || isTestPath(path)) return true
  if (CODE_CONFIG_EXACT.has(path)) return true
  if (CODE_CONFIG_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) {
    return true
  }
  if (path.startsWith('eslint') || path.includes('eslint.config')) return true
  if (path.startsWith('knip')) return true
  return false
}

/**
 * Paths that affect `pnpm build` (Next + Payload surface).
 */
export function isBuildPath(path) {
  if (BUILD_SURFACE_EXACT.has(path)) return true
  if (isSrcPath(path) || path.startsWith('public/')) return true
  if (path.startsWith('next.config')) return true
  if (BUILD_SURFACE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  return false
}

export function isCanonicalSpecPath(path) {
  return UNIT_SPEC_RE.test(path) || INT_SPEC_RE.test(path) || E2E_SPEC_RE.test(path)
}

export function isMisplacedSpecPath(path) {
  return SPEC_FILE_RE.test(path) && !isCanonicalSpecPath(path)
}

/**
 * Decide vitest scope for a PR diff.
 * @param {{ path: string, status: string }[]} files git diff --name-status rows.
 * @returns {{ mode: 'full' | 'changed' | 'none', reason: string }}
 */
export function classifyTestScope(files) {
  if (files.some(({ path }) => isHighRisk(path))) {
    return { mode: 'full', reason: 'diff touches a high-risk path (schema/lockfile/test harness)' }
  }
  if (files.some(({ path, status }) => status === 'A' && path.startsWith('src/'))) {
    return { mode: 'full', reason: 'new src/ file — vitest --changed cannot trace tests to it yet' }
  }
  if (files.some(({ path }) => path.startsWith('src/') || path.startsWith('tests/'))) {
    return { mode: 'changed', reason: 'src/tests diff without high-risk paths' }
  }
  return { mode: 'none', reason: 'no src/ or tests/ changes' }
}

/**
 * Decide whether typecheck / knip / cycles should run.
 * @returns {{ mode: 'code' | 'none', reason: string }}
 */
export function classifyStaticScope(files) {
  if (files.some(({ path }) => isCodePath(path))) {
    return { mode: 'code', reason: 'diff touches src/tests or type/graph config' }
  }
  return { mode: 'none', reason: 'no code/type/graph surface changes' }
}

/**
 * Decide whether the PR build job should run.
 * @returns {{ mode: 'build' | 'none', reason: string }}
 */
export function classifyBuildScope(files) {
  if (files.some(({ path }) => isHighRisk(path) && isBuildPath(path))) {
    return { mode: 'build', reason: 'diff touches a high-risk build surface path' }
  }
  if (files.some(({ path }) => isBuildPath(path))) {
    return { mode: 'build', reason: 'diff touches build surface' }
  }
  return { mode: 'none', reason: 'no build surface changes' }
}

const E2E_SPEC_PATTERN = /^tests\/e2e\/[^/]+\.e2e\.spec\.ts$/

/**
 * Decide the Playwright scope for a PR diff.
 * @param {{ path: string, status: string }[]} files
 * @param {{ prefixes: string[], specs: string[] }[]} manifest prefix → spec names.
 * @returns {{ mode: 'full' | 'selected' | 'none', specs: string[], reason: string,
 *             unmapped: string[] }}
 */
export function selectE2eSpecs(files, manifest) {
  if (files.some(({ path }) => isHighRisk(path))) {
    return {
      mode: 'full',
      specs: [],
      reason: 'diff touches a high-risk path (schema/lockfile/test harness)',
      unmapped: [],
    }
  }
  const specs = new Set()
  const unmapped = []
  for (const { path, status } of files) {
    // A deleted spec file cannot run — selecting it would make CI fail with
    // "No tests found" (the stale-manifest variant of a spec rename).
    if (status === 'D' && E2E_SPEC_PATTERN.test(path)) continue
    if (E2E_SPEC_PATTERN.test(path)) {
      specs.add(path.slice('tests/e2e/'.length, -'.e2e.spec.ts'.length))
      continue
    }
    if (!path.startsWith('src/')) continue
    const matches = manifest.filter((entry) =>
      entry.prefixes.some((prefix) => path.startsWith(prefix)),
    )
    if (matches.length === 0) {
      unmapped.push(path)
      continue
    }
    for (const match of matches) for (const spec of match.specs) specs.add(spec)
  }
  if (specs.size === 0) {
    return {
      mode: 'none',
      specs: [],
      reason:
        unmapped.length > 0
          ? 'src/ changes with no e2e manifest mapping (see unmapped list)'
          : 'no e2e-relevant changes',
      unmapped,
    }
  }
  // The `setup` spec is dev-mode-only: the setup project is dropped under
  // CI/prod (playwright.config.ts), so a selection containing ONLY it would
  // run `playwright test -- tests/e2e/setup.e2e.spec.ts` against zero projects
  // and fail with "No tests found" (OPS39 — first setup-only PR hit it). In a
  // mixed set the spec is harmless (it just matches no project), so only the
  // setup-only case drops out.
  if (specs.size === 1 && specs.has('setup')) {
    return {
      mode: 'none',
      specs: [],
      reason: 'setup spec is dev-mode-only; prod-mode e2e cannot run it',
      unmapped,
    }
  }
  return {
    mode: 'selected',
    specs: [...specs].sort(),
    reason: `${specs.size} spec(s) selected via manifest and changed specs`,
    unmapped,
  }
}

/**
 * CI job-level parallelism for the e2e suite (OPS34). The full run splits
 * across 2 shards (`--shard=N/total`); selected and none stay on a single
 * runner — a second build for a handful of specs is pure waste. Measured
 * 2026-08-10 (ci.yml run 31412425553): build 172s + tests 196s + ~54s fixed,
 * so shard 1 and 2 each land ≈ 5–5.5 min. Revisit at 3 shards if the sharded
 * wall drifts past ~6.5 min or the test split gets lopsided; ci.yml hardcodes
 * the same [1, 2] / 2 literal with a comment pointing back here.
 * @param {'full' | 'selected' | 'none'} mode
 * @returns {{ matrix: number[], total: number }}
 */
export function e2eShardConfig(mode) {
  return mode === 'full' ? { matrix: [1, 2], total: 2 } : { matrix: [1], total: 1 }
}

/**
 * Walk a list of repo-relative paths and return misplaced spec/test files.
 * @param {string[]} paths
 * @returns {string[]}
 */
export function findMisplacedSpecPaths(paths) {
  return paths.filter(isMisplacedSpecPath).sort()
}

/**
 * Domain folders that must appear in the e2e affected manifest (or be exempt).
 * @param {string[]} componentDirs immediate children of src/components/campaign
 * @param {string[]} appRouteDirs immediate children of src/app/(campaign)/campanha/(app)
 * @param {{ prefixes: string[] }[]} manifest
 * @param {Set<string>} [exempt]
 * @returns {{ missing: string[], covered: string[] }}
 */
export function findUncoveredE2eDomainPrefixes(
  componentDirs,
  appRouteDirs,
  manifest,
  exempt = E2E_MANIFEST_DOMAIN_EXEMPT,
) {
  const prefixes = manifest.flatMap((entry) => entry.prefixes)
  const required = []

  for (const dir of componentDirs) {
    if (exempt.has(dir)) continue
    required.push(`src/components/campaign/${dir}`)
  }
  for (const dir of appRouteDirs) {
    if (dir.includes('.')) continue // files like page.tsx / error.tsx
    required.push(`src/app/(campaign)/campanha/(app)/${dir}`)
  }

  const missing = []
  const covered = []
  for (const path of required) {
    const hit = prefixes.some(
      (prefix) => prefix === path || prefix.startsWith(`${path}/`) || path.startsWith(prefix),
    )
    if (hit) covered.push(path)
    else missing.push(path)
  }
  return { missing: missing.sort(), covered: covered.sort() }
}
