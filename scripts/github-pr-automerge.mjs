/**
 * Plain-Node CLI (no pnpm) — GitHub PR safety net: mark `cursor/*` drafts
 * ready and arm GitHub's native auto-merge (rebase). Runs in
 * .github/workflows/agent-pr-ready-automerge.yml. The auto-merge arming uses
 * the AUTOMERGE_PAT (real user PAT) — never the built-in GITHUB_TOKEN, whose
 * actor (github-actions[bot]) would merge without creating workflow runs for
 * the `closed` event (OPS71-FLIP; anti-recursion — silent broken flips).
 * Mark-ready keeps the run token (nothing consumes its event).
 *
 * Unlike the Forgejo-era automerger (removed in OPS71 Fase 2), there is NO
 * poll loop: `enablePullRequestAutoMerge` is server-side — GitHub only merges
 * when every required check (incl. `CI (PR) / checks`) is green and the PR is
 * mergeable. The OPS64 "never trust the rollup" pin is structural here: a
 * single sequential job posts one honest check-run, and the server enforces
 * it. Draft policy (OPS57) preserved: only `cursor/*` heads are marked
 * ready — any other draft is the actor's veto (skip, exit 0). OPS98: `audit/*`
 * heads are vetoed entirely (ready or draft) — the engineering-audit single PR
 * merges by human hand only.
 *
 * Idempotent: already merged / closed / non-main base → no-op success.
 * A GraphQL error (e.g. repo auto-merge disabled, PR in conflict) exits 1 so
 * the job goes red and the situation is visible.
 *
 *   node scripts/github-pr-automerge.mjs --pr <N>
 */

import { createApi } from './lib/github-api.mjs'
import { automergeArmingToken, decideAutomergeAction } from './lib/github-pr-flow.mjs'

const parseArgs = (argv) => {
  const flags = {}
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      const next = argv[index + 1]
      flags[name] = typeof next === 'string' && !next.startsWith('--') ? next : true
      if (typeof next === 'string' && !next.startsWith('--')) index += 1
    }
  }
  return flags
}

const flags = parseArgs(process.argv)
const prNumber = Number(flags.pr)
if (!Number.isInteger(prNumber) || prNumber <= 0) {
  console.error('Usage: node scripts/github-pr-automerge.mjs --pr <N>')
  process.exit(1)
}

const api = createApi({})
// OPS71-FLIP: the native auto-merge MUST be armed with a real user PAT, not
// the built-in GITHUB_TOKEN. A merge performed through the GITHUB_TOKEN actor
// (github-actions[bot]) never creates workflow runs for its events (GitHub
// anti-recursion — the `pull_request` `closed` is recorded in the timeline
// but no run is created), so the post-merge flips would silently never run
// (live finding: PR #746). With a PAT the merge is attributed to its owner (a
// real user) and the `closed` event creates runs again (PR #742 behavior).
// Fail-closed: no AUTOMERGE_PAT → exit 1 — never fall back to GITHUB_TOKEN.
const arming = automergeArmingToken(process.env)
if (!arming.ok) {
  console.error(`[github-pr-automerge] ${arming.reason}`)
  process.exit(1)
}
const automergeApi = createApi({ token: arming.token })
try {
  const pr = await api.getPullRequest(prNumber)
  const verdict = decideAutomergeAction(pr)

  if (verdict.action === 'skip') {
    console.log(`[github-pr-automerge] PR #${prNumber}: skip (${verdict.reason})`)
    process.exit(0)
  }

  if (verdict.action === 'mark-ready') {
    console.log(`[github-pr-automerge] PR #${prNumber} é draft cursor/* — marcando Ready`)
    await api.markPullRequestReady(prNumber)
  }

  console.log(`[github-pr-automerge] PR #${prNumber}: armando auto-merge (rebase)`)
  await automergeApi.enableAutoMerge(pr.nodeId)
  console.log(
    `[github-pr-automerge] PR #${prNumber}: auto-merge armado — o GitHub mergea quando o required check "CI (PR) / checks" fica verde`,
  )
} catch (error) {
  console.error(`[github-pr-automerge] falhou: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
