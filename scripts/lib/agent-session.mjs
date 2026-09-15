/**
 * OPS110 — sessões persistentes de agente (attach/detach).
 *
 * Pura por contrato: nada aqui faz I/O além de resolver paths (o CLI
 * `scripts/agent-session.mjs` é quem spawna/HTTP). O ciclo: um `opencode serve`
 * compartilhado (loopback por padrão) é dono das sessões; cada run é dirigido
 * por um `opencode run --attach … --auto --command …` destacado (é o `--auto`
 * dele que aprova permissões enquanto o run vive) e observado por um TUI
 * `opencode attach -s <sessionID>` que pode entrar e sair à vontade — sair do
 * cliente nunca encerra o run; encerrar é `stop` (abort via API).
 *
 * O estado por run (`sessionStatePath`) é o índice de endereçamento consumido
 * pelo painel OPS109 (`list --json`): branch/dir/sessionID/url/driverPid/log.
 * Nenhuma credencial é persistida — `OPENCODE_SERVER_PASSWORD`/
 * `OPENCODE_SERVER_USERNAME` vivem só no ambiente; bind fora do loopback sem
 * senha falha fechado (`validateServerBind`).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { slugify } from '../../src/lib/slug.ts'

/** Default host of the shared agent server — loopback only, never `0.0.0.0`. */
export const DEFAULT_AGENT_SERVER_HOST = '127.0.0.1'

/**
 * Default port. Fora da faixa de dev dos worktrees (`3100+slot`, slot ≤ 999 →
 * até 4099) e longe dos servidores que a máquina já pode ter (4096 Zed ACP,
 * 4097 `opencode web` do usuário). `TEQO_AGENT_SERVER_PORT` overrides.
 */
export const DEFAULT_AGENT_SERVER_PORT = 4199

/** State-file schema version — `list --json` carries it for OPS109. */
export const STATE_VERSION = 1

/**
 * Resolve host/port/url for the shared server: explicit flags (`serve
 * --hostname/--port`) > env (`TEQO_AGENT_SERVER_HOST/PORT`) > defaults. Fail
 * high on a non-numeric/out-of-range port — never guess a listening address.
 * @param {{ hostname?: string | null, port?: number | string | null, env?: Record<string, string | undefined> }} [options]
 */
export const resolveServerConfig = ({ hostname = null, port = null, env = process.env } = {}) => {
  const resolvedHostname = hostname ?? env.TEQO_AGENT_SERVER_HOST ?? DEFAULT_AGENT_SERVER_HOST
  const rawPort = port ?? env.TEQO_AGENT_SERVER_PORT ?? DEFAULT_AGENT_SERVER_PORT
  const resolvedPort = Number(rawPort)
  if (!Number.isInteger(resolvedPort) || resolvedPort < 1 || resolvedPort > 65535) {
    throw new Error(`porta inválida para o servidor de sessões: ${rawPort}`)
  }
  return {
    hostname: resolvedHostname,
    port: resolvedPort,
    url: `http://${resolvedHostname}:${resolvedPort}`,
  }
}

/**
 * Loopback spellings only — `0.0.0.0`, hostnames that merely START with `127.`
 * (`127.0.0.1.example.com`) and any routable address are NOT loopback.
 */
export const isLoopbackHost = (hostname) => {
  const host = String(hostname ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1') return true
  return /^127(\.\d{1,3}){3}$/.test(host)
}

/**
 * Fail-closed bind policy: anything beyond loopback requires the opencode
 * server credential (`OPENCODE_SERVER_PASSWORD`); loopback may run without it.
 * Returns true on success so callers can gate the spawn on the exception.
 */
export const validateServerBind = ({ hostname, password }) => {
  if (isLoopbackHost(hostname)) return true
  if (typeof password === 'string' && password.length > 0) return true
  throw new Error(
    `bind em ${hostname} exige credencial: defina OPENCODE_SERVER_PASSWORD (fail-closed fora do loopback)`,
  )
}

/**
 * State dir: `TEQO_AGENT_SESSION_DIR` > `$XDG_STATE_HOME/teqo/agent-sessions` >
 * `~/.local/state/teqo/agent-sessions`.
 * @param {Record<string, string | undefined>} [env]
 */
export const sessionDirFromEnv = (env = process.env) => {
  if (env.TEQO_AGENT_SESSION_DIR) return env.TEQO_AGENT_SESSION_DIR
  const stateHome = env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state')
  return join(stateHome, 'teqo', 'agent-sessions')
}

/** One filename-safe key per branch — `plans/plan-issue-1` → `plans-plan-issue-1`. */
export const sessionSlug = (branch) => slugify(String(branch ?? ''))

/** `<code>-<slug>` claim branch → code; namespace branches (`plans/`, `work/`, `fix/`) → null. */
export const codeFromBranch = (branch) => {
  const match = /^([A-Z][A-Za-z0-9]*)-/.exec(String(branch ?? ''))
  return match ? match[1] : null
}

export const sessionStatePath = ({ sessionDir, branch }) =>
  join(sessionDir, `${sessionSlug(branch)}.json`)

export const serverStatePath = ({ sessionDir }) => join(sessionDir, 'server.json')

export const startLockPath = ({ sessionDir, branch }) =>
  join(sessionDir, `${sessionSlug(branch)}.lock`)

export const driverLogPath = ({ sessionDir, branch }) =>
  join(sessionDir, `${sessionSlug(branch)}.log`)

const assertSessionState = (state) => {
  const invalid = (reason) => {
    throw new Error(`estado de sessão inválido: ${reason}`)
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) invalid('não é objeto')
  if (!Number.isInteger(state.version) || state.version < 1) invalid('version')
  if (typeof state.sessionID !== 'string' || !state.sessionID.startsWith('ses'))
    invalid('sessionID')
  if (typeof state.branch !== 'string' || state.branch.length === 0) invalid('branch')
  if (typeof state.dir !== 'string' || state.dir.length === 0) invalid('dir')
  if (typeof state.url !== 'string' || !state.url.startsWith('http')) invalid('url')
  return state
}

export const serializeSessionState = (state) =>
  `${JSON.stringify(assertSessionState(state), null, 2)}\n`

export const parseSessionState = (text) => {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('estado de sessão inválido: JSON ilegível')
  }
  return assertSessionState(parsed)
}

const assertServerState = (state) => {
  const invalid = (reason) => {
    throw new Error(`estado do servidor inválido: ${reason}`)
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) invalid('não é objeto')
  if (typeof state.url !== 'string' || !state.url.startsWith('http')) invalid('url')
  if (!Number.isInteger(state.port)) invalid('port')
  if (!Number.isInteger(state.pid) || state.pid <= 0) invalid('pid')
  return state
}

export const serializeServerState = (state) =>
  `${JSON.stringify(assertServerState(state), null, 2)}\n`

export const parseServerState = (text) => {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('estado do servidor inválido: JSON ilegível')
  }
  return assertServerState(parsed)
}

/**
 * Skill command per launch purpose — the terminal launch auto-submits it on
 * the server-owned session. `new` deliberately has none ("apenas conversar"):
 * the session is created and attached, no driver.
 */
export const SESSION_COMMAND_BY_PURPOSE = {
  next: 'work-issue',
  plan: 'plan-issue',
  new: null,
  fix: 'bug-fix',
}

/**
 * `{ command, arguments }` for the purpose, or null when there is nothing to
 * auto-submit. `next` carries only a valid claimed issue (`--issue N`), `fix`
 * carries the sanitized bag (quotes/backslashes stripped — the value rides a
 * single argv token), `plan` sends the bare command, unknown purposes degrade
 * to no command (fail-safe, mirrors the old directive).
 * @param {{ purpose?: string, issueNumber?: number | string | null, argument?: string | null }} [options]
 */
export const purposeInvocation = ({ purpose = null, issueNumber = null, argument = null } = {}) => {
  const command = SESSION_COMMAND_BY_PURPOSE[purpose] ?? null
  if (!command) return null
  if (purpose === 'next') {
    const number = Number(issueNumber)
    if (!Number.isInteger(number) || number <= 0) return null
    return { command, arguments: `--issue ${number}` }
  }
  if (purpose === 'fix') {
    // Mesma sanitização da diretiva de launch (fronteira dupla de propósito:
    // o xargs da camada shell e o argv do `opencode run` não honram escapes).
    const sanitized = typeof argument === 'string' ? argument.replace(/["\\]/g, '').trim() : ''
    return { command, arguments: sanitized }
  }
  return { command, arguments: '' }
}

/**
 * argv of the detached run driver (sem o binário — o caller usa
 * `spawn('opencode', …)`). The `--` separator is required so a command
 * argument starting with `-` (`--issue 1019`) is not parsed as an opencode flag
 * by yargs — verified live on 1.18.31. No `-p`: the credential rides
 * `OPENCODE_SERVER_PASSWORD` in the inherited env (never in `ps`).
 * @param {{ url: string, sessionID: string, dir: string, model: string, invocation: { command: string, arguments?: string } | null }} options
 */
export const driverArgs = ({ url, sessionID, dir, model, invocation }) => {
  if (typeof url !== 'string' || url.length === 0) throw new Error('driverArgs: url ausente')
  if (typeof sessionID !== 'string' || sessionID.length === 0) {
    throw new Error('driverArgs: session ausente')
  }
  if (typeof dir !== 'string' || dir.length === 0) throw new Error('driverArgs: dir ausente')
  if (typeof model !== 'string' || model.length === 0) throw new Error('driverArgs: model ausente')
  if (!invocation || typeof invocation.command !== 'string' || invocation.command.length === 0) {
    throw new Error('driverArgs: invocation/comando ausente')
  }
  const argv = [
    'run',
    '--attach',
    url,
    '-s',
    sessionID,
    '--dir',
    dir,
    '--model',
    model,
    '--auto',
    '--command',
    invocation.command,
  ]
  if (invocation.arguments) argv.push('--', invocation.arguments)
  return argv
}

/**
 * Args do TUI anexado, SEM o binário (`opencode attach` não tem
 * `--auto`/`--model` por design; o caller usa `spawn('opencode', …)`).
 */
export const attachArgs = ({ url, sessionID, dir }) => {
  if (typeof url !== 'string' || url.length === 0) throw new Error('attachArgs: url ausente')
  if (typeof sessionID !== 'string' || sessionID.length === 0) {
    throw new Error('attachArgs: session ausente')
  }
  if (typeof dir !== 'string' || dir.length === 0) throw new Error('attachArgs: dir ausente')
  return ['attach', url, '--dir', dir, '-s', sessionID]
}

/** Args do servidor headless, SEM o binário. Nunca `--mdns` (anunciaria na rede). */
export const serverArgs = ({ port, hostname }) => {
  if (!Number.isInteger(port)) throw new Error('serverArgs: porta inválida')
  if (typeof hostname !== 'string' || hostname.length === 0) {
    throw new Error('serverArgs: hostname ausente')
  }
  return ['serve', '--port', String(port), '--hostname', hostname]
}

/**
 * Pick the state a command refers to — `--session` > `--branch` > `--issue` >
 * the current branch. Null when nothing matches (callers print the known refs).
 * @param {{ states: Array<Record<string, unknown>>, session?: string | null, branch?: string | null, issue?: number | string | null, cwdBranch?: string | null }} options
 */
export const resolveSessionRef = ({
  states,
  session = null,
  branch = null,
  issue = null,
  cwdBranch = null,
}) => {
  const list = Array.isArray(states) ? states : []
  if (session) {
    const hit = list.find((state) => state.sessionID === session)
    if (hit) return hit
  }
  if (branch) {
    const hit = list.find((state) => state.branch === branch)
    if (hit) return hit
  }
  const number = issue === null || issue === '' ? null : Number(issue)
  if (Number.isInteger(number) && number > 0) {
    const hit = list.find((state) => state.issue === number)
    if (hit) return hit
  }
  if (cwdBranch) {
    const hit = list.find((state) => state.branch === cwdBranch)
    if (hit) return hit
  }
  return null
}

/**
 * Status shown by `list`: `stopped` (explicit stop) wins, then `unknown`
 * (server unreachable), then `working` (busy on the server or driver alive),
 * else `idle`.
 */
export const deriveSessionStatus = ({ state, serverHealthy, sessionBusy, driverAlive }) => {
  if (state?.stoppedAt) return 'stopped'
  if (!serverHealthy) return 'unknown'
  if (sessionBusy || driverAlive) return 'working'
  return 'idle'
}

/**
 * Versioned machine contract of `list --json` (OPS109 consumes it):
 * `{ version, server, sessions: [{...state, status}] }`.
 */
export const sessionListPayload = ({ states, statuses = {}, server }) => ({
  version: STATE_VERSION,
  server,
  sessions: (Array.isArray(states) ? states : []).map((state) => ({
    ...state,
    status: statuses[state.sessionID] ?? 'unknown',
  })),
})

/** Human `list` lines — one per run, status first, `—` for namespace runs. */
export const formatSessionList = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => {
    const reference =
      [row.code, row.issue ? `#${row.issue}` : null].filter(Boolean).join(' ') || '—'
    return `${String(row.status).padEnd(8)} ${reference}  ${row.sessionID}  ${row.branch}  ${row.dir}`
  })
