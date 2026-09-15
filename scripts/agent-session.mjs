#!/usr/bin/env node
/**
 * OPS110 — `pnpm agent:session` (CLI do ciclo de vida de runs persistentes).
 *
 *   pnpm agent:session serve [--hostname=H] [--port=P]
 *       Sobe (ou reaproveita) o `opencode serve` COMPARTILHADO em loopback —
 *       ele é o dono das sessões e sobrevive a qualquer cliente. Bind fora do
 *       loopback exige `OPENCODE_SERVER_PASSWORD` (fail-closed). Nunca `--mdns`.
 *   pnpm agent:session start --purpose=<next|plan|new|fix> --dir=<D> [--model=<M>] [--issue=N] [--argument="<bag>"] [--new] [--hostname=H] [--port=P]
 *       Cria a sessão endereçável, sobe o driver destacado
 *       (`opencode run --attach … --auto --command <skill> -- …`) quando o
 *       purpose tem skill, e abre o TUI anexado (`opencode attach -s <id>`).
 *       Fechar o TUI/terminal NÃO encerra o run; `stop` encerra. Reusa o run
 *       existente quando o driver ainda vive ou a sessão está busy; `--new`
 *       força sessão nova.
 *   pnpm agent:session attach [--session=<ses_…>|--branch=<B>|--issue=N]
 *       (Re)entra na sessão — default: o branch do cwd. Sobe o servidor se
 *       ele estiver fora (o histórico da sessão persiste).
 *   pnpm agent:session stop [--session=<ses_…>|--branch=<B>|--issue=N]
 *       Ato explícito de encerrar: abort via API + fim do driver + `stoppedAt`.
 *   pnpm agent:session list [--json] [--hostname=H] [--port=P]
 *       Estado dos runs (orquestrado pelo `serve`); `--json` é o contrato
 *       versionado que o painel OPS109 consome.
 *
 * Estado por run em `~/.local/state/teqo/agent-sessions/<slug>.json` (índice de
 * endereçamento: branch/dir/sessionID/url/driverPid/log); nenhuma credencial é
 * persistida. Os fatos de semântica (cliente pode morrer, `abort` interrompe,
 * `--` entrega `$ARGUMENTS`) foram verificados na 1.18.31. Flag desconhecida
 * falha alto por verbo (OPS110-F1) — nunca cai num default mudo.
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import {
  attachArgs,
  codeFromBranch,
  deriveSessionStatus,
  driverArgs,
  driverLogPath,
  formatSessionList,
  isStaleLock,
  parseServerState,
  parseSessionState,
  purposeInvocation,
  resolveServerConfig,
  resolveSessionRef,
  resolveStartDecision,
  serializeServerState,
  serializeSessionState,
  serverArgs,
  serverStatePath,
  sessionDirFromEnv,
  sessionListPayload,
  sessionStatePath,
  startLockPath,
  STATE_VERSION,
  validateServerBind,
  validateSessionFlags,
} from './lib/agent-session.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'

const die = dieWithLabel('agent:session')

const USAGE = `Uso: pnpm agent:session <serve|start|attach|stop|list> [flags]

  serve  [--hostname=H] [--port=P]                sobe/reaproveita o opencode serve compartilhado
  start  --purpose=<next|plan|new|fix> --dir=<D> [--model=<M>] [--issue=N] [--argument="<bag>"] [--new] [--hostname=H] [--port=P]
                                                  cria a sessão, sobe o driver destacado e anexa o TUI
  attach [--session=<ses_…>|--branch=<B>|--issue=N]  (re)entra na sessão (default: branch do cwd)
  stop   [--session=<ses_…>|--branch=<B>|--issue=N]  encerra de forma explícita (abort + fim do driver)
  list   [--json] [--hostname=H] [--port=P]        status dos runs registrados

  --model é obrigatório quando o purpose tem skill (next/plan/fix); 'new' não dispara driver.`

/** Loopback by default; the credential rides the env, never the state/log. */
const serverPassword = () => process.env.OPENCODE_SERVER_PASSWORD ?? ''
const authHeaders = () => {
  if (!serverPassword()) return {}
  const username = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
  const token = Buffer.from(`${username}:${serverPassword()}`).toString('base64')
  return { authorization: `Basic ${token}` }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * Probe `/global/health`. Distinguishes "down" (null) from "up but this shell
 * has no credential" ({ authRequired: true }) — the caller can't assume a 401
 * is a different server.
 */
const serverHealth = async (url) => {
  try {
    const response = await fetch(`${url}/global/health`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(1500),
    })
    if (response.status === 401) return { authRequired: true }
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

const cliOpencodeVersion = () => {
  const result = spawnSync('opencode', ['--version'], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

const waitForHealth = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const health = await serverHealth(url)
    if (health?.healthy) return health
    await sleep(250)
  }
  return null
}

/**
 * Spawn destacado com stdio em fd (precedente `scripts/auto-unblock.mjs`): o
 * processo sobrevive ao CLI; só o sucesso do `spawn` é confirmado no pai.
 * Lança (não `die`) para o caller preservar cleanup (lock/fd) antes de sair.
 * @returns {Promise<number>} pid do filho
 */
const spawnDetached = async (command, args, { cwd, logPath, label }) => {
  mkdirSync(dirname(logPath), { recursive: true })
  const logFd = openSync(logPath, 'a')
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })
  try {
    await new Promise((resolveSpawn, rejectSpawn) => {
      child.once('spawn', resolveSpawn)
      child.once('error', rejectSpawn)
    })
  } catch (error) {
    closeSync(logFd)
    throw new Error(`não consegui iniciar ${label}: ${error?.message ?? error}`)
  }
  child.unref()
  closeSync(logFd)
  return child.pid
}

/**
 * Ensure the shared server is up and usable. Reuses a healthy one (idempotent);
 * otherwise validates the bind (fail-closed beyond loopback), spawns it
 * detached with a log, waits for health and records `server.json`.
 */
const ensureServer = async ({ hostname = null, port = null, sessionDir }) => {
  const config = resolveServerConfig({ hostname, port })
  // Fail-closed ANTES do reuse: um servidor já de pé não pode transformar um
  // bind fora do loopback num caminho sem credencial.
  validateServerBind({ hostname: config.hostname, password: serverPassword() })
  const existing = await serverHealth(config.url)
  if (existing?.healthy) return { ...config, version: existing.version ?? null, started: false }
  if (existing?.authRequired) {
    die(
      `o servidor em ${config.url} exige credencial — exporte OPENCODE_SERVER_PASSWORD (a mesma da sessão que o iniciou).`,
    )
  }

  const logPath = join(sessionDir, 'server.log')
  let pid
  try {
    pid = await spawnDetached(
      'opencode',
      serverArgs({ port: config.port, hostname: config.hostname }),
      {
        cwd: sessionDir,
        logPath,
        label: `'opencode serve' (log: ${logPath})`,
      },
    )
  } catch (error) {
    die(error.message)
  }

  const health = await waitForHealth(config.url, 15_000)
  if (!health?.healthy) {
    die(
      `o servidor não ficou saudável em ${config.url} — veja ${logPath} (porta ocupada? use TEQO_AGENT_SERVER_PORT=<outra>).`,
    )
  }
  writeFileSync(
    serverStatePath({ sessionDir }),
    serializeServerState({
      version: STATE_VERSION,
      url: config.url,
      hostname: config.hostname,
      port: config.port,
      pid,
      startedAt: new Date().toISOString(),
      logPath,
    }),
  )
  return { ...config, version: health.version ?? null, started: true }
}

const warnVersionDrift = (serverVersion) => {
  const cliVersion = cliOpencodeVersion()
  if (serverVersion && cliVersion && serverVersion !== cliVersion) {
    console.warn(
      `[agent:session] aviso: servidor em opencode ${serverVersion} e CLI em ${cliVersion} — atualize o CLI ou reinicie o servidor se algo divergir.`,
    )
  }
}

/**
 * JSON request against the server; `null` on connection failure. `tolerant`
 * devolve `null` também para 401/5xx — é o modo do `abort` (o `stop` encerra
 * localmente mesmo sem servidor/credencial); o default morre alto.
 */
const request = async (
  url,
  path,
  { method = 'GET', body, timeoutMs = 10_000, tolerant = false } = {},
) => {
  let response
  try {
    response = await fetch(`${url}${path}`, {
      method,
      headers: {
        ...authHeaders(),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return null
  }
  if (response.status === 401) {
    if (tolerant) return null
    die(
      `o servidor em ${url} exige credencial — exporte OPENCODE_SERVER_PASSWORD (a mesma da sessão que o iniciou).`,
    )
  }
  if (response.status === 404) return { notFound: true }
  if (!response.ok) {
    if (tolerant) return null
    die(`${method} ${path} falhou: HTTP ${response.status}`)
  }
  if (response.status === 204) return {}
  return response.json().catch(() => ({}))
}

const sessionExists = async (url, sessionID) => {
  const result = await request(url, `/session/${sessionID}`)
  return Boolean(result && !result.notFound)
}

const sessionStatuses = async (url) => (await request(url, '/session/status')) ?? {}

const createSession = async (url, dir) => {
  const result = await request(url, `/session?directory=${encodeURIComponent(dir)}`, {
    method: 'POST',
    body: {},
  })
  if (!result?.id) die(`não consegui criar a sessão em ${url} (resposta sem id).`)
  return result.id
}

/** Best-effort: o `stop` encerra o driver local mesmo com servidor fora/401. */
const abortSession = async (url, sessionID) =>
  (await request(url, `/session/${sessionID}/abort`, {
    method: 'POST',
    body: {},
    tolerant: true,
  })) !== null

const pidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * O PID só vale como driver se AINDA for um processo opencode: um estado antigo
 * pode apontar para um PID reciclado, e `stop`/`list` não podem sinalizar (nem
 * marcar como vivo) um processo alheio. Em ambientes sem `/proc` (não-Linux) a
 * verificação é inconclusiva — assume vivo, preservando o comportamento.
 */
const driverAlive = (pid, sessionID = null) => {
  if (!pidAlive(pid)) return false
  try {
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    // O driver é `opencode run --attach … -s <sessionID>`: exigir o sessionID
    // impede confundir o run com o `serve` compartilhado, outro run, o
    // `opencode web` ou o ACP do Zed num PID reciclado. Sem sessionID, o
    // par opencode+run é o melhor filtro disponível.
    if (sessionID) return cmdline.includes(sessionID)
    return cmdline.includes('opencode') && cmdline.includes('run')
  } catch {
    return true
  }
}

/** SIGTERM → grace → SIGKILL. Returns true when a process was signalled. */
const stopDriver = async (pid, { sessionID = null, graceMs = 5000 } = {}) => {
  if (!driverAlive(pid, sessionID)) return false
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return false
  }
  const deadline = Date.now() + graceMs
  while (Date.now() < deadline) {
    if (!driverAlive(pid, sessionID)) return true
    await sleep(100)
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // already gone
  }
  return true
}

const branchOfDir = (dir) => {
  const result = spawnSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  })
  const branch = result.status === 0 ? result.stdout.trim() : ''
  if (!branch || branch === 'HEAD') {
    die(`não consegui resolver o branch de ${dir} — rode dentro de um worktree do repo.`)
  }
  return branch
}

const loadStates = (sessionDir) => {
  if (!existsSync(sessionDir)) return []
  const states = []
  for (const file of readdirSync(sessionDir)) {
    if (!file.endsWith('.json') || file === 'server.json') continue
    try {
      states.push(parseSessionState(readFileSync(join(sessionDir, file), 'utf8')))
    } catch (error) {
      console.warn(`[agent:session] ignorando ${file}: ${error.message}`)
    }
  }
  return states.sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
}

const writeState = (sessionDir, state) => {
  mkdirSync(sessionDir, { recursive: true })
  writeFileSync(
    sessionStatePath({ sessionDir, branch: state.branch }),
    serializeSessionState(state),
  )
  return state
}

const attach = (state) => {
  const result = spawnSync(
    'opencode',
    attachArgs({ url: state.url, sessionID: state.sessionID, dir: state.dir }),
    { cwd: state.dir, stdio: 'inherit' },
  )
  return result.status ?? 0
}

/** `--session` > `--branch` > `--issue` > branch do cwd (o cwd só é lido se preciso). */
const resolveRef = ({ flags, sessionDir }) => {
  const states = loadStates(sessionDir)
  const issue = typeof flags.issue === 'string' ? Number(flags.issue) : null
  const cwdBranch = flags.session || flags.branch || issue ? null : branchOfDir(process.cwd())
  const state = resolveSessionRef({
    states,
    session: flags.session ?? null,
    branch: flags.branch ?? null,
    issue,
    cwdBranch,
  })
  if (!state) {
    const refs = [
      flags.session && `--session=${flags.session}`,
      flags.branch && `--branch=${flags.branch}`,
      flags.issue && `--issue=${flags.issue}`,
      cwdBranch && `branch ${cwdBranch}`,
    ].filter(Boolean)
    die(
      `nenhuma sessão encontrada (${refs.join(', ') || 'sem referência'}) — veja \`pnpm agent:session list\`.`,
    )
  }
  return state
}

/** Single-flight per branch: two `start`s must not create two drivers/sessions. */
const acquireStartLock = ({ sessionDir, branch }) => {
  mkdirSync(sessionDir, { recursive: true })
  const lockPath = startLockPath({ sessionDir, branch })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, 'wx')
      writeFileSync(fd, `${process.pid}\n`)
      return () => {
        try {
          closeSync(fd)
        } catch {
          // already closed
        }
        try {
          unlinkSync(lockPath)
        } catch {
          // already gone
        }
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      let holder = NaN
      try {
        holder = Number(readFileSync(lockPath, 'utf8').trim())
      } catch {
        // unreadable lock — treated as stale by isStaleLock
      }
      if (isStaleLock({ holderPid: holder, isPidAlive: pidAlive })) {
        try {
          unlinkSync(lockPath)
        } catch {
          // raced
        }
        continue
      }
      die(
        `outro 'start' está em andamento para ${branch} (pid ${holder}) — aguarde ou remova ${lockPath}.`,
      )
    }
  }
  die(`não consegui travar o start de ${branch} (${lockPath}) — tente de novo.`)
}

const cmdServe = async (flags) => {
  const sessionDir = sessionDirFromEnv()
  const server = await ensureServer({
    hostname: flags.hostname ?? null,
    port: flags.port ?? null,
    sessionDir,
  })
  warnVersionDrift(server.version)
  console.log(
    `${server.started ? 'servidor iniciado' : 'servidor já está de pé'}: ${server.url}${server.version ? ` (opencode ${server.version})` : ''}`,
  )
  console.log(`  estado: ${sessionDir}`)
}

const cmdStart = async (flags) => {
  const dir = resolve(flags.dir ?? process.cwd())
  const purpose = flags.purpose ?? 'new'
  const sessionDir = sessionDirFromEnv()
  const branch = branchOfDir(dir)
  const model = flags.model ?? null
  const issueNumber = typeof flags.issue === 'string' ? Number(flags.issue) : null
  const invocation = purposeInvocation({
    purpose,
    issueNumber,
    argument: flags.argument ?? null,
  })
  if (invocation && !model) die('--model é obrigatório para iniciar o run (driver).')

  const server = await ensureServer({
    hostname: flags.hostname ?? null,
    port: flags.port ?? null,
    sessionDir,
  })
  warnVersionDrift(server.version)

  const statePath = sessionStatePath({ sessionDir, branch })
  const decideReuse = () =>
    resolveStartDecision({
      forceNew: Boolean(flags.new),
      statePath,
      readFile: (path) => readFileSync(path, 'utf8'),
      exists: existsSync,
      serverUrl: server.url,
      probeBusy: async (sessionID) =>
        (await sessionStatuses(server.url))[sessionID]?.type === 'busy',
      driverAlive,
    })

  // A decisão de reuso acontece DENTRO do lock: dois `start`s concorrentes do
  // mesmo branch não podem ambos ler "não vivo" e criar dois drivers/sessões.
  const release = acquireStartLock({ sessionDir, branch })
  let state
  let reused = false
  try {
    const decision = await decideReuse()
    if (decision.reason === 'unreadable') {
      console.warn(
        `[agent:session] estado ilegível em ${statePath} (${decision.error?.message}) — tratando como sessão nova.`,
      )
    }
    if (decision.action === 'reuse') {
      reused = true
      state = decision.state
    } else {
      const sessionID = await createSession(server.url, dir)
      state = {
        version: STATE_VERSION,
        code: codeFromBranch(branch),
        issue: Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : null,
        purpose,
        branch,
        dir,
        sessionID,
        url: server.url,
        model,
        driverPid: null,
        logPath: driverLogPath({ sessionDir, branch }),
        startedAt: new Date().toISOString(),
        stoppedAt: null,
      }
      if (invocation) {
        state.driverPid = await spawnDetached(
          'opencode',
          driverArgs({ url: server.url, sessionID, dir, model, invocation }),
          { cwd: dir, logPath: state.logPath, label: `o driver do run (log: ${state.logPath})` },
        )
      } else if (purpose !== 'new') {
        console.warn(
          `[agent:session] purpose=${purpose} sem comando/issue válida — sessão criada sem driver.`,
        )
      }
      writeState(sessionDir, state)
    }
  } finally {
    // Released BEFORE the attach: o lock só protege a criação (dois `start`s
    // não podem criar dois drivers/sessões), nunca a duração do TUI.
    release()
  }

  if (reused) {
    console.log(`run já em andamento para ${branch} — anexando (${state.sessionID}).`)
  } else {
    console.log(`sessão ${state.sessionID} em ${server.url} (${purpose}) — log: ${state.logPath}`)
  }
  console.log('sair do TUI não encerra o run; encerrar: `pnpm agent:session stop`')
  return attach(state)
}

const cmdAttach = async (flags) => {
  const sessionDir = sessionDirFromEnv()
  const state = resolveRef({ flags, sessionDir })
  const serverUrl = new URL(state.url)
  await ensureServer({
    hostname: serverUrl.hostname,
    port: Number(serverUrl.port),
    sessionDir,
  })
  if (!(await sessionExists(state.url, state.sessionID))) {
    die(
      `a sessão ${state.sessionID} não existe mais no servidor ${state.url} — inicie um novo run em ${state.dir}.`,
    )
  }
  return attach(state)
}

const cmdStop = async (flags) => {
  const sessionDir = sessionDirFromEnv()
  const state = resolveRef({ flags, sessionDir })
  const aborted = await abortSession(state.url, state.sessionID)
  if (!aborted) {
    console.warn(
      `[agent:session] não consegui falar com o servidor ${state.url} — encerrando o driver local mesmo assim.`,
    )
  }
  const killed = await stopDriver(state.driverPid, { sessionID: state.sessionID })
  writeState(sessionDir, { ...state, driverPid: null, stoppedAt: new Date().toISOString() })
  console.log(
    `run encerrado: ${state.sessionID} (${state.branch})${aborted ? '' : ' [abort offline]'}${killed ? '' : ' [driver já havia saído]'}`,
  )
}

/**
 * Onde o `list` sonda: `server.json` (gravado pelo `serve`, inclusive com
 * `--port/--hostname` explícitos) > env/flags > defaults.
 */
const serverConfigForList = ({ sessionDir, flags }) => {
  const statePath = serverStatePath({ sessionDir })
  if (flags.hostname || flags.port || !existsSync(statePath)) {
    return resolveServerConfig({ hostname: flags.hostname ?? null, port: flags.port ?? null })
  }
  try {
    const server = parseServerState(readFileSync(statePath, 'utf8'))
    return { hostname: server.hostname, port: server.port, url: server.url }
  } catch (error) {
    console.warn(`[agent:session] server.json ilegível (${error.message}) — usando o default.`)
    return resolveServerConfig({})
  }
}

const cmdList = async (flags) => {
  const sessionDir = sessionDirFromEnv()
  const states = loadStates(sessionDir)
  const config = serverConfigForList({ sessionDir, flags })
  const health = await serverHealth(config.url)
  const serverHealthy = Boolean(health?.healthy)
  const statuses = serverHealthy ? await sessionStatuses(config.url) : {}
  const derived = {}
  for (const state of states) {
    derived[state.sessionID] = deriveSessionStatus({
      state,
      serverHealthy,
      sessionBusy: statuses[state.sessionID]?.type === 'busy',
      driverAlive: driverAlive(state.driverPid, state.sessionID),
    })
  }
  if (flags.json) {
    console.log(
      JSON.stringify(
        sessionListPayload({
          states,
          statuses: derived,
          server: {
            url: config.url,
            healthy: serverHealthy,
            version: health?.version ?? null,
          },
        }),
        null,
        2,
      ),
    )
    return
  }
  if (states.length === 0) {
    console.log(`nenhuma sessão registrada em ${sessionDir}`)
    return
  }
  console.log('STATUS   REF  SESSÃO  BRANCH  DIR  LOG')
  for (const line of formatSessionList(
    states.map((state) => ({ ...state, status: derived[state.sessionID] })),
  )) {
    console.log(line)
  }
  if (!serverHealthy) {
    console.log(
      health?.authRequired
        ? '(servidor de pé mas exige credencial: exporte OPENCODE_SERVER_PASSWORD)'
        : `(servidor fora: ${config.url} — suba com \`pnpm agent:session serve\`)`,
    )
  }
}

const { flags, positional } = parseEqualsFlags(process.argv.slice(2))
const subcommand = positional[0]

try {
  if (positional.length > 1) {
    die(
      `argumento posicional inesperado: ${positional.slice(1).join(' ')} (use --flag=valor; veja o USAGE).`,
    )
  }
  try {
    validateSessionFlags({ subcommand, flags })
  } catch (error) {
    die(`${error.message} Veja o USAGE: \`pnpm agent:session\`.`)
  }
  if (subcommand === 'serve') await cmdServe(flags)
  else if (subcommand === 'start') {
    process.exitCode = await cmdStart(flags)
  } else if (subcommand === 'attach') {
    process.exitCode = await cmdAttach(flags)
  } else if (subcommand === 'stop') await cmdStop(flags)
  else if (subcommand === 'list') await cmdList(flags)
  else {
    console.log(USAGE)
    process.exitCode = 1
  }
} catch (error) {
  if (error?.stderr) die(error.stderr.toString().trim())
  die(error?.message ?? String(error))
}
