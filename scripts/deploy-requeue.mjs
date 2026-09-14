/**
 * Plain-Node CLI (no pnpm) — OPS104 trigger 2. Runs hosted after a green
 * `deploy-staging`: if `main` advanced while the run was in flight, dispatch
 * a new `deploy.yml` from the new head. `workflow_dispatch` is the documented
 * anti-recursion exception, so the built-in `GITHUB_TOKEN` (`actions: write`)
 * suffices — no PAT.
 *
 * Fail-red (OPS104 D6): a failure here would leave staging stale in silence —
 * exit 1 makes it visible (the operator re-dispatches by hand).
 *
 *   node scripts/deploy-requeue.mjs
 */

import { decideRequeue } from './lib/deploy-trigger.mjs'
import { createApi } from './lib/github-api.mjs'

const main = async () => {
  const runSha = process.env.GITHUB_SHA
  const api = createApi({})
  const head = await api.getBranchHead('main')
  if (!head?.sha) {
    throw new Error('head de main não encontrado — requeue não verificado')
  }
  const verdict = decideRequeue({ runSha, headSha: head.sha })
  if (verdict.reason === 'sha-ausente') {
    throw new Error(`SHA do run ausente (GITHUB_SHA) — requeue não verificado`)
  }
  if (!verdict.dispatch) {
    console.log(`[deploy-requeue] ${verdict.reason} — sem dispatch`)
    return
  }
  await api.workflowDispatch('deploy.yml', { ref: 'main' })
  console.log(`[deploy-requeue] main avançou (${runSha} → ${head.sha}) — deploy.yml re-dispatchado`)
}

try {
  await main()
} catch (error) {
  console.error(`[deploy-requeue] falhou: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
