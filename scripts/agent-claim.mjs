/**
 * `pnpm agent:claim` — claim the next trackable issue for this agent run.
 *
 * Queue: open issues labeled `ready`, filtered to UNBLOCKED (every frontmatter
 * `depends` id is closed or labeled `done`/`in-prod`), ordered by `prio:P0..P3`
 * then oldest first. `--dry-run` prints the queue without claiming.
 *
 * Lock otimista: re-reads the issue right before flipping labels, refuses if
 * someone else already took it (`in-progress` present / `ready` gone), then
 * swaps ready→in-progress and leaves a claim comment with the run timestamp.
 *
 * Output: the brief on stdout (issue, id, priority, plan/spec body) — the
 * agent reads it and starts; it does NOT create the branch (Cursor worktrees
 * own that) and it never merges anywhere. PRs go `--base stage`.
 */

import {
  dieAgent,
  gh,
  ghJson,
  issuesById,
  labelNames,
  parseArgs,
  parseFrontmatter,
  priorityRank,
  setLabels,
} from './lib/agent-github.mjs'

const die = dieAgent('claim')
const { flags } = parseArgs(process.argv.slice(2), new Set(['issue']))

const openReady = ghJson([
  'issue',
  'list',
  '--state',
  'open',
  '--label',
  'ready',
  '--limit',
  '200',
  '--json',
  'number,title,body,labels,createdAt',
])

const byId = issuesById()
const doneIds = new Set(
  [...byId.entries()]
    .filter(([, issue]) => {
      const labels = labelNames(issue)
      return issue.state === 'CLOSED' || labels.includes('done') || labels.includes('in-prod')
    })
    .map(([id]) => id),
)

const queue = openReady
  .map((issue) => {
    const { meta } = parseFrontmatter(issue.body)
    const depends = Array.isArray(meta.depends) ? meta.depends : []
    // A dep without an issue is a delivered roadmap item (B43/B47/B59…): they
    // predate the Issues era and are never reopened, so they are satisfied —
    // surfaced as a warning in the brief, never silently dropped.
    const satisfiedWithoutIssue = depends.filter((id) => !byId.has(id))
    const blockedBy = depends.filter((id) => byId.has(id) && !doneIds.has(id))
    return {
      issue,
      meta,
      priority: labelNames(issue).find((label) => /^prio:P[0-3]$/.test(label)) ?? 'prio:P2',
      satisfiedWithoutIssue,
      blockedBy,
    }
  })
  .filter((entry) => entry.blockedBy.length === 0)
  .sort((a, b) => {
    const rank = priorityRank(a.priority.replace('prio:', '')) - priorityRank(b.priority.replace('prio:', ''))
    return rank !== 0 ? rank : a.issue.createdAt.localeCompare(b.issue.createdAt)
  })

if (flags['dry-run'] || flags['dryrun']) {
  console.log(`[agent:claim] ${queue.length} unblocked ready issue(s):`)
  for (const entry of queue) {
    console.log(`  #${entry.issue.number} [${entry.priority}] ${entry.issue.title}`)
  }
  process.exit(0)
}

const pick = flags.issue
  ? queue.find((entry) => entry.issue.number === Number(flags.issue))
  : queue[0]

if (!pick) {
  die(
    flags.issue
      ? `Issue #${flags.issue} is not claimable (missing, not ready, or blocked by deps).`
      : 'Nothing to claim — no unblocked issues labeled `ready`. Run with --dry-run to inspect.',
  )
}

// Optimistic lock: re-read right before flipping.
const fresh = ghJson([
  'issue',
  'view',
  String(pick.issue.number),
  '--json',
  'number,labels,state',
])
const freshLabels = labelNames(fresh)
if (fresh.state !== 'OPEN' || !freshLabels.includes('ready') || freshLabels.includes('in-progress')) {
  die(`Issue #${pick.issue.number} was just claimed or closed by someone else. Re-run claim.`)
}

setLabels(pick.issue.number, { add: ['in-progress'], remove: ['ready'] })
gh([
  'issue',
  'comment',
  String(pick.issue.number),
  '--body',
  `Claimed by agent run at ${new Date().toISOString()}. Lock otimista: outro claim deve falhar e re-rodar \`pnpm agent:claim\`.`,
])

const { rest } = parseFrontmatter(pick.issue.body)
console.log(`\n[agent:claim] Claimed #${pick.issue.number} — ${pick.issue.title}`)
console.log(`  id: ${pick.meta.id ?? '(none)'}  priority: ${pick.priority}`)
if (pick.satisfiedWithoutIssue.length > 0) {
  console.log(
    `  deps sem issue (roadmap entregue, satisfeitas): ${pick.satisfiedWithoutIssue.join(', ')}`,
  )
}
console.log(`  url: https://github.com/fsolla/teqo/issues/${pick.issue.number}`)
console.log('\n--- spec ---\n')
console.log(rest.trim() || '(empty body — see linked plan)')
console.log(
  '\n[agent:claim] Fluxo: implementar → fast gate → gh pr create --base stage (Closes #' +
    `${pick.issue.number}) → PARAR. Promote a main é humano (pnpm agent:promote --i-am-human).`,
)
