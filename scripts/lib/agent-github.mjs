/**
 * Shared helpers for the agent ops scripts (`pnpm agent:*`). Everything goes
 * through the authenticated `gh` CLI — agents never get a GitHub token of
 * their own, and these scripts never touch stage/prod database URLs.
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

import { execFileSync } from 'node:child_process'

import { dieWithLabel } from './cli.mjs'

const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
export const priorityRank = (priority) => PRIORITIES.indexOf(priority)

export const dieAgent = (script) => dieWithLabel(`agent:${script}`)

/** Run gh and return stdout (throws with the gh stderr on failure). */
export const gh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

export const ghJson = (args) => JSON.parse(gh(args))

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
export const issuesById = () => {
  const issues = ghJson([
    'issue',
    'list',
    '--state',
    'all',
    '--limit',
    '500',
    '--json',
    'number,title,body,state,labels',
  ])
  const byId = new Map()
  for (const issue of issues) {
    const { meta } = parseFrontmatter(issue.body)
    if (typeof meta.id === 'string' && meta.id.length > 0) byId.set(meta.id, issue)
  }
  return byId
}

export const labelNames = (issue) => issue.labels.map((label) => label.name)

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
  const doneIds = new Set(
    [...byId.entries()]
      .filter(([, issue]) => {
        const labels = labelNames(issue)
        return issue.state === 'CLOSED' || labels.includes('done') || labels.includes('in-prod')
      })
      .map(([id]) => id),
  )

  return openReady
    .map((issue) => {
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
    })
    .filter((entry) => entry.blockedBy.length === 0)
    .sort((a, b) => {
      const rank =
        priorityRank(a.priority.replace('prio:', '')) -
        priorityRank(b.priority.replace('prio:', ''))
      return rank !== 0 ? rank : a.issue.createdAt.localeCompare(b.issue.createdAt)
    })
}

export const setLabels = (number, { add = [], remove = [] }) => {
  const args = ['issue', 'edit', String(number)]
  for (const label of add) args.push('--add-label', label)
  for (const label of remove) args.push('--remove-label', label)
  if (add.length + remove.length > 0) gh(args)
}

export const parseArgs = (argv, flagsWithValue) => {
  const flags = {}
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      if (flagsWithValue.has(name)) {
        flags[name] = argv[index + 1]
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
