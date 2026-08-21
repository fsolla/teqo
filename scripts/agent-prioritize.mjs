/**
 * `pnpm agent:prioritize` — re-prioritize a trackable issue.
 *
 *   pnpm agent:prioritize -- <issue-number> P1
 */

import { dieAgent, labelNames, parseArgs, setLabels } from './lib/agent-forgejo.mjs'
import { githubApi as api } from './lib/github-api.mjs'

const die = dieAgent('prioritize')
const { positional } = parseArgs(process.argv.slice(2), new Set())

const [number, priority] = positional
if (!number || !/^P[0-3]$/.test(priority ?? '')) {
  die('Usage: pnpm agent:prioritize -- <issue-number> <P0|P1|P2|P3>')
}

const issue = await api.getIssue(number)
const current = labelNames(issue).filter((label) => /^prio:P[0-3]$/.test(label))
await setLabels(number, { add: [`prio:${priority}`], remove: current })
console.log(
  `[agent:prioritize] #${issue.number} — ${issue.title}: ${current.join(',') || '(none)'} → prio:${priority}`,
)
