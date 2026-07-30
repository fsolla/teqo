/**
 * `pnpm agent:promote -- --i-am-human` — promote `stage` → `main` (production).
 *
 * HUMAN-ONLY. The flag is the review: branch protection on `main` requires a
 * human review, and this script is it. It refuses to run without the flag and
 * never runs from Cursor Automations.
 *
 * Checks (in order):
 *   1. `main` has not diverged from `stage` (hotfix direto em main exige antes
 *      merge/rebase de main em stage + CI stage green de novo).
 *   2. Latest ci-stage run on `stage` is green.
 *   3. Creates the PR stage→main if none is open, then requires the PR checks
 *      (ci-pr: checks + migration-lock) green before merging.
 *   4. Merges. Labels on done issues gain `in-prod` for the promoted range.
 */

import { execFileSync } from 'node:child_process'

import { dieAgent, gh, ghJson, parseArgs } from './lib/agent-github.mjs'

const die = dieAgent('promote')
const { flags } = parseArgs(process.argv.slice(2), new Set())

if (flags['i-am-human'] !== true) {
  die(
    'Refused: promote is human-only. Re-run as a human with:\n' +
      '  pnpm agent:promote -- --i-am-human\n' +
      'Agents stop at merge-to-stage. Promote moves stage → main → produção (Vercel).',
  )
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
git(['fetch', 'origin', 'main', 'stage'])

// 1. Divergence: main must be an ancestor of stage.
try {
  git(['merge-base', '--is-ancestor', 'origin/main', 'origin/stage'])
} catch {
  die(
    '`main` divergiu de `stage` (hotfix direto em main?). Antes do promote:\n' +
      '  git checkout stage && git merge origin/main && git push origin stage\n' +
      '…e espere o CI stage ficar verde de novo.',
  )
}

// 2. CI stage green on the stage head.
const stageSha = git(['rev-parse', 'origin/stage'])
const stageRuns = ghJson([
  'run',
  'list',
  '--branch',
  'stage',
  '--workflow',
  'ci-stage.yml',
  '--limit',
  '5',
  '--json',
  'headSha,status,conclusion,url',
])
const latestStageRun = stageRuns.find((run) => run.headSha === stageSha)
if (!latestStageRun || latestStageRun.status !== 'completed' || latestStageRun.conclusion !== 'success') {
  die(
    `CI stage não está verde no head de stage (${stageSha.slice(0, 8)}). ` +
      `Último run: ${latestStageRun ? `${latestStageRun.status}/${latestStageRun.conclusion} — ${latestStageRun.url}` : 'nenhum'}`,
  )
}
console.log('[agent:promote] CI stage green ✓')

// 3. PR stage → main.
let pr = ghJson([
  'pr',
  'list',
  '--state',
  'open',
  '--base',
  'main',
  '--head',
  'stage',
  '--json',
  'number,url',
])[0]
if (!pr) {
  const url = gh([
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    'stage',
    '--title',
    `Promote stage → main (${new Date().toISOString().slice(0, 10)})`,
    '--body',
    'Promote humano via `pnpm agent:promote --i-am-human`. CI stage green verificado antes da criação.',
  ])
  pr = { number: url.split('/').pop(), url }
  console.log(`[agent:promote] created PR ${pr.url}`)
} else {
  console.log(`[agent:promote] reusing open PR ${pr.url}`)
}

// 4. PR checks green, then merge (the human running this script IS the review
//    required by main's branch protection; --admin applies that judgment).
const checks = ghJson(['pr', 'checks', String(pr.number), '--json', 'name,state'])
const notGreen = checks.filter((check) => check.state !== 'SUCCESS')
if (notGreen.length > 0) {
  die(
    `PR #${pr.number} ainda tem checks não-verdes: ${notGreen
      .map((check) => `${check.name}=${check.state}`)
      .join(', ')}. Espere o ci-pr terminar e re-rode o promote.`,
  )
}

gh(['pr', 'merge', String(pr.number), '--admin', '--merge'])
console.log(`[agent:promote] merged stage → main via PR #${pr.number}. Deploy Vercel a caminho.`)
