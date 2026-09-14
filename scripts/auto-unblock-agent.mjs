#!/usr/bin/env node
/**
 * OPS106 auto-unblock — detached agent wrapper. Spawned by
 * `scripts/auto-unblock.mjs` with the single-flight flock inherited on fd 9,
 * `detached: true` and stdio pointed at the run's log file. It:
 *   1. provisions the `fix/*` worktree through the owner (`scripts/worktree.mjs
 *      fix --headless --directive <file>`) — same path as `pnpm worktree fix`;
 *   2. enforces the fail-closed database guard on the generated env files;
 *   3. runs `opencode run --command bug-fix` with the report and a 4h cap,
 *      PAT-only credentials and no prod/staging env;
 *   4. classifies the outcome (PR found?) and closes/labels the token Issue.
 * The token Issue is handled here — never by the agent — so a dead agent still
 * leaves a visible, human-actionable record.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildBugReport,
  classifyOutcome,
  databaseUrlFromEnvText,
  evaluateDatabaseTargets,
  outcomeComment,
  parseHeadlessDirective,
  UNBLOCK_BLOCKED_LABEL,
} from './lib/auto-unblock.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'
import { createApi } from './lib/github-api.mjs'

const die = dieWithLabel('auto-unblock:agent')

const PROVISION_TIMEOUT_SECONDS = 30 * 60
const AGENT_TIMEOUT_SECONDS = 4 * 60 * 60

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const unblockHome = process.env.TEQO_UNBLOCK_HOME ?? join(process.env.HOME ?? '', 'teqo-unblock')

const say = (message) => console.log(`[auto-unblock:agent] ${message}`)

const { flags } = parseEqualsFlags(process.argv.slice(2))
const tokenIssue = Number(flags.token)
const statePath = typeof flags.state === 'string' ? flags.state : null
if (!Number.isInteger(tokenIssue) || tokenIssue <= 0 || !statePath) {
  die('--state=<path> e --token=<issue> são obrigatórios.')
}

const api = createApi({})

/** Any failure after the token exists must leave it visibly blocked. */
const blockToken = async (message) => {
  try {
    await api.addComment(tokenIssue, message)
    await api.addLabels(tokenIssue, [UNBLOCK_BLOCKED_LABEL])
  } catch (error) {
    say(`falha ao marcar o token como blocked: ${error?.message ?? error}`)
  }
}

let state
try {
  state = JSON.parse(readFileSync(statePath, 'utf8'))
  if (!state?.runId) throw new Error('state sem runId')
} catch (error) {
  await blockToken(`State ilegível (\`${statePath}\`): ${error?.message ?? error}`)
  die(`state inválido: ${error?.message ?? error}`)
}

const runTimed = (label, seconds, command, args, options) => {
  say(`${label} (cap ${seconds}s)`)
  const result = spawnSync(
    'timeout',
    ['--signal=TERM', '--kill-after=120', `${seconds}s`, command, ...args],
    options,
  )
  say(`${label} terminou: status=${result.status} signal=${result.signal ?? 'none'}`)
  if (result.error) say(`${label} erro: ${result.error.message}`)
  return result
}

const main = async () => {
  // opencode refuses to boot with a dangling `{file:...}` MCP reference; the
  // checkout is cleaned every run, so the placeholder is (re)created here and
  // copied into the worktree by the provisioning path.
  const secretsDir = join(repoRoot, '.opencode', 'secrets')
  mkdirSync(secretsDir, { recursive: true })
  const penpotToken = join(secretsDir, 'penpot-token')
  if (!existsSync(penpotToken)) writeFileSync(penpotToken, 'auto-unblock-placeholder\n')

  const report = buildBugReport({
    runUrl: state.runUrl,
    runId: state.runId,
    sha: state.sha,
    failedJobs: state.failedJobs,
    repo: state.repo,
  })

  const directivePath = join(unblockHome, 'state', `directive-${state.runId}.json`)
  const provision = runTimed(
    'provisionamento do worktree fix',
    PROVISION_TIMEOUT_SECONDS,
    process.execPath,
    [
      join(repoRoot, 'scripts', 'worktree.mjs'),
      'fix',
      report,
      '--headless',
      '--directive',
      directivePath,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  )
  if (provision.status !== 0 || !existsSync(directivePath)) {
    await blockToken(
      `Provisionamento do worktree falhou (status ${provision.status}); o agente não foi lançado. Log: \`${state.logPath}\``,
    )
    die('provisionamento falhou — token blocked.')
  }

  const directive = parseHeadlessDirective(readFileSync(directivePath, 'utf8'))
  say(`worktree pronto: ${directive.dir} (branch ${directive.branch})`)

  const targets = evaluateDatabaseTargets({
    devUrl: databaseUrlFromEnvText(readFileSync(join(directive.dir, '.env.local'), 'utf8')),
    testUrl: databaseUrlFromEnvText(readFileSync(join(directive.dir, '.env.test.local'), 'utf8')),
  })
  if (!targets.ok) {
    await blockToken(
      [
        'Guard de banco fail-closed: o ambiente provisionado não é local `teqo_wt*`/`*_test`.',
        '',
        ...targets.problems.map((problem) => `- ${problem}`),
      ].join('\n'),
    )
    die(`guard de banco reprovou: ${targets.problems.join('; ')}`)
  }
  say('guard de banco ok (local + teqo_wt*).')

  const childEnv = { ...process.env }
  for (const key of Object.keys(childEnv)) {
    if (['DATABASE_URL', 'ALLOW_REMOTE_DB', 'TEQO_ENV', 'AUTOMERGE_PAT'].includes(key)) {
      delete childEnv[key]
    }
  }
  // Non-persistent git credential helper: the PAT lives only in the process
  // env (never in .git/config, never in ~/.git-credentials).
  childEnv.GIT_CONFIG_COUNT = '1'
  childEnv.GIT_CONFIG_KEY_0 = 'credential.helper'
  childEnv.GIT_CONFIG_VALUE_0 =
    '!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f'

  const [command, ...args] = directive.argv
  const agentRun = runTimed(
    'opencode run --command bug-fix',
    AGENT_TIMEOUT_SECONDS,
    command,
    args,
    {
      cwd: directive.dir,
      stdio: 'inherit',
      env: childEnv,
    },
  )

  const [owner] = String(state.repo ?? 'fsolla/teqo').split('/')
  const pullRequests = await api.listPullRequests({
    state: 'all',
    head: `${owner}:${directive.branch}`,
  })
  // Exact branch match only: a stale/ignored head filter must never read as
  // "PR opened" (which would close the token on someone else's PR).
  const pullRequest = pullRequests.find((pr) => pr.head.ref === directive.branch) ?? null
  const outcome = classifyOutcome({ exitCode: agentRun.status, pullRequest })

  await api.addComment(
    tokenIssue,
    outcomeComment({
      status: outcome.status,
      exitCode: agentRun.status,
      branch: directive.branch,
      pullRequest,
      logPath: state.logPath,
    }),
  )
  if (outcome.status === 'pr-opened') {
    await api.closeIssue(tokenIssue)
    say(`PR aberto (${pullRequest.htmlUrl ?? pullRequest.number}) — token #${tokenIssue} fechado.`)
  } else {
    await api.addLabels(tokenIssue, [UNBLOCK_BLOCKED_LABEL])
    say(`sem PR — token #${tokenIssue} marcado blocked (gate humano).`)
  }
  process.exit(outcome.status === 'pr-opened' ? 0 : 1)
}

try {
  await main()
} catch (error) {
  await blockToken(
    `Wrapper do agente falhou: \`${error?.message ?? error}\` — log: \`${state.logPath}\``,
  )
  die(error?.stack ?? error?.message ?? String(error))
}
