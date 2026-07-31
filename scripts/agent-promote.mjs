/**
 * `pnpm agent:promote -- --i-am-human` — manual override: promote `stage` → `main`.
 *
 * Normal path: `promote-stage-to-main.yml` auto-merges when ci-stage is green.
 * Use this only when the workflow failed or you need to promote out of band.
 *
 * Checks (in order):
 *   1. `main` has not diverged from `stage` (hotfix direto em main exige antes
 *      merge/rebase de main em stage + CI stage green de novo).
 *   2. Latest ci-stage run on `stage` is green.
 *   3. Creates the PR stage→main if none is open, then merges (ci-stage is the
 *      pre-promote gate; ci.yml on main is the post-merge safety net).
 */

import { execFileSync } from 'node:child_process'

import { dieAgent, gh, ghJson, parseArgs } from './lib/agent-github.mjs'

const die = dieAgent('promote')
const { flags } = parseArgs(process.argv.slice(2), new Set())

if (flags['i-am-human'] !== true) {
  die(
    'Refused: promote override is human-only. Re-run as a human with:\n' +
      '  pnpm agent:promote -- --i-am-human\n' +
      'Auto-promote runs via promote-stage-to-main.yml when ci-stage is green.',
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
if (
  !latestStageRun ||
  latestStageRun.status !== 'completed' ||
  latestStageRun.conclusion !== 'success'
) {
  die(
    `CI stage não está verde no head de stage (${stageSha.slice(0, 8)}). ` +
      `Último run: ${latestStageRun ? `${latestStageRun.status}/${latestStageRun.conclusion} — ${latestStageRun.url}` : 'nenhum'}`,
  )
}
console.log('[agent:promote] CI stage green ✓')

// 3. PR stage → main (create if needed).
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
    'Override manual via `pnpm agent:promote --i-am-human`. CI stage green verificado antes do merge.',
  ])
  pr = { number: url.split('/').pop(), url }
  console.log(`[agent:promote] created PR ${pr.url}`)
} else {
  console.log(`[agent:promote] reusing open PR ${pr.url}`)
}

// 4. Merge (ci-stage was the pre-promote gate; ci.yml on main is the post-merge safety net).
gh(['pr', 'merge', String(pr.number), '--admin', '--merge'])
console.log(`[agent:promote] merged stage → main via PR #${pr.number}. Deploy Vercel a caminho.`)
