/**
 * Forgejo IO wrappers for the agent pool supervisor. Pure logic lives in
 * agent-pool-state.mjs / agent-pool-eligibility.mjs; the Cursor REST client in
 * agent-pool-cursor.mjs. Everything here goes through scripts/lib/forgejo-api.mjs
 * — no GitHub/gh dependency, same contract the pool had against `gh`.
 *
 * Pool state (was: repo Actions variables) lives in `pool-state.json` on the
 * dedicated branch `pool-state` (Forgejo 9 exposes variables read-only via API
 * — creation is 405; the contents API gives us read/write without git).
 */

import { randomUUID } from 'node:crypto'

import { labelNames } from './agent-forgejo.mjs'
import { formatPoolEvent } from './agent-pool-state.mjs'
import { forgejoApi as api } from './forgejo-api.mjs'

const POOL_STATE_FILE = 'pool-state.json'
const POOL_STATE_BRANCH = 'pool-state'

/**
 * Pool variables as a plain map from `pool-state.json` on the `pool-state`
 * branch. Non-strict mode degrades to `{}` + a warn: inspection commands
 * (status, dry-run tick) still work and the resulting config is the disabled
 * default — the fail-closed direction. The live tick stays strict: if the
 * supervisor cannot read its own config it must stop loudly, never guess.
 */
export const readPoolVariables = async ({ strict = true } = {}) => {
  try {
    const { content } = await api.getFileContents(POOL_STATE_FILE, POOL_STATE_BRANCH)
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    if (strict) throw error
    console.error(
      '[agent:pool] aviso: pool-state.json ilegível (branch pool-state ausente?) — usando defaults (pool desligado).',
    )
    return {}
  }
}

/** Create or update one pool variable in pool-state.json (POST create, PUT update). */
export const writePoolVariable = async (name, value) => {
  const current = await readPoolVariables()
  const next = { ...current, [name]: value }
  const message = `[agent:pool] ${name}=${value}`
  try {
    await api.updateFile(POOL_STATE_FILE, {
      message,
      content: JSON.stringify(next, null, 2) + '\n',
      branch: POOL_STATE_BRANCH,
      sha: (await api.getFileContents(POOL_STATE_FILE, POOL_STATE_BRANCH)).sha,
    })
  } catch (error) {
    if (/404|object does not exist/i.test(error.message)) {
      await api.createFile(POOL_STATE_FILE, {
        message,
        content: JSON.stringify(next, null, 2) + '\n',
        branch: POOL_STATE_BRANCH,
      })
    } else {
      throw error
    }
  }
}

export const listInProgressIssues = () =>
  api.listIssues({ state: 'open', labels: 'in-progress', limit: 200 })

export const listIssueComments = (number) => api.listIssueComments(number)

export const listOpenPrs = () => api.listPullRequests({ state: 'open', limit: 100 })

/** The open PR whose body closes this issue (`Closes #N` / `Fixes #N`), if any. */
export const prClosingIssue = (prs, issueNumber) =>
  prs.find((pr) => new RegExp(`(?:closes|fixes) #${issueNumber}\\b`, 'i').test(pr.body ?? '')) ??
  null

// Path predicate for "schema-touching PR" — the pool serializes migration
// spawns while one is open (the CI migration-lock was removed 2026-08-12).
const SCHEMA_PR_PATH = /^(src\/migrations\/|src\/payload-types\.ts$|payload-types\.ts$)/

export const countOpenSchemaPrs = async () => {
  const prs = await api.listPullRequests({ state: 'open', limit: 100 })
  let count = 0
  for (const pr of prs) {
    const files = await api.listPullRequestFiles(pr.number).catch(() => null)
    if ((files ?? []).some((file) => SCHEMA_PR_PATH.test(file.filename ?? ''))) count += 1
  }
  return count
}

/** Comment on an issue with human text plus the machine-readable pool marker. */
export const commentPoolEvent = (number, event, text) =>
  api.addComment(number, `${text} ${formatPoolEvent(event)}`)

/**
 * Coordinated claim (plan §4): the supervisor is the single allocator. Re-read
 * the issue (same optimistic lock as agent:claim), flip ready→in-progress and
 * leave the claim marker with the worker UUID the spawn will reuse as the
 * idempotent `agentId`. Returns `{ ok, workerUuid }` or `{ ok: false }` when
 * the race was lost — the tick just moves to the next queue entry.
 */
export const claimIssueForPool = async (number, { tickIso }) => {
  const fresh = await api.getIssue(number)
  const labels = labelNames(fresh)
  if (fresh.state !== 'OPEN' || !labels.includes('ready') || labels.includes('in-progress')) {
    return { ok: false, reason: 'lost-race' }
  }
  await api.setLabels(number, { add: ['in-progress'], remove: ['ready'] })
  const workerUuid = randomUUID()
  await commentPoolEvent(
    number,
    { event: 'claim', tick: tickIso, worker: workerUuid },
    `Claimed pelo pool-supervisor (tick ${tickIso}) — worker em spawn.`,
  )
  return { ok: true, workerUuid }
}

/** Undo the claim when the spawn itself failed — the issue goes back to ready. */
export const rollbackPoolClaim = async (number, note) => {
  await api.setLabels(number, { add: ['ready'], remove: ['in-progress'] })
  return api.addComment(number, `Pool-supervisor: claim revertido — ${note}`)
}

/**
 * Failure path: a terminally failed worker's issue leaves the claim queue for
 * human triage. The pool only ever blocks issues IT claimed (claim marker).
 */
export const blockIssueFromPool = (number) =>
  api.setLabels(number, { add: ['blocked'], remove: ['in-progress'] })
