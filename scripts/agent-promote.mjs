/**
 * `pnpm agent:promote` — REMOVED (main-only cutover).
 *
 * Feature PRs merge directly to `main`. Production deploy is gated by `ci.yml`
 * (`vercel deploy --prod` after the full suite). There is no stage→main promote.
 *
 * See docs/AGENT-OPS.md.
 */

import { dieAgent, parseArgs } from './lib/agent-github.mjs'

const die = dieAgent('promote')
parseArgs(process.argv.slice(2), new Set())

die(
  'Removed: stage→main promote no longer exists.\n' +
    '  Open PRs with `gh pr create --base main`.\n' +
    '  Production deploy runs from `.github/workflows/ci.yml` after the full verifier is green.\n' +
    '  Details: docs/AGENT-OPS.md',
)
