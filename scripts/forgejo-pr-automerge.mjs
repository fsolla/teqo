/**
 * Plain-Node CLI (no pnpm) — PR safety net: wait for checks and merge by
 * rebase (the Forgejo equivalent of `gh pr merge --auto --rebase`, which the
 * Forgejo API does not offer as a scheduled operation). Idempotent: already
 * merged → no-op success. The verdict comes from re-reading the PR (Forgejo's
 * merge endpoint answers 200 + empty body on success, so the POST response
 * alone cannot prove the merge) — "já mergeado" is only printed for a PR the
 * server actually reports as merged; a failed merge exits 1 loudly.
 *
 * Draft policy (OPS57): only `cursor/*` heads get marked ready. A draft from
 * any other branch is the actor's veto — the CLI skips it (exit 0) so the
 * workflow never forces a human/plans PR to ready.
 *
 *   node scripts/forgejo-pr-automerge.mjs --pr <N>
 */

import { createApi } from './lib/forgejo-api.mjs'

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
  console.error('Usage: node scripts/forgejo-pr-automerge.mjs --pr <N>')
  process.exit(1)
}

const api = createApi({})
try {
  const pr = await api.getPullRequest(prNumber)
  if (!pr || pr.state !== 'OPEN') {
    console.log(
      `[forgejo-pr-automerge] PR #${prNumber} não está aberto (${pr?.state ?? 'inexistente'}) — skip`,
    )
    process.exit(0)
  }
  if (pr.base.ref !== 'main') {
    console.log(`[forgejo-pr-automerge] PR #${prNumber} base é ${pr.base.ref} (não main) — skip`)
    process.exit(0)
  }
  if (pr.isDraft) {
    if (!pr.head.ref.startsWith('cursor/')) {
      console.log(
        `[forgejo-pr-automerge] PR #${prNumber} é draft fora de cursor/* — skip (veto do ator)`,
      )
      process.exit(0)
    }
    console.log(`[forgejo-pr-automerge] PR #${prNumber} é draft — marcando Ready`)
    await api.markPullRequestReady(prNumber)
  } else {
    console.log(`[forgejo-pr-automerge] PR #${prNumber} já Ready`)
  }
  const {
    attempted,
    merged,
    pr: after,
  } = await api.autoMerge(prNumber, {
    // OPS61: the wait now covers the whole CI (PR) cascade (the `checks`
    // rollup only posts after every ci-pr job), so the 30 min default was too
    // tight under load — e2e shards + int + build run before the rollup.
    timeoutMs: 45 * 60 * 1000,
    log: (line) => console.log(`[forgejo-pr-automerge] ${line}`),
  })
  if (merged) {
    console.log(
      attempted
        ? `[forgejo-pr-automerge] PR #${prNumber} mergeado (rebase)`
        : `[forgejo-pr-automerge] PR #${prNumber} já mergeado`,
    )
  } else {
    console.log(
      after?.state === 'CLOSED'
        ? `[forgejo-pr-automerge] PR #${prNumber} fechado sem merge — skip`
        : `[forgejo-pr-automerge] PR #${prNumber} voltou a draft — skip (veto do ator)`,
    )
  }
} catch (error) {
  console.error(`[forgejo-pr-automerge] falhou: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
