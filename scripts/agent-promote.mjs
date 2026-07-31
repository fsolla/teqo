/**
 * `pnpm agent:promote -- --i-am-human` — manual override: promote `stage` → `main`.
 *
 * Normal path: `promote-stage-to-main.yml` auto-merges when ci-stage is green on
 * the current stage head. Use this when the workflow failed or you need to promote
 * out of band — including when stage head is red but an older commit on stage
 * already passed ci-stage.
 *
 * Checks (in order):
 *   1. `main` has not diverged from `stage` (hotfix direto em main exige merge
 *      de main em stage antes).
 *   2. Newest commit on `origin/main..origin/stage` with a successful ci-stage run.
 *   3. PR into `main` from `stage` (head green) or `promote/last-green` (older green).
 *   4. Merge (ci-stage on the promoted SHA is the pre-promote gate; ci.yml on main
 *      is the post-merge safety net).
 */

import { execFileSync } from 'node:child_process'

import { dieAgent, gh, ghJson, parseArgs } from './lib/agent-github.mjs'
import {
  findLastGreenPromoteSha,
  greenCiStageHeadShas,
  PROMOTE_GREEN_BRANCH,
} from './lib/agent-promote-target.mjs'

const die = dieAgent('promote')
const { flags } = parseArgs(process.argv.slice(2), new Set())

if (flags['i-am-human'] !== true) {
  die(
    'Refused: promote override is human-only. Re-run as a human with:\n' +
      '  pnpm agent:promote -- --i-am-human\n' +
      'Auto-promote runs via promote-stage-to-main.yml when ci-stage is green on stage head.',
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

const stageSha = git(['rev-parse', 'origin/stage'])
const mainSha = git(['rev-parse', 'origin/main'])

if (stageSha === mainSha) {
  die(`main já está no head de stage (${stageSha.slice(0, 8)}) — nada a promover.`)
}

const commitsAhead = git(['log', `origin/main..origin/stage`, '--format=%H'])
  .split('\n')
  .filter(Boolean)

const stageRuns = ghJson([
  'run',
  'list',
  '--branch',
  'stage',
  '--workflow',
  'ci-stage.yml',
  '--limit',
  '100',
  '--json',
  'headSha,status,conclusion,url',
])

const promoteSha = findLastGreenPromoteSha(commitsAhead, greenCiStageHeadShas(stageRuns))

if (!promoteSha) {
  die(
    `Nenhum commit em stage à frente de main tem ci-stage verde (stage head ${stageSha.slice(0, 8)}). ` +
      'Corrija stage ou espere um run verde antes do promote.',
  )
}

const promoteRun = stageRuns.find(
  (run) => run.headSha === promoteSha && run.status === 'completed' && run.conclusion === 'success',
)

if (promoteSha === stageSha) {
  console.log(`[agent:promote] CI stage green no head de stage (${stageSha.slice(0, 8)}) ✓`)
} else {
  console.log(
    `[agent:promote] stage head ${stageSha.slice(0, 8)} não está verde; ` +
      `promovendo último commit ci-stage green ${promoteSha.slice(0, 8)} ✓`,
  )
  if (promoteRun?.url) {
    console.log(`[agent:promote] run: ${promoteRun.url}`)
  }
}

const prHead = promoteSha === stageSha ? 'stage' : PROMOTE_GREEN_BRANCH

if (prHead !== 'stage') {
  execFileSync(
    'git',
    ['push', 'origin', `${promoteSha}:refs/heads/${PROMOTE_GREEN_BRANCH}`, '--force'],
    {
      stdio: 'inherit',
    },
  )
}

// 3. PR → main (create if needed).
let pr = ghJson([
  'pr',
  'list',
  '--state',
  'open',
  '--base',
  'main',
  '--head',
  prHead,
  '--json',
  'number,url',
])[0]

if (!pr && prHead !== 'stage') {
  const staleStagePr = ghJson([
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
  if (staleStagePr) {
    console.log(
      `[agent:promote] fechando PR #${staleStagePr.number} stage→main (head vermelho; promote em ${promoteSha.slice(0, 8)})`,
    )
    gh(['pr', 'close', String(staleStagePr.number)])
  }
}

if (!pr) {
  const body =
    promoteSha === stageSha
      ? 'Override manual via `pnpm agent:promote --i-am-human`. CI stage green no head de stage.'
      : `Override manual via \`pnpm agent:promote --i-am-human\`. Promove ci-stage green \`${promoteSha.slice(0, 8)}\` (stage head \`${stageSha.slice(0, 8)}\` não está verde).`
  const url = gh([
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    prHead,
    '--title',
    `Promote stage → main (${new Date().toISOString().slice(0, 10)})`,
    '--body',
    body,
  ])
  pr = { number: url.split('/').pop(), url }
  console.log(`[agent:promote] created PR ${pr.url}`)
} else {
  console.log(`[agent:promote] reusing open PR ${pr.url}`)
}

// 4. Merge (ci-stage on promoteSha was the pre-promote gate; ci.yml on main is the safety net).
gh(['pr', 'merge', String(pr.number), '--admin', '--merge'])
console.log(
  `[agent:promote] merged ${prHead} (${promoteSha.slice(0, 8)}) → main via PR #${pr.number}. Deploy Vercel a caminho.`,
)
