/**
 * Pure argv helpers for the local e2e runner (S6-FOLLOWUP, 2026-08-18).
 * `run-e2e-affected.mjs` consumes them; unit-pinned in
 * tests/unit/playwrightE2eArgs.unit.spec.ts.
 *
 * Why `--no-deps` + `--`: positional paths ARE parsed correctly by the
 * Playwright CLI (commander), but in DEV mode the project dependency chain
 * (setup -> campaign -> frontend -> admin, playwright.config.ts) makes the
 * runner drag ALL files of every dependency project into a selected run via
 * buildProjectsClosure — filtering to one frontend spec runs the whole
 * campaign family. `--no-deps` disables that closure for FILTERED runs only;
 * a full run keeps the dev chain (OPS34 cold-compile prewarm ordering). The
 * `--` separator guards the generated scope paths from flag parsing.
 */

/** Flags that filter the run by themselves (not just runner knobs). */
const FILTER_FLAG_RE = /^(?:--project|-g|--grep|--grep-invert)(?:=.*)?$/

/**
 * Passthrough args from the process argv, minus the script path. pnpm
 * consumes its own `--` separator, so a leading `--` in argv only appears on
 * direct `node scripts/...` invocations — strip exactly one, forward the rest
 * verbatim (flag values must not be re-classified, e.g. `-g grade`).
 * @param {string[]} argv process.argv
 * @returns {string[]}
 */
export const parsePassthroughArgs = (argv) => {
  const rest = argv.slice(2)
  return rest[0] === '--' ? rest.slice(1) : rest
}

/**
 * @param {{ scopeSpecPaths?: string[], passthroughArgs?: string[] }} input
 *   scopeSpecPaths — repo-relative spec paths selected by the affected manifest.
 *   passthroughArgs — extra args forwarded by the user.
 * @returns {string[]} pnpm argv for the e2e run, e.g.
 *   ['test:e2e', '--no-deps', '--', 'tests/e2e/foo.e2e.spec.ts']
 */
export const buildPlaywrightE2eArgs = ({ scopeSpecPaths = [], passthroughArgs = [] }) => {
  const filtered =
    scopeSpecPaths.length > 0 ||
    passthroughArgs.some((arg) => !arg.startsWith('-') || FILTER_FLAG_RE.test(arg))
  const args = ['test:e2e', ...passthroughArgs]
  if (filtered && !passthroughArgs.includes('--no-deps')) {
    args.push('--no-deps')
  }
  if (scopeSpecPaths.length > 0) {
    args.push('--', ...scopeSpecPaths)
  }
  return args
}
