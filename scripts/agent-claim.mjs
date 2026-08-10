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
 * own that) and it never merges anywhere. PRs go `--base main`.
 */

import {
  buildClaimQueue,
  dieAgent,
  gh,
  ghJson,
  issuesById,
  labelNames,
  parseArgs,
  parseFrontmatter,
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
  // Include `state` for parity with the pool queue (isAutonomousClaimable).
  '--json',
  'number,title,body,labels,createdAt,state',
])

// Queue builder lives in agent-github.mjs (shared with the agent pool —
// identical ordering/filtering, pinned by agentPoolEligibility.unit.spec.ts).
const queue = buildClaimQueue(openReady, issuesById())

if (flags['dry-run'] || flags['dryrun']) {
  console.log(`[agent:claim] ${queue.length} unblocked ready issue(s):`)
  for (const entry of queue) {
    const model = entry.meta.model ? ` model:${entry.meta.model}` : ''
    console.log(`  #${entry.issue.number} [${entry.priority}]${model} ${entry.issue.title}`)
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
const fresh = ghJson(['issue', 'view', String(pick.issue.number), '--json', 'number,labels,state'])
const freshLabels = labelNames(fresh)
if (
  fresh.state !== 'OPEN' ||
  !freshLabels.includes('ready') ||
  freshLabels.includes('in-progress')
) {
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
const issueId = pick.meta.id ?? null
let subject = pick.issue.title
if (issueId) {
  const idPrefix = `${issueId} — `
  if (subject.startsWith(idPrefix)) subject = subject.slice(idPrefix.length)
}
const sessionTitle = issueId
  ? `#${pick.issue.number} ${issueId} — ${subject}`
  : `#${pick.issue.number} — ${subject}`

console.log(`\n[agent:claim] Claimed #${pick.issue.number} — ${pick.issue.title}`)
console.log(`  id: ${issueId ?? '(none)'}  priority: ${pick.priority}`)
console.log(`  rename_chat: ${sessionTitle.slice(0, 200)}`)
if (pick.meta.model) {
  console.log(
    `  model: ${pick.meta.model} (metadata consultiva — o work-issue não verifica modelo; o pool spawna nele; ver skill model-selection)`,
  )
} else {
  console.log(
    '  model: ausente — registrar slug único na Issue (gh issue edit; ver skill model-selection)',
  )
}
if (pick.satisfiedWithoutIssue.length > 0) {
  console.log(
    `  deps sem issue (roadmap entregue, satisfeitas): ${pick.satisfiedWithoutIssue.join(', ')}`,
  )
}
console.log(`  url: https://github.com/fsolla/teqo/issues/${pick.issue.number}`)
console.log('\n--- spec ---\n')
console.log(rest.trim() || '(empty body — see linked plan)')
console.log(
  '\n[agent:claim] Fluxo: claim feito fora da sessão → abra a sessão de trabalho no worktree (skill `work-issue`, humano; no pool, o prompt do worker aponta `agent-work-issue`) → gates → PR Ready --base main (Closes #' +
    `${pick.issue.number}) → auto-merge.`,
)
