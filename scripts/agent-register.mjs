/**
 * `pnpm agent:register` — create a trackable issue (spec + prio + deps).
 *
 *   pnpm agent:register -- --id B91 --title "Ações rápidas — X" \
 *     --prio P1 --depends B79 --kind feature --plan docs/plans/x.md [--body "..."]
 *
 * Body = frontmatter (id/depends/priority) + spec (linked plan + --body text).
 * Starts life labeled `ready` (or `blocked` when --blocked).
 */

import { dieAgent, gh, issuesById, parseArgs, serializeFrontmatter } from './lib/agent-github.mjs'

const die = dieAgent('register')
const { flags } = parseArgs(
  process.argv.slice(2),
  new Set(['id', 'title', 'prio', 'depends', 'kind', 'plan', 'body', 'labels']),
)

if (!flags.id || !flags.title)
  die(
    'Usage: pnpm agent:register -- --id <ID> --title <title> [--prio P2] [--depends A,B] [--kind feature] [--plan path] [--body text] [--labels extra,labels] [--blocked]',
  )

const priority = /^P[0-3]$/.test(flags.prio ?? 'P2')
  ? (flags.prio ?? 'P2')
  : die(`Invalid --prio "${flags.prio}" (P0..P3).`)
const depends = (flags.depends ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

const existing = issuesById().get(flags.id)
if (existing)
  die(`An issue with id ${flags.id} already exists: #${existing.number} — ${existing.title}`)

const body = serializeFrontmatter(
  { id: flags.id, depends, serializes: [], priority },
  [flags.plan ? `Plano: [\`${flags.plan}\`](${flags.plan})` : null, flags.body ?? '']
    .filter((chunk) => chunk !== null)
    .join('\n\n'),
)

const labels = [
  flags.blocked ? 'blocked' : 'ready',
  `prio:${priority}`,
  `kind:${flags.kind ?? 'feature'}`,
  ...(flags.labels ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
]

const url = gh([
  'issue',
  'create',
  '--title',
  `${flags.id} — ${flags.title}`,
  '--body',
  body,
  ...labels.flatMap((label) => ['--label', label]),
])

console.log(`[agent:register] created ${url}`)
