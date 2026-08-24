/**
 * Shared helpers for the agent ops scripts (`pnpm agent:*`). Everything goes
 * through the GitHub REST API (scripts/lib/github-api.mjs) — agents never
 * get a token of their own beyond the env, and these scripts never touch
 * stage/prod database URLs.
 *
 * Issue contract (spec + status + deps in GitHub Issues, per the parallel
 * paradigm plan): each trackable issue carries a YAML-ish frontmatter block
 * at the top of the body:
 *
 *   ---
 *   id: B73
 *   depends: [B43, B65]
 *   serializes: [migrations]
 *   priority: P1
 *   ---
 *
 * State lives in labels: ready | in-progress | blocked | done (+ in-prod).
 */

import { dieWithLabel } from './cli.mjs'
import { githubApi as api } from './github-api.mjs'

const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
export const priorityRank = (priority) => PRIORITIES.indexOf(priority)

export const dieAgent = (script) => dieWithLabel(`agent:${script}`)

export const parseFrontmatter = (body) => {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(body ?? '')
  if (!match) return { meta: {}, rest: body ?? '' }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim())
    if (!kv) continue
    const [, key, raw] = kv
    meta[key] = raw.startsWith('[')
      ? raw
          .slice(1, -1)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : raw
  }
  return { meta, rest: body.slice(match[0].length) }
}

export const serializeFrontmatter = (meta, rest) => {
  const lines = ['---']
  for (const [key, value] of Object.entries(meta)) {
    lines.push(`${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`)
  }
  lines.push('---', '')
  return lines.join('\n') + (rest ?? '')
}

/** All issues (open or closed) that carry a frontmatter `id`, keyed by id. */
export const issuesById = async () => {
  const issues = await api.listIssues({ state: 'all', limit: 200 })
  const byId = new Map()
  for (const issue of issues) {
    const { meta } = parseFrontmatter(issue.body)
    if (typeof meta.id === 'string' && meta.id.length > 0) byId.set(meta.id, issue)
  }
  return byId
}

export const labelNames = (issue) => issue.labels.map((label) => label.name)

/** Issue ids that count as a satisfied dependency (closed or done/in-prod). */
const doneIdsOf = (byId) =>
  new Set(
    [...byId.entries()]
      .filter(([, issue]) => {
        const labels = labelNames(issue)
        return issue.state === 'CLOSED' || labels.includes('done') || labels.includes('in-prod')
      })
      .map(([id]) => id),
  )

/**
 * Claim-queue entry shape derived from ONE issue: meta, priority and the
 * dependency verdicts. Shared by `buildClaimQueue` (the queue) and
 * `claimQueueEntry` (single-issue contexts like reopening an in-progress
 * session) — one derivation, no drift.
 */
const entryForIssue = (issue, byId, doneIds) => {
  const { meta } = parseFrontmatter(issue.body)
  const depends = Array.isArray(meta.depends) ? meta.depends : []
  // A dep without an issue is a delivered roadmap item (B43/B47/B59…): they
  // predate the Issues era and are never reopened, so they are satisfied.
  const satisfiedWithoutIssue = depends.filter((id) => !byId.has(id))
  const blockedBy = depends.filter((id) => byId.has(id) && !doneIds.has(id))
  return {
    issue,
    meta,
    priority: labelNames(issue).find((label) => /^prio:P[0-3]$/.test(label)) ?? 'prio:P2',
    satisfiedWithoutIssue,
    blockedBy,
  }
}

/** Ready issues without a frontmatter `id` — unworkable: `branchNameForIssue`
 * fails loudly and they can never become a worktree, so they stay out of the
 * queue instead of poisoning `worktree next` forever.
 *
 * @param {Array<any>} openReady
 * @returns {Array<{ issue: any, meta: Record<string, any> }>}
 */
export const withoutIdReadyIssues = (openReady) =>
  openReady
    .map((issue) => ({ issue, meta: parseFrontmatter(issue.body).meta }))
    .filter(({ meta }) => typeof meta.id !== 'string' || meta.id.length === 0)

/**
 * Claim queue shared by `agent:claim` and the agent pool: open `ready` issues
 * filtered to UNBLOCKED (every frontmatter `depends` id is closed or labeled
 * `done`/`in-prod`; a dep without an issue is a delivered roadmap item —
 * satisfied, surfaced as a warning, never silently dropped), ordered by
 * `prio:P0..P3` then oldest first. Extracted verbatim from agent-claim.mjs;
 * behavior is pinned by agentPoolEligibility.unit.spec.ts.
 *
 * @param {Array<any>} openReady
 * @param {Map<string, any>} byId
 * @returns {Array<{ issue: any, meta: Record<string, any>, priority: string, satisfiedWithoutIssue: string[], blockedBy: string[] }>}
 */
export const buildClaimQueue = (openReady, byId) => {
  const doneIds = doneIdsOf(byId)

  const queue = openReady
    .map((issue) => entryForIssue(issue, byId, doneIds))
    .filter((entry) => entry.blockedBy.length === 0)
    .filter((entry) => typeof entry.meta.id === 'string' && entry.meta.id.length > 0)
    .sort((a, b) => {
      const rank =
        priorityRank(a.priority.replace('prio:', '')) -
        priorityRank(b.priority.replace('prio:', ''))
      return rank !== 0 ? rank : a.issue.createdAt.localeCompare(b.issue.createdAt)
    })
  return queue
}

/**
 * Entry shape for ONE issue regardless of its labels — the `worktree next
 * --issue <N>` reopen path (an already-claimed `in-progress` issue must not be
 * re-filtered by its deps: reopening is about the session, not the queue).
 */
export const claimQueueEntry = (issue, byId) => entryForIssue(issue, byId, doneIdsOf(byId))

/**
 * Pure decision for `worktree next --issue <N>`: how to treat the target issue
 * from its state/labels, WITHOUT touching GitHub. `reopen` = already claimed
 * (`in-progress` — no re-claim, and it wins over a stale `ready` double label);
 * `claim` = `ready`; `error` = anything else (closed, or neither label).
 */
export const claimTargetVerdict = (issue) => {
  if (issue.state !== 'OPEN') {
    return { kind: 'error', message: `Issue não está aberta (${issue.state}).` }
  }
  const names = labelNames(issue)
  if (names.includes('in-progress')) return { kind: 'reopen' }
  if (names.includes('ready')) return { kind: 'claim' }
  return {
    kind: 'error',
    message: `Issue não é claimável (labels: ${names.join(', ') || 'nenhum'}).`,
  }
}

/**
 * Optimistic claim shared by `agent:claim` and `worktree next`: re-reads the
 * issue right before flipping labels, refuses if someone else already took it
 * (`in-progress` present / `ready` gone), then swaps ready→in-progress and
 * leaves a claim comment with the run timestamp. `die` is injected by the
 * caller so the failure carries the right script label. The pool keeps its own
 * coordinated `claimIssueForPool` — this is the human/CLI lock.
 */
export const claimIssue = async (entry, die) => {
  const fresh = await api.getIssue(entry.issue.number)
  const freshLabels = labelNames(fresh)
  if (
    fresh.state !== 'OPEN' ||
    !freshLabels.includes('ready') ||
    freshLabels.includes('in-progress')
  ) {
    die(
      `Issue #${entry.issue.number} was just claimed or closed by someone else. ` +
        'Re-run `pnpm agent:claim` or reopen the session with `pnpm worktree next --issue ' +
        `${entry.issue.number}` +
        '`.',
    )
  }

  await setLabels(entry.issue.number, { add: ['in-progress'], remove: ['ready'] })
  await api.addComment(
    entry.issue.number,
    `Claimed by agent run at ${new Date().toISOString()}. Lock otimista: outro claim deve falhar e re-rodar \`pnpm agent:claim\`.`,
  )
}

/**
 * Lines of the claim brief (id, priority, rename_chat, model, deps, url, spec
 * body) printed by both claim surfaces (`agent:claim` and `worktree next`) —
 * one source of truth for the claim presentation.
 */
export const claimBriefLines = (entry) => {
  const { rest } = parseFrontmatter(entry.issue.body)
  const issueId = entry.meta.id ?? null
  let subject = entry.issue.title
  if (issueId) {
    const idPrefix = `${issueId} — `
    if (subject.startsWith(idPrefix)) subject = subject.slice(idPrefix.length)
  }
  const sessionTitle = issueId
    ? `#${entry.issue.number} ${issueId} — ${subject}`
    : `#${entry.issue.number} — ${subject}`

  return [
    `  id: ${issueId ?? '(none)'}  priority: ${entry.priority}`,
    `  rename_chat: ${sessionTitle.slice(0, 200)}`,
    entry.meta.model
      ? `  model: ${entry.meta.model} (metadata consultiva — o work-issue não verifica modelo)`
      : '  model: ausente — registrar slug único na Issue',
    ...(entry.satisfiedWithoutIssue.length > 0
      ? [
          `  deps sem issue (roadmap entregue, satisfeitas): ${entry.satisfiedWithoutIssue.join(', ')}`,
        ]
      : []),
    `  url: https://github.com/fsolla/teqo/issues/${entry.issue.number}`,
    '',
    '--- spec ---',
    '',
    rest.trim() || '(empty body — see linked plan)',
  ]
}

export const setLabels = (number, { add = [], remove = [] }) =>
  api.setLabels(number, { add, remove })

export const nextClaimableIssue = async () => {
  const openReady = await api.listIssues({ state: 'open', labels: 'ready', limit: 200 })
  const queue = buildClaimQueue(openReady, await issuesById())
  return { entry: queue[0] ?? null, skippedWithoutId: withoutIdReadyIssues(openReady) }
}

export const parseArgs = (argv, flagsWithValue) => {
  const flags = {}
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      if (flagsWithValue.has(name)) {
        const next = argv[index + 1]
        // A following `--flag` is not a value: `--issue --stay` leaves the
        // flag unset instead of silently consuming another flag as its value.
        flags[name] = typeof next === 'string' && next.startsWith('--') ? undefined : next
        index += 1
      } else {
        flags[name] = true
      }
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}
