#!/usr/bin/env node
/**
 * OPS106 auto-unblock — synchronous orchestrator. Runs on the homeserver
 * inside `.github/workflows/auto-unblock.yml` (via `scripts/auto-unblock.sh`,
 * which holds the single-flight flock across the detached agent). Decides,
 * creates the visible token Issue and spawns the detached wrapper; it never
 * runs the agent itself, so the runner slot is released in ~1 minute.
 *
 * Env from the workflow:
 *   GITHUB_TOKEN    built-in token (actions:read, issues:write) for run/token reads
 *   AUTOMERGE_PAT   real-user PAT handed ONLY to the detached agent (push/PR/outcome)
 *   RUN_ID/RUN_URL/RUN_SHA   the failed Deploy run
 *
 * Flags:
 *   --lock-busy=0|1   flock state from scripts/auto-unblock.sh
 *   --check           homeserver bootstrap smoke (fail-closed, actionable output)
 *   --dry-run         decide and print; never create/comment/spawn
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  classifyDeployFailure,
  decideUnblock,
  tokenBody,
  tokenTitle,
  UNBLOCK_BLOCKED_LABEL,
  UNBLOCK_LABEL,
} from './lib/auto-unblock.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'
import { parsePostgresContainerHealth, SHARED_POSTGRES_CONTAINER } from './lib/db-start.mjs'
import { createApi } from './lib/github-api.mjs'

const die = dieWithLabel('auto-unblock')

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const unblockHome = process.env.TEQO_UNBLOCK_HOME ?? join(homedir(), 'teqo-unblock')
const stateDir = join(unblockHome, 'state')
const logsDir = join(unblockHome, 'logs')
const lockFile = process.env.TEQO_UNBLOCK_LOCK ?? '/tmp/teqo-unblock.lock'

const { flags } = parseEqualsFlags(process.argv.slice(2))
const say = (message) => console.log(`[auto-unblock] ${message}`)

const repoFullName = () => process.env.GITHUB_REPOSITORY ?? 'fsolla/teqo'

/** `auto-unblock` label is ensured idempotently (POST 422 on an existing one). */
const ensureLabel = async (api) => {
  if (await api.getLabel(UNBLOCK_LABEL)) return
  try {
    await api.createLabel(UNBLOCK_LABEL, {
      color: '5319E7',
      description: 'Token visível do agente de desbloqueio (OPS106)',
    })
  } catch {
    // concurrent create — fall through to the read-back below
  }
  if (!(await api.getLabel(UNBLOCK_LABEL))) {
    throw new Error(`label '${UNBLOCK_LABEL}' ausente e não foi possível criar (issues:write?).`)
  }
}

const run = (command, args) => spawnSync(command, args, { encoding: 'utf8', timeout: 30_000 })

const port5432State = async () => {
  // Reuses the db-start owner's parser and container name; a Docker daemon
  // that is down fails here instead of silently reading as "port free".
  const inspect = run('docker', [
    'inspect',
    '--format',
    '{{json .State}}',
    SHARED_POSTGRES_CONTAINER,
  ])
  if (inspect.status === 0) {
    const state = parsePostgresContainerHealth(inspect.stdout)
    if (state?.running !== true) {
      throw new Error(`container ${SHARED_POSTGRES_CONTAINER} existe mas não está rodando`)
    }
    return `container ${SHARED_POSTGRES_CONTAINER} (${state.health || 'running'})`
  }
  if (!`${inspect.stderr ?? ''}`.includes('No such object')) {
    throw new Error(`docker inspect falhou: ${`${inspect.stderr ?? ''}`.trim().split('\n')[0]}`)
  }
  const free = await new Promise((resolvePort) => {
    const socket = connect({ host: '127.0.0.1', port: 5432 })
    socket.once('connect', () => {
      socket.destroy()
      resolvePort(false)
    })
    socket.once('error', () => resolvePort(true))
  })
  if (!free) {
    throw new Error(`porta 5432 ocupada por um processo que não é o ${SHARED_POSTGRES_CONTAINER}`)
  }
  return 'porta 5432 livre'
}

/** `--check`: homeserver bootstrap smoke — every failure is actionable. */
const runCheck = async () => {
  const failures = []
  const check = async (name, fn) => {
    try {
      const detail = await fn()
      console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
    } catch (error) {
      failures.push(name)
      console.log(`FAIL ${name} — ${error?.message ?? String(error)}`)
    }
  }
  const version =
    (command, args = ['--version']) =>
    () => {
      const result = run(command, args)
      if (result.error) throw result.error
      if (result.status !== 0) throw new Error(`${command} saiu com ${result.status}`)
      return (result.stdout || result.stderr || '').trim().split('\n')[0]
    }

  await check('node >= 24', () => {
    const major = Number(process.versions.node.split('.')[0])
    if (major < 24) throw new Error(`node ${process.versions.node}`)
    return process.versions.node
  })
  await check('git', version('git'))
  await check('pnpm', version('pnpm'))
  await check('flock', version('flock'))
  await check('timeout', version('timeout'))
  await check('docker', version('docker'))
  await check('docker daemon', () => {
    const result = run('docker', ['info'])
    if (result.status !== 0) {
      throw new Error(`${`${result.stderr ?? ''}`.trim().split('\n')[0] || 'docker info falhou'}`)
    }
    return 'daemon acessível'
  })
  await check('deps do repo', () => {
    // The detached wrapper runs `node scripts/worktree.mjs` from the checkout,
    // which imports dotenv/pg at load; the workflow installs them before the
    // launcher (actions/checkout cleans node_modules on the self-hosted runner).
    for (const relative of [
      'node_modules/dotenv',
      'node_modules/pg',
      'node_modules/.bin/payload',
    ]) {
      if (!existsSync(join(repoRoot, relative))) {
        throw new Error(`${relative} ausente — rode \`pnpm install --frozen-lockfile\``)
      }
    }
    return 'node_modules ok'
  })
  await check('opencode', version('opencode'))
  await check('opencode auth', () => {
    const dataHome = process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')
    const authFile = join(dataHome, 'opencode', 'auth.json')
    const credentials = JSON.parse(readFileSync(authFile, 'utf8'))
    const providers = Object.keys(credentials ?? {})
    if (providers.length === 0) {
      throw new Error('auth.json vazio — rode `opencode auth login` no usuário do runner')
    }
    return providers.join(', ')
  })
  await check('porta 5432', port5432State)
  await check('dirs graváveis', () => {
    for (const dir of [logsDir, stateDir, join(unblockHome, 'worktrees')]) {
      mkdirSync(dir, { recursive: true })
      accessSync(dir, constants.W_OK)
    }
    return unblockHome
  })

  const api = createApi({})
  await check('GITHUB_TOKEN (built-in)', async () => {
    const repository = await api.getRepository()
    return repository.fullName
  })
  await check('AUTOMERGE_PAT com push', async () => {
    const pat = process.env.AUTOMERGE_PAT
    if (!pat) throw new Error('AUTOMERGE_PAT ausente no ambiente')
    const patApi = createApi({ token: pat })
    const repository = await patApi.getRepository()
    if (!repository.permissions.push) throw new Error('PAT sem permissão de push')
    return 'permissions.push'
  })
  await check(`label ${UNBLOCK_LABEL}`, async () => {
    await ensureLabel(api)
    return UNBLOCK_LABEL
  })

  if (failures.length > 0) {
    die(`--check reprovou: ${failures.join(', ')}`)
  }
  say('--check ok — bootstrap do homeserver completo')
}

const commentSkip = (api, token, { runUrl, runId, reason }) =>
  api.addComment(
    token.number,
    [
      `Nova falha do \`verify\` (run ${runId}: ${runUrl}) — **não** dispara outro agente.`,
      `Motivo: ${reason}. Esta Issue segue como token do single-flight.`,
    ].join('\n'),
  )

const main = async () => {
  mkdirSync(stateDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })

  if (flags.check === true) {
    await runCheck()
    return
  }

  const runId = process.env.RUN_ID
  const runUrl = process.env.RUN_URL ?? ''
  const sha = process.env.RUN_SHA ?? ''
  if (!runId) die('RUN_ID ausente (definido por .github/workflows/auto-unblock.yml).')

  const api = createApi({})
  const failure = classifyDeployFailure(await api.getWorkflowRunJobs(runId))
  if (!failure.verifyFailed) {
    say(`run ${runId}: o job verify não falhou — nada a desbloquear.`)
    return
  }

  const openTokens = await api.listIssues({ state: 'open', labels: UNBLOCK_LABEL })
  const token = openTokens[0] ?? null
  const decision = decideUnblock({
    lockBusy: flags['lock-busy'] === '1',
    openToken: Boolean(token),
    tokenAgeMs: token ? Date.now() - Date.parse(token.createdAt) : null,
  })
  say(`run ${runId}: decisão '${decision.action}' (${decision.reason}).`)

  if (flags['dry-run'] === true) {
    say(`dry-run: nada criado/comentado; a ação seria '${decision.action}'.`)
    return
  }

  if (decision.action === 'skip') return

  if (decision.action === 'skip_comment') {
    if (token) {
      await commentSkip(api, token, {
        runUrl,
        runId,
        reason:
          decision.reason === 'agent-active'
            ? 'single-flight: agente em execução'
            : 'token órfão recente (aguardando o TTL para reclaim)',
      })
    }
    return
  }

  if (decision.action === 'reclaim') {
    await api.addComment(
      token.number,
      'Token considerado órfão (lock livre há mais que o TTL) — reclamando para um novo agente.',
    )
    await api.closeIssue(token.number)
  }

  await ensureLabel(api)
  const logPath = join(logsDir, `unblock-${runId}.log`)
  const created = await api.createIssue({
    title: tokenTitle({ runId, sha }),
    body: tokenBody({
      runUrl,
      runId,
      sha,
      failedJobs: failure.failedJobs,
      logPath,
    }),
  })
  await api.addLabels(created.number, [UNBLOCK_LABEL])

  const pat = process.env.AUTOMERGE_PAT
  if (!pat) {
    await api.addComment(
      created.number,
      'AUTOMERGE_PAT ausente no ambiente do runner — o agente não pode fazer push/PR. Fail-closed.',
    )
    await api.addLabels(created.number, [UNBLOCK_BLOCKED_LABEL])
    die('AUTOMERGE_PAT ausente — agente não disparado (token marcado blocked).')
  }

  const statePath = join(stateDir, `unblock-${runId}.json`)
  writeFileSync(
    statePath,
    `${JSON.stringify(
      {
        runId,
        runUrl,
        sha,
        repo: repoFullName(),
        tokenIssue: created.number,
        failedJobs: failure.failedJobs,
        logPath,
      },
      null,
      2,
    )}\n`,
  )

  // The lock file must be HELD (by our own inherited fd 9): a probe opening a
  // new description can only fail to acquire when someone holds it. This is
  // stronger than an fd-existence check and catches the bypass path (running
  // the orchestrator without `scripts/auto-unblock.sh`).
  const lockProbe = run('flock', ['-n', lockFile, '-c', 'true'])
  if (lockProbe.error) die(`flock indisponível: ${lockProbe.error.message}`)
  if (lockProbe.status === 0) {
    await api.addComment(
      created.number,
      'flock do single-flight NÃO está preso — rode via `scripts/auto-unblock.sh`. Fail-closed.',
    )
    await api.addLabels(created.number, [UNBLOCK_BLOCKED_LABEL])
    die('lock do single-flight não preso — o agente não pode ser disparado.')
  }

  const childEnv = { ...process.env, GITHUB_TOKEN: pat, TEQO_UNBLOCK_HOME: unblockHome }
  delete childEnv.AUTOMERGE_PAT
  childEnv.WORKTREES_ROOT = join(unblockHome, 'worktrees')
  for (const key of Object.keys(childEnv)) {
    if (['DATABASE_URL', 'ALLOW_REMOTE_DB', 'TEQO_ENV', 'RUNNER_TRACKING_ID'].includes(key)) {
      delete childEnv[key]
    }
    // Runner runtime tokens must not leak into a process that outlives the job.
    if (key.startsWith('ACTIONS_')) delete childEnv[key]
  }

  const logFd = openSync(logPath, 'a')
  const child = spawn(
    process.execPath,
    [
      join(repoRoot, 'scripts', 'auto-unblock-agent.mjs'),
      `--state=${statePath}`,
      `--token=${created.number}`,
    ],
    {
      cwd: repoRoot,
      detached: true,
      // fd 9 (inherited from auto-unblock.sh) keeps the flock for the agent's
      // whole lifetime; stdio goes to the log file so the step never waits on
      // its stdout pipe and the runner cannot reap the orphan.
      stdio: ['ignore', logFd, logFd, 9],
      env: childEnv,
    },
  )
  // Fail-closed: only report success after the OS confirmed the spawn; a
  // failure marks the token blocked instead of leaving it silently open.
  try {
    await new Promise((resolveSpawn, rejectSpawn) => {
      child.once('spawn', resolveSpawn)
      child.once('error', rejectSpawn)
    })
  } catch (error) {
    await api.addComment(created.number, `Falha ao disparar o agente: ${error?.message ?? error}`)
    await api.addLabels(created.number, [UNBLOCK_BLOCKED_LABEL])
    die(`spawn do agente falhou: ${error?.message ?? error}`)
  }
  child.unref()
  say(`agente disparado (pid ${child.pid}); token #${created.number}; log ${logPath}`)
}

try {
  await main()
} catch (error) {
  die(error?.stack ?? error?.message ?? String(error))
}
