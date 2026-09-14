/**
 * Plain-Node CLI (no pnpm) — OPS104 trigger 1 guard. `deploy.yml` starts on
 * every `push` to `main`; this preflight skips the run when another deploy
 * run is already `queued`/`in_progress` (a run `waiting` on the production
 * approval does NOT count — the human gate must not silence a new merge).
 * Manual dispatches never reach the guard: the workflow step is push-only.
 *
 * Fail-open (OPS104 D6): the guard is a dedupe, not a safety gate — an API
 * blip must not silently disable the automatic deploy. Worst case is a
 * redundant `verify` run.
 *
 * Writes `should_deploy=<bool>` to `$GITHUB_OUTPUT`.
 *
 *   node scripts/deploy-preflight.mjs
 */

import { appendFileSync } from 'node:fs'

import { ACTIVE_RUN_STATUSES, decidePreflight } from './lib/deploy-trigger.mjs'
import { createApi } from './lib/github-api.mjs'

const writeOutput = (name, value) => {
  const line = `${name}=${value}`
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
  else console.log(`[deploy-preflight] ${line}`)
}

const main = async () => {
  const eventName = process.env.GITHUB_EVENT_NAME
  if (eventName !== 'push') {
    console.log('[deploy-preflight] dispatch manual — should_deploy=true')
    writeOutput('should_deploy', 'true')
    return
  }

  try {
    const api = createApi({})
    const runs = []
    for (const status of ACTIVE_RUN_STATUSES) {
      runs.push(...(await api.listWorkflowRuns('deploy.yml', { status, branch: 'main' })))
    }
    const verdict = decidePreflight({
      eventName,
      currentRunId: process.env.GITHUB_RUN_ID,
      runs,
    })
    const active =
      verdict.activeRunIds.length > 0 ? ` (ativos: ${verdict.activeRunIds.join(', ')})` : ''
    console.log(
      `[deploy-preflight] ${verdict.reason} — should_deploy=${verdict.shouldDeploy}${active}`,
    )
    writeOutput('should_deploy', String(verdict.shouldDeploy))
  } catch (error) {
    console.warn(
      `[deploy-preflight] falha ao consultar os runs (${error instanceof Error ? error.message : error}) — fail-open, should_deploy=true`,
    )
    writeOutput('should_deploy', 'true')
  }
}

await main()
