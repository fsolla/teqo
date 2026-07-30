/**
 * Pure selection logic for affected-test CI jobs (OPS5). No git, no fs, no
 * process — the CLI wrappers feed it the changed file list and it decides.
 * Unit-pinned in tests/unit/testAffected.unit.spec.ts and
 * tests/unit/e2eAffectedManifest.unit.spec.ts.
 */

/**
 * Paths whose blast radius is the whole app: schema, test harness, lockfile.
 * Any diff touching them runs the FULL suites — selection is unsafe there.
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
  '.env.test',
])

export const HIGH_RISK_PREFIXES = [
  'src/migrations/',
  'src/collections/',
  'src/globals/',
  'tests/helpers/',
  'tests/e2e/fixtures/',
]

function isHighRisk(path) {
  return HIGH_RISK_EXACT.has(path) || HIGH_RISK_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * Decide vitest scope for a PR diff.
 * @param {{ path: string, status: string }[]} files git diff --name-status rows.
 * @returns {{ mode: 'full' | 'changed' | 'none', reason: string }}
 *   full    — high-risk path or new src file (nothing imports it yet, so
 *             --changed cannot find it; silent green otherwise);
 *   changed — vitest --changed <base> is meaningful;
 *   none    — no src/tests touched (docs-only PR); skip the jobs.
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

const E2E_SPEC_PATTERN = /^tests\/e2e\/[^/]+\.e2e\.spec\.ts$/

/**
 * Decide the Playwright scope for a PR diff.
 * @param {{ path: string, status: string }[]} files
 * @param {{ prefixes: string[], specs: string[] }[]} manifest prefix → spec names.
 * @returns {{ mode: 'full' | 'selected' | 'none', specs: string[], reason: string,
 *             unmapped: string[] }}
 *   `specs` are spec NAMES (no path, no .e2e.spec.ts). `unmapped` lists src/
 *   files with no manifest prefix — logged in CI, never a failure (e2e is a
 *   thin layer over int; the gap is for a human to judge).
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
  for (const { path } of files) {
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
  return {
    mode: 'selected',
    specs: [...specs].sort(),
    reason: `${specs.size} spec(s) selected via manifest and changed specs`,
    unmapped,
  }
}
