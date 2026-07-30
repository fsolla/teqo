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

export const STATE_LABELS = ['ready', 'in-progress', 'blocked', 'done', 'in-prod']
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
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
