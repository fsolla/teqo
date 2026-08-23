/**
 * `pnpm agent:pool` — agent pool supervisor CLI
 * (docs/plans/agent-pool-orchestrator.md).
 *
 * The pool keeps up to POOL_MAX_SLOTS (default 5) Cursor Cloud Agents running
 * agent-work-issue over `ready` autonomous-eligible issues. The supervisor is
 * REMOTE: a stateless GitHub Actions tick (`.forgejo/workflows/agent-pool.yml`,
 * removed OPS65 — pool dormant) runs `workflow --action …` / `tick --live`; humans
 * drive it via `gh workflow run` (canonical channel). Local usage is inspection +
 * dispatch:
 *
 *   pnpm agent:pool -- status             # config, slots, fila elegível
 *   pnpm agent:pool -- tick --dry-run     # reconcilia SEM escrever nada
 *   pnpm agent:pool -- doctor             # pré-requisitos (gh, variables, CURSOR_API_KEY, modelos)
 *   pnpm agent:pool -- start|stop|pause|resume [-- --ref <branch>] [-- --max-slots N]
 *
 * Promote is not part of the pool — workers PR directly to main.
 * (legacy; removed from the happy path).
 */

import { appendFileSync } from 'node:fs'
import {
  buildClaimQueue,
  dieAgent,
  issuesById,
  labelNames,
  parseArgs,
} from './lib/agent-forgejo.mjs'

import {
  archiveCursorAgent,
  cancelCursorRun,
  createCursorAgent,
  CursorApiError,
  cursorApiMe,
  getCursorAgent,
  getCursorRun,
  listCursorModels,
} from './lib/agent-pool-cursor.mjs'
import { buildPoolQueue, isAutonomousClaimable } from './lib/agent-pool-eligibility.mjs'
import {
  blockIssueFromPool,
  claimIssueForPool,
  commentPoolEvent,
  countOpenSchemaPrs,
  listInProgressIssues,
  listIssueComments,
  listOpenPrs,
  prClosingIssue,
  readPoolVariables,
  rollbackPoolClaim,
  writePoolVariable,
} from './lib/agent-pool-forgejo.mjs'
import { resolvePoolModel } from './lib/agent-pool-models.mjs'
import { buildPoolWorkerPrompt, extractPlanPath } from './lib/agent-pool-prompt.mjs'
import {
  classifyPoolClaim,
  computeSpawnPlan,
  countPoolFailures,
  decidePoolAutoStop,
  parsePoolConfig,
  parsePoolEvents,
  POOL_OCCUPIED_CLASSES,
  POOL_VARIABLE_NAMES,
  reconcilePoolClaims,
} from './lib/agent-pool-state.mjs'
import { githubApi as api } from './lib/github-api.mjs'

const REPO_URL = 'https://github.com/fsolla/teqo'
const POOL_BASE_REF = 'main'

const die = dieAgent('pool')
const { flags, positional } = parseArgs(
  process.argv.slice(2),
  new Set(['action', 'actor', 'max-slots', 'ref']),
)
const command = positional[0]

const log = (message) => console.log(`[agent:pool] ${message}`)

// Job summary: in GitHub Actions every tick appends a markdown report; local
// runs just skip it. The summary IS the remote status surface in the browser.
const summaryLines = []
const summary = (line) => {
  if (process.env.GITHUB_STEP_SUMMARY) summaryLines.push(line)
}
const flushSummary = (title) => {
  if (process.env.GITHUB_STEP_SUMMARY && summaryLines.length > 0) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## ${title} (${new Date().toISOString()})\n\n${summaryLines.join('\n')}\n\n`,
    )
  }
}

const loadClaimQueue = async () =>
  buildClaimQueue(
    await api.listIssues({ state: 'open', labels: 'ready', limit: 200 }),
    await issuesById(),
  )

/**
 * Derive every pool claim from issue labels + pool-worker comment markers,
 * enriched with live Cursor run statuses when the API key is around.
 *
 * Self-healing: a claim whose spawn event never landed (tick crashed between
 * create and comment) is recovered via the deterministic `bc-<workerUuid>`
 * agentId. Duplicates (only possible via dashboard manipulation) get the
 * newer runs cancelled. `live` gates every WRITE (heal comment, cancels) —
 * dry-run only reads.
 */
const derivePoolClaims = async ({ live }) => {
  const openPrs = await listOpenPrs()
  const hasKey = Boolean(process.env.CURSOR_API_KEY)
  const claims = []
  for (const issue of await listInProgressIssues()) {
    const events = parsePoolEvents(await listIssueComments(issue.number))
    if (!events.some((event) => event.event === 'claim')) continue

    if (!events.some((event) => event.event === 'spawn') && hasKey) {
      const latestClaim = events.filter((event) => event.event === 'claim').at(-1)
      if (latestClaim?.worker) {
        try {
          const agent = await getCursorAgent(`bc-${latestClaim.worker}`)
          if (agent?.id) {
            const spawn = {
              event: 'spawn',
              agentId: agent.id,
              runId: agent.latestRunId ?? null,
              url: agent.url,
            }
            events.push(spawn)
            if (live) {
              await commentPoolEvent(
                issue.number,
                spawn,
                `Worker do pool (recuperado pelo tick): ${agent.url}`,
              )
            }
            log(`  heal #${issue.number}: spawn recuperado via agentId ${agent.id}`)
          }
        } catch {
          // Agent never created — classification decides via the spawn grace.
        }
      }
    }

    const spawns = events.filter((event) => event.event === 'spawn')
    if (spawns.length > 1 && hasKey && live) {
      for (const extra of spawns.slice(1)) {
        if (extra.agentId && extra.runId) {
          await cancelCursorRun(extra.agentId, extra.runId).catch(() => {})
          log(`  duplicata em #${issue.number}: run ${extra.runId} cancelada.`)
        }
      }
    }

    const spawn = spawns[0]
    let latestRunStatus = null
    if (spawn?.agentId && hasKey) {
      try {
        const runId = spawn.runId ?? (await getCursorAgent(spawn.agentId)).latestRunId
        if (runId) latestRunStatus = (await getCursorRun(spawn.agentId, runId)).status ?? null
      } catch {
        latestRunStatus = null
      }
    }

    claims.push({
      issue,
      events,
      classification: classifyPoolClaim({
        events,
        issueDone: labelNames(issue).includes('done'),
        hasOpenPr: Boolean(prClosingIssue(openPrs, issue.number)),
        runStatus: latestRunStatus,
      }),
    })
  }
  return claims
}

const describeClaim = ({ issue, classification }) => {
  const state = classification?.class ?? '?'
  const reason = classification?.reason ? ` (${classification.reason})` : ''
  const agent = classification?.agentId ? ` agent:${classification.agentId}` : ''
  return `#${issue.number} ${issue.title} — ${state}${reason}${agent}`
}

const runStatus = async () => {
  const config = parsePoolConfig(await readPoolVariables({ strict: false }))
  log(
    `pool: ${config.enabled ? 'LIGADO' : 'desligado'}${config.paused ? ' (pausado — audit solitário)' : ''}` +
      ` maxSlots=${config.maxSlots}` +
      (config.startedAt ? ` desde ${config.startedAt} por ${config.startedBy ?? '?'}` : ''),
  )

  // Status is a best-effort inspection tool: every section degrades with a
  // warn instead of dying, so a limited token still gets the rest of the
  // picture. The tick stays strict (it rehearses the live supervisor).
  try {
    const claims = await derivePoolClaims({ live: false })
    const active = claims.filter((claim) => POOL_OCCUPIED_CLASSES.has(claim.classification?.class))
    log(`\nslots: ${active.length}/${config.maxSlots} ocupados`)
    if (claims.length === 0) {
      log('  (nenhuma Issue claimada pelo pool)')
    }
    for (const claim of claims) log(`  ${describeClaim(claim)}`)
  } catch (error) {
    console.error(`[agent:pool] aviso: claims indisponíveis — ${error.message}`)
  }

  try {
    const migrationBusy = (await countOpenSchemaPrs()) > 0
    const { eligible, excluded } = buildPoolQueue(await loadClaimQueue(), { migrationBusy })
    log(
      `\nfila elegível: ${eligible.length}${migrationBusy ? ' (migration-busy: PR de schema aberto)' : ''}`,
    )
    for (const { entry, hasPlan } of eligible) {
      log(
        `  #${entry.issue.number} [${entry.priority}]${entry.meta.model ? ` model:${entry.meta.model}` : ''} ${entry.issue.title}${hasPlan ? '' : ' (sem plano docs/plans — warn)'}`,
      )
    }
    for (const { entry, reason } of excluded) {
      log(`  excluída #${entry.issue.number} ${entry.issue.title} — ${reason}`)
    }
  } catch (error) {
    console.error(`[agent:pool] aviso: fila indisponível — ${error.message}`)
  }
}

/**
 * Spawn one worker for an already-claimed issue. The claim marker's worker
 * UUID doubles as the idempotent `agentId` — a tick retried after a crash
 * gets a 409 and recovers the existing agent instead of duplicating it.
 */
const spawnPoolWorker = async ({ entry, workerUuid, models }) => {
  const chosen = resolvePoolModel(entry.meta.model, models)
  if (chosen.warn) log(`  aviso: ${chosen.warn}`)
  const prompt = buildPoolWorkerPrompt({
    issueNumber: entry.issue.number,
    issueTitle: entry.issue.title,
    issueId: entry.meta.id ?? null,
    planPath: extractPlanPath(entry.issue.body),
    modelSlug: entry.meta.model ?? null,
  })
  const agentId = `bc-${workerUuid}`
  try {
    const { agent, run } = await createCursorAgent({
      prompt: { text: prompt },
      model: chosen.model,
      name: `pool-i${entry.issue.number}-${workerUuid.slice(0, 8)}`,
      agentId,
      repos: [{ url: REPO_URL, startingRef: POOL_BASE_REF }],
      autoCreatePR: false,
    })
    await commentPoolEvent(
      entry.issue.number,
      { event: 'spawn', agentId: agent.id, runId: run.id, url: agent.url },
      `Worker do pool em execução: ${agent.url}`,
    )
    const modelLabel = chosen.model.params?.length
      ? `${chosen.model.id}(${chosen.model.params.map((param) => `${param.id}=${param.value}`).join(',')})`
      : chosen.model.id
    log(`  spawn #${entry.issue.number} → ${agent.url} (modelo ${modelLabel})`)
  } catch (error) {
    if (error instanceof CursorApiError && error.status === 409) {
      const existing = await getCursorAgent(agentId)
      await commentPoolEvent(
        entry.issue.number,
        {
          event: 'spawn',
          agentId: existing.id,
          runId: existing.latestRunId ?? null,
          url: existing.url,
        },
        `Worker do pool (recuperado após 409): ${existing.url}`,
      )
      log(`  spawn #${entry.issue.number} já existia (409) — recuperado: ${existing.url}`)
      return
    }
    await rollbackPoolClaim(entry.issue.number, `spawn falhou (${error.message})`)
    await commentPoolEvent(
      entry.issue.number,
      { event: 'failure', reason: 'spawn-error' },
      'Pool-supervisor: spawn falhou — claim revertido para `ready`.',
    )
    log(`  spawn #${entry.issue.number} falhou (${error.message}) — claim revertido.`)
  }
}

const runTick = async ({ dryRun }) => {
  summary(`- modo: **${dryRun ? 'dry-run' : 'LIVE'}**`)
  const config = parsePoolConfig(await readPoolVariables({ strict: !dryRun }))
  log(
    `tick (${dryRun ? 'dry-run' : 'LIVE'}) — enabled=${config.enabled} paused=${config.paused} maxSlots=${config.maxSlots}`,
  )
  if (!config.enabled) {
    log('pool desligado — nada a fazer.')
    summary('- pool **desligado** — nada a fazer')
    flushSummary('agent:pool tick')
    return
  }
  if (config.paused) {
    log('pool pausado (audit solitário) — nada a fazer.')
    summary('- pool **pausado** (audit solitário) — nada a fazer')
    flushSummary('agent:pool tick')
    return
  }

  const claims = await derivePoolClaims({ live: !dryRun })
  for (const claim of claims) log(`  claim ${describeClaim(claim)}`)

  // Reconcile first: terminal failures leave the queue for human triage and
  // merged workers free their agent — then the gap math sees the truth.
  const reconciliation = reconcilePoolClaims(claims)
  for (const claim of reconciliation.failures) {
    const reason = claim.classification?.reason ?? 'desconhecida'
    if (dryRun) {
      log(`  falha ${describeClaim(claim)} → bloquearia + arquivaria`)
      summary(`- falha #${claim.issue.number} (${reason}) → blocked + archive`)
      continue
    }
    await commentPoolEvent(
      claim.issue.number,
      { event: 'failure', reason, agentId: claim.classification?.agentId ?? null },
      `Pool-supervisor: falha terminal do worker (${reason}) — a Issue vai a \`blocked\` para triagem humana (ver runs em cursor.com/agents).`,
    )
    blockIssueFromPool(claim.issue.number)
    if (claim.classification?.agentId) {
      await archiveCursorAgent(claim.classification.agentId).catch(() => {})
    }
    log(`  falha ${describeClaim(claim)} → blocked + archive`)
    summary(`- falha #${claim.issue.number} (${reason}) → blocked + archive`)
  }
  for (const claim of reconciliation.freed) {
    const spawn = claim.events.find((event) => event.event === 'spawn')
    if (!dryRun && spawn?.agentId) {
      await archiveCursorAgent(spawn.agentId).catch(() => {})
    }
    log(`  merge concluído #${claim.issue.number} — slot livre, agente arquivado.`)
    summary(`- #${claim.issue.number} mergeada em main — slot livre`)
  }

  const active = reconciliation.active
  const migrationBusy = (await countOpenSchemaPrs()) > 0
  const { eligible, excluded } = buildPoolQueue(await loadClaimQueue(), { migrationBusy })
  const plan = computeSpawnPlan({
    eligible,
    activeCount: active.length,
    maxSlots: config.maxSlots,
  })
  log(
    `ativos=${active.length} elegíveis=${eligible.length} gap=${plan.gap}` +
      (migrationBusy ? ' (migration-busy)' : ''),
  )
  summary(
    `- slots: **${active.length}/${config.maxSlots}** ocupados · elegíveis: ${eligible.length} · gap: ${plan.gap}${migrationBusy ? ' · migration-busy' : ''}`,
  )

  if (dryRun) {
    for (const { entry } of plan.toSpawn) {
      log(`  spawnaria #${entry.issue.number} [${entry.priority}] ${entry.issue.title}`)
    }
  } else {
    const models = process.env.CURSOR_API_KEY
      ? ((await listCursorModels()).items ?? [])
      : die('CURSOR_API_KEY ausente — tick live impossível (spawn/archive dependem dela).')
    const tickIso = new Date().toISOString()
    for (const { entry } of plan.toSpawn) {
      // Circuit breaker per candidate: comments are already read here for the
      // claim marker, so counting past failures costs nothing extra.
      const failures = countPoolFailures(parsePoolEvents(listIssueComments(entry.issue.number)))
      const verdict = isAutonomousClaimable(entry, {
        migrationBusy,
        poolFailureCount: failures,
      })
      if (!verdict.ok) {
        log(`  skip #${entry.issue.number} — ${verdict.reason}`)
        summary(`- skip #${entry.issue.number} (${verdict.reason})`)
        continue
      }
      const claim = await claimIssueForPool(entry.issue.number, { tickIso })
      if (!claim.ok) {
        log(`  #${entry.issue.number} claim perdido (${claim.reason}) — próxima da fila.`)
        continue
      }
      await spawnPoolWorker({ entry, workerUuid: claim.workerUuid, models })
      summary(`- spawn #${entry.issue.number} (${entry.meta.model ?? 'composer-2.5'})`)
    }
  }

  if (
    decidePoolAutoStop({
      eligibleCount: eligible.length,
      activeCount: active.length,
      excludedReasons: excluded.map((item) => item.reason),
    })
  ) {
    if (dryRun) {
      log('fila drenada e zero ativos — o tick live desligaria o pool (POOL_ENABLED=false).')
    } else {
      await writePoolVariable(POOL_VARIABLE_NAMES.enabled, 'false')
      log('fila drenada e zero ativos — pool desligado automaticamente (POOL_ENABLED=false).')
      summary('- **fila drenada — pool desligado automaticamente**')
    }
  }
  flushSummary('agent:pool tick')
}

/** Entrypoint used by the GitHub Actions workflow (the canonical remote channel). */
const runWorkflow = async ({ action, actor, maxSlots }) => {
  const now = new Date().toISOString()
  switch (action) {
    case 'start': {
      await writePoolVariable(POOL_VARIABLE_NAMES.enabled, 'true')
      await writePoolVariable(POOL_VARIABLE_NAMES.startedAt, now)
      await writePoolVariable(POOL_VARIABLE_NAMES.startedBy, actor || 'desconhecido')
      await writePoolVariable(POOL_VARIABLE_NAMES.paused, 'false')
      if (maxSlots) await writePoolVariable(POOL_VARIABLE_NAMES.maxSlots, String(maxSlots))
      log(`pool ligado por ${actor ?? '?'} (${now})`)
      await runTick({ dryRun: false })
      return
    }
    case 'stop':
      await writePoolVariable(POOL_VARIABLE_NAMES.enabled, 'false')
      log('pool desligado — sem novos spawns; ativos drenam até o merge.')
      summary(`- **stop** por ${actor ?? '?'} (${now}) — sem novos spawns`)
      flushSummary('agent:pool stop')
      return
    case 'pause':
      await writePoolVariable(POOL_VARIABLE_NAMES.paused, 'true')
      log('pool pausado (audit solitário) — sem novos spawns.')
      summary(`- **pause** por ${actor ?? '?'} (${now})`)
      flushSummary('agent:pool pause')
      return
    case 'resume':
      await writePoolVariable(POOL_VARIABLE_NAMES.paused, 'false')
      log('pool retomado.')
      await runTick({ dryRun: false })
      return
    case 'tick':
      await runTick({ dryRun: false })
      return
    case 'status':
      await runStatus()
      return
    default:
      die(`action desconhecida: "${action}" (start|stop|pause|resume|tick|status)`)
  }
}

/** Human-facing wrapper: dispatch the workflow (canonical channel stays remote). */
const dispatchWorkflow = async (action) => {
  const inputs = { action }
  if (action === 'start' && flags['max-slots']) inputs.maxSlots = String(flags['max-slots'])
  await api.workflowDispatch('agent-pool.yml', { ref: flags.ref ?? 'main', inputs })
  log(
    `workflow_dispatch enviado (action=${action}). Acompanhe: ${REPO_URL}/actions?workflow=agent-pool.yml`,
  )
}

const runDoctor = async () => {
  log('doctor — pré-requisitos do pool')
  if (process.env.FORGEJO_API_TOKEN || process.env.GITHUB_TOKEN) {
    log('  token Forgejo: OK (FORGEJO_API_TOKEN ou GITHUB_TOKEN nativo do Actions)')
  } else {
    log('  token Forgejo: AUSENTE (defina FORGEJO_API_TOKEN)')
  }
  if (process.env.POOL_GITHUB_TOKEN) {
    log(
      '  POOL_GITHUB_TOKEN: legado presente no env — ignorar (o pool não usa mais variáveis do GitHub)',
    )
  }
  try {
    const vars = await readPoolVariables()
    log(`  repo variables: OK (${Object.keys(vars).length} lidas)`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(
      `  repo variables: FALHOU (${message}). No Actions, use secrets.POOL_GITHUB_TOKEN (PAT com actions:write + issues:write) — GITHUB_TOKEN costuma 403 em /actions/variables.`,
    )
  }
  if (!process.env.CURSOR_API_KEY) {
    log('  CURSOR_API_KEY: ausente — spawn/archive indisponíveis (status/fila seguem OK)')
    return
  }
  const me = await cursorApiMe()
  log(
    `  CURSOR_API_KEY: OK${me.userEmail ? ` (${me.userEmail})` : me.apiKeyName ? ` (${me.apiKeyName})` : ''}`,
  )
  const { items } = await listCursorModels()
  log(`  /v1/models: ${(items ?? []).length} modelo(s)`)
  for (const model of items ?? []) {
    log(
      `    ${model.id}${(model.aliases ?? []).length > 0 ? ` (aliases: ${model.aliases.join(', ')})` : ''}${(model.parameters ?? []).length > 0 ? ` params: ${model.parameters.map((param) => param.id).join(',')}` : ''}`,
    )
  }
}

if (command === 'status') {
  await runStatus()
} else if (command === 'tick') {
  await runTick({ dryRun: flags['dry-run'] || !flags.live })
} else if (command === 'workflow') {
  await runWorkflow({ action: flags.action, actor: flags.actor, maxSlots: flags['max-slots'] })
} else if (['start', 'stop', 'pause', 'resume'].includes(command)) {
  dispatchWorkflow(command)
} else if (command === 'doctor') {
  await runDoctor()
} else {
  die(
    'Usage: pnpm agent:pool -- status | tick [--dry-run|--live] | doctor | start|stop|pause|resume [--ref <branch>] [--max-slots N]\n' +
      '(o workflow chama: node scripts/agent-pool.mjs workflow --action <ação>)',
  )
}
