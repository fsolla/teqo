/**
 * Pure helpers for the OPS106 auto-unblock reactor (fail-closed glue between
 * `.github/workflows/auto-unblock.yml`, `scripts/auto-unblock.mjs` and the
 * detached `scripts/auto-unblock-agent.mjs`). No I/O: every decision the
 * reactor makes is a pure function here so the unit suite can pin the
 * guardrails without a GitHub token, Docker or opencode.
 */

import { join } from 'node:path'

import { databaseHostname, isLocalDatabaseUrl, TEST_DATABASE_NAME_RE } from './cli.mjs'
import { isGeneratedDatabaseName } from './worktree-env.mjs'

/** The single label identifying a single-flight token Issue. */
export const UNBLOCK_LABEL = 'auto-unblock'

/** Fail-closed marker used when the agent could not deliver a PR. */
export const UNBLOCK_BLOCKED_LABEL = 'blocked'

/**
 * Orphan-token TTL. Only consulted when the flock is FREE (no wrapper alive):
 * a live agent always holds the lock, so a busy lock is never overridden by
 * the TTL — the agent cap (`auto-unblock-agent.mjs`, 4h) always wins.
 */
export const UNBLOCK_TOKEN_TTL_MS = 3 * 60 * 60 * 1000

/**
 * Locate the `opencode` executable for headless launches. The self-hosted
 * runner service does not source the interactive shell profile, so
 * `$HOME/.opencode/bin` is absent from its PATH — the OPS106 agent died with
 * exit 127 (`timeout: failed to run command 'opencode'`) on the homeserver
 * even though opencode was installed for the runner user
 * (`unblock-35101121310.log`). Resolution order: explicit `OPENCODE_BIN`, a
 * path-like argv0, the default install dir under HOME, then the PATH entries.
 * Returns null when nothing matches — the caller fails closed instead of
 * spawning a doomed `timeout ... opencode`.
 *
 * @param {{ argv0?: string, env?: Record<string, string | undefined>, home?: string, exists?: (path: string) => boolean }} [options]
 * @returns {string | null}
 */
export const resolveOpenCodeBinary = ({
  argv0 = 'opencode',
  env = {},
  home = '',
  exists = () => false,
} = {}) => {
  if (env.OPENCODE_BIN) return env.OPENCODE_BIN
  if (argv0.includes('/')) return argv0
  const candidates = []
  if (home) candidates.push(join(home, '.opencode', 'bin', argv0))
  for (const dir of String(env.PATH ?? '').split(':')) {
    if (dir) candidates.push(join(dir, argv0))
  }
  return candidates.find((candidate) => exists(candidate)) ?? null
}

/**
 * Local ports that are only ever the homeserver's stack DB proxies — defense
 * in depth on top of the name check; the owner of the mapping is
 * `scripts/deploy-homeserver.sh` (TEQO_BUILD_PROXY_PORT per environment).
 */
const STACK_PROXY_PORTS = new Set(['5433', '5434'])

/**
 * Single-flight decision table. `lockBusy` comes from `flock -n` in
 * `scripts/auto-unblock.sh`; `openToken` is the presence of an open
 * `UNBLOCK_LABEL` Issue; `tokenAgeMs` its age (Date.now - createdAt).
 *
 * | lockBusy | openToken | tokenAge | ação          |
 * | -------- | --------- | -------- | ------------- |
 * | true     | true      | qualquer | skip_comment  | (agente ativo — nunca enfileira)
 * | true     | false     | qualquer | skip          | (corrida de lock — sem token para comentar)
 * | false    | false     | qualquer | start         |
 * | false    | true      | < TTL    | skip_comment  | (órfão imaturo — evita thrash)
 * | false    | true      | >= TTL   | reclaim       | (órfão velho — fecha e começa de novo)
 * @param {{ lockBusy?: boolean, openToken?: boolean, tokenAgeMs?: number | null, ttlMs?: number }} [options]
 */
export const decideUnblock = ({
  lockBusy,
  openToken = false,
  tokenAgeMs = null,
  ttlMs = UNBLOCK_TOKEN_TTL_MS,
} = {}) => {
  if (lockBusy) {
    return openToken
      ? { action: 'skip_comment', reason: 'agent-active' }
      : { action: 'skip', reason: 'lock-raced' }
  }
  if (!openToken) return { action: 'start', reason: 'clear' }
  // Unknown age (missing/unparseable createdAt) is treated as stale: the lock
  // is free, so no agent is alive and reclaiming is the fail-closed move.
  if (typeof tokenAgeMs !== 'number' || !Number.isFinite(tokenAgeMs)) {
    return { action: 'reclaim', reason: 'orphan-token-age-unknown' }
  }
  if (tokenAgeMs >= ttlMs) return { action: 'reclaim', reason: 'orphan-token-stale' }
  return { action: 'skip_comment', reason: 'orphan-token-fresh' }
}

/**
 * The DEPLOY run only earns an agent when the `verify` job itself failed.
 * `workflow_run.conclusion == 'failure'` is true for a red staging/production
 * too (secrets, runner, rollback), and those are explicitly out of scope.
 * @param {Array<{ name?: string, conclusion?: string | null, htmlUrl?: string, steps?: Array<{ name?: string, conclusion?: string | null }> }>} [jobs]
 */
export const classifyDeployFailure = (jobs = []) => {
  const list = Array.isArray(jobs) ? jobs : []
  const failedJobs = list
    .filter((job) => job?.conclusion === 'failure')
    .map((job) => ({
      name: job.name ?? '',
      url: job.htmlUrl ?? '',
      steps: (Array.isArray(job.steps) ? job.steps : [])
        .filter((step) => step?.conclusion === 'failure')
        .map((step) => step.name ?? ''),
    }))
  const verify = list.find((job) => job?.name === 'verify')
  return { verifyFailed: verify?.conclusion === 'failure', failedJobs }
}

const evaluateOne = (label, url, { requireTestName = false } = {}) => {
  const problems = []
  if (!url) return [`${label}: DATABASE_URL ausente`]
  if (!isLocalDatabaseUrl(url)) {
    problems.push(`${label}: host não-local (${databaseHostname(url) ?? 'inparseável'})`)
  }
  let name = null
  let port = ''
  try {
    const parsed = new URL(url)
    name = parsed.pathname.replace(/^\/+/, '')
    port = parsed.port
  } catch {
    problems.push(`${label}: URL inparseável`)
    return problems
  }
  if (!isGeneratedDatabaseName(name)) {
    problems.push(`${label}: banco '${name}' fora do padrão teqo_wt<slot>[_test]`)
  } else if (requireTestName && !TEST_DATABASE_NAME_RE.test(name)) {
    problems.push(`${label}: banco de teste '${name}' precisa terminar em _test`)
  }
  if (STACK_PROXY_PORTS.has(port)) {
    problems.push(`${label}: porta ${port} é o proxy do stack (prod/staging)`)
  }
  return problems
}

/**
 * Fail-closed database guard for the agent's provisioned env. Host check alone
 * is not enough on the homeserver: the stack proxies rewrite the host to
 * 127.0.0.1, so the generated NAME (`teqo_wt<slot>[_test]`) is the contract
 * that keeps the agent away from `teqo_1313`/`teqo_staging`.
 */
export const evaluateDatabaseTargets = ({ devUrl, testUrl } = {}) => {
  const problems = [
    ...evaluateOne('.env.local', devUrl),
    ...evaluateOne('.env.test.local', testUrl, { requireTestName: true }),
  ]
  return { ok: problems.length === 0, problems }
}

/** `DATABASE_URL=...` from a generated worktree env file (last line wins). */
export const databaseUrlFromEnvText = (text) => {
  let found = null
  for (const line of String(text ?? '').split('\n')) {
    const match = /^DATABASE_URL=(.+)$/.exec(line.trim())
    if (match) found = match[1].trim()
  }
  return found
}

/**
 * The bug report handed to the agent as the `/bug-fix` argument. Self-contained
 * by design: the agent is headless, may not have `gh`, and must never need a
 * human to know which run failed or where its guardrails are.
 * @param {{ runUrl?: string, runId?: string, sha?: string, failedJobs?: Array<{ name?: string, steps?: string[] }>, repo?: string }} [options]
 */
export const buildBugReport = ({
  runUrl = '',
  runId = '',
  sha = '',
  failedJobs = [],
  repo = 'fsolla/teqo',
} = {}) => {
  const jobLines = failedJobs.map(
    (job) =>
      `- ${job.name}${job.steps?.length ? ` (steps com falha: ${job.steps.join(', ')})` : ''}`,
  )
  return [
    'Falha do job `verify` do deploy (GitHub Actions) — desbloqueie o deploy.',
    '',
    `Run vermelho: ${runUrl}`,
    `Run id: ${runId}`,
    `Commit: ${sha}`,
    '',
    'Jobs com falha:',
    ...(jobLines.length > 0 ? jobLines : ['- (não informado pela API)']),
    '',
    'Como investigar os logs:',
    `- Com gh: \`gh run view ${runId} --log-failed --repo ${repo}\``,
    `- Sem gh: \`curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/${repo}/actions/runs/${runId}/logs -o /tmp/run-${runId}.zip\` e descompacte em /tmp/run-${runId}.`,
    '',
    'Regras desta sessão autônoma:',
    '- NÃO há humano disponível: não peça aprovação nem pare para perguntar — decida com a evidência.',
    '- Siga a skill /bug-fix de ponta a ponta (reproduzir → causa-raiz → fix + teste de regressão → verificação).',
    '- NUNCA toque produção/staging: não leia `~/stack/*.env`, não use `teqo_1313`/`teqo_staging`, não defina ALLOW_REMOTE_DB.',
    '- Feche com `pnpm push` e um PR Ready base `main`; o auto-merge nativo arma sozinho quando o required check ficar verde. NÃO aprove produção.',
    '- Não feche a Issue do disparo — o wrapper do auto-unblock cuida dela.',
  ].join('\n')
}

/** Title of the single-flight token Issue (pt-BR, user-visible). */
export const tokenTitle = ({ runId = '', sha = '' } = {}) =>
  `Auto-unblock: verify falhou no deploy run ${runId}${sha ? ` (${sha.slice(0, 7)})` : ''}`

/**
 * Body of the single-flight token Issue.
 * @param {{ runUrl?: string, runId?: string, sha?: string, failedJobs?: Array<{ name?: string }>, logPath?: string }} [options]
 */
export const tokenBody = ({
  runUrl = '',
  runId = '',
  sha = '',
  failedJobs = [],
  logPath = '',
} = {}) => {
  const jobLines = failedJobs.map((job) => `- ${job.name}`)
  return [
    'Token visível do **single-flight** do agente de desbloqueio (OPS106): enquanto esta Issue',
    'estiver aberta, uma nova falha do `verify` **não** dispara outro agente — no máximo comenta aqui.',
    '',
    `- Run vermelho: ${runUrl}`,
    `- Run id: ${runId}`,
    `- Commit: ${sha}`,
    ...(jobLines.length > 0 ? ['- Jobs com falha:', ...jobLines] : []),
    ...(logPath ? [`- Log do agente: \`${logPath}\``] : []),
    '',
    'O agente roda no homeserver com banco de teste local (`teqo_wt*`) e abre um PR `fix/*`.',
    'Se ele terminar sem PR, esta Issue recebe o label `blocked` para intervenção humana.',
  ].join('\n')
}

/**
 * Outcome classification after the agent wrapper exits.
 * @param {{ exitCode?: number | null, pullRequest?: { htmlUrl?: string, number?: number } | null }} [options]
 */
export const classifyOutcome = ({ exitCode = null, pullRequest = null } = {}) =>
  pullRequest ? { status: 'pr-opened', exitCode, pullRequest } : { status: 'no-pr', exitCode }

/**
 * The report the wrapper prints in the token after a completed agent run.
 * @param {{ status: string, exitCode?: number | null, branch?: string, pullRequest?: { htmlUrl?: string, number?: number } | null, logPath?: string }} options
 */
export const outcomeComment = ({
  status,
  exitCode = null,
  branch = '',
  pullRequest = null,
  logPath = '',
}) =>
  status === 'pr-opened'
    ? [
        `Agente concluído (exit ${exitCode}). PR aberto: ${pullRequest?.htmlUrl ?? pullRequest?.number ?? ''}`,
        '',
        `Branch: \`${branch}\``,
        `Log: \`${logPath}\``,
      ].join('\n')
    : [
        `Agente terminou SEM PR (exit ${exitCode}).`,
        '',
        `Branch: \`${branch}\``,
        `Log: \`${logPath}\``,
        '',
        'Intervenção humana necessária: inspecione o log e a branch; o token fica aberto como `blocked`',
        'e nenhuma nova falha do `verify` dispara agente enquanto ele estiver aberto.',
      ].join('\n')

/**
 * Parse of the machine-readable directive `scripts/worktree.mjs --headless`
 * writes to a file. Tolerant to surrounding blank lines; fail-high on a
 * malformed payload (a new agent must never launch with an unknown dir/argv).
 */
export const parseHeadlessDirective = (text) => {
  const line = String(text ?? '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1)
  if (!line) throw new Error('diretiva headless ausente')
  const parsed = JSON.parse(line)
  if (
    !parsed ||
    typeof parsed.dir !== 'string' ||
    parsed.dir.length === 0 ||
    typeof parsed.branch !== 'string' ||
    parsed.branch.length === 0 ||
    !Array.isArray(parsed.argv)
  ) {
    throw new Error('diretiva headless inválida (dir/branch/argv)')
  }
  if (parsed.argv.length === 0) throw new Error('diretiva headless sem argv')
  return parsed
}
