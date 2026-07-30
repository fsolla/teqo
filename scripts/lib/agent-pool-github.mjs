/**
 * gh-CLI IO wrappers for the agent pool supervisor. Pure logic lives in
 * agent-pool-state.mjs / agent-pool-eligibility.mjs; the Cursor REST client in
 * agent-pool-cursor.mjs. Everything here shells the authenticated `gh` — no
 * GitHub token of its own, same contract as agent-github.mjs.
 */

import { randomUUID } from 'node:crypto'

import { gh, ghJson, labelNames, setLabels } from './agent-github.mjs'
import { formatPoolEvent } from './agent-pool-state.mjs'

/**
 * Repo variables (Settings → Variables) as a plain map. One `gh api` call;
 * pool values are scalars, so the `name=value` encoding splits on the first
 * `=` only. Requires `actions: read` (read) / `actions: write` (write).
 *
 * Non-strict mode degrades to `{}` + a warn: inspection commands (status,
 * dry-run tick) still work for a token without Actions permissions, and the
 * resulting config is the disabled default — the fail-closed direction. The
 * live tick stays strict: if the supervisor cannot read its own config it
 * must stop loudly, never guess.
 */
export const readPoolVariables = ({ strict = true } = {}) => {
  let out
  try {
    out = gh([
      'api',
      'repos/{owner}/{repo}/actions/variables',
      '--paginate',
      '--jq',
      '.variables[] | .name + "=" + .value',
    ])
  } catch (error) {
    if (strict) throw error
    console.error(
      '[agent:pool] aviso: repo variables ilegíveis (token sem actions:read?) — usando defaults (pool desligado).',
    )
    return {}
  }
  const vars = {}
  for (const line of out.split('\n')) {
    if (!line) continue
    const eq = line.indexOf('=')
    vars[line.slice(0, eq)] = line.slice(eq + 1)
  }
  return vars
}

export const listInProgressIssues = () =>
  ghJson([
    'issue',
    'list',
    '--state',
    'open',
    '--label',
    'in-progress',
    '--limit',
    '200',
    '--json',
    'number,title,body,state,labels,createdAt',
  ])

export const listIssueComments = (number) =>
  ghJson(['issue', 'view', String(number), '--json', 'comments']).comments ?? []

export const listOpenPrs = () =>
  ghJson(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,body,url'])

/** The open PR whose body closes this issue (`Closes #N` / `Fixes #N`), if any. */
export const prClosingIssue = (prs, issueNumber) =>
  prs.find((pr) => new RegExp(`(?:closes|fixes) #${issueNumber}\\b`, 'i').test(pr.body ?? '')) ??
  null

// Same path predicate as the ci-pr.yml migration-lock job (single source of
// truth for "schema-touching PR").
const SCHEMA_PR_PATH = /^(src\/migrations\/|src\/payload-types\.ts$|payload-types\.ts$)/

export const countOpenSchemaPrs = () =>
  ghJson(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,files']).filter(
    (pr) => (pr.files ?? []).some((file) => SCHEMA_PR_PATH.test(file.path)),
  ).length

/** Create or update one repo variable (POST first time, PATCH after). */
export const writePoolVariable = (name, value) => {
  const existing = readPoolVariables()
  if (Object.hasOwn(existing, name)) {
    gh([
      'api',
      '-X',
      'PATCH',
      `repos/{owner}/{repo}/actions/variables/${name}`,
      '-f',
      `value=${value}`,
    ])
  } else {
    gh([
      'api',
      '-X',
      'POST',
      'repos/{owner}/{repo}/actions/variables',
      '-f',
      `name=${name}`,
      '-f',
      `value=${value}`,
    ])
  }
}

/** Comment on an issue with human text plus the machine-readable pool marker. */
export const commentPoolEvent = (number, event, text) => {
  gh(['issue', 'comment', String(number), '--body', `${text} ${formatPoolEvent(event)}`])
}

/**
 * Coordinated claim (plan §4): the supervisor is the single allocator. Re-read
 * the issue (same optimistic lock as agent:claim), flip ready→in-progress and
 * leave the claim marker with the worker UUID the spawn will reuse as the
 * idempotent `agentId`. Returns `{ ok, workerUuid }` or `{ ok: false }` when
 * the race was lost — the tick just moves to the next queue entry.
 */
export const claimIssueForPool = (number, { tickIso }) => {
  const fresh = ghJson(['issue', 'view', String(number), '--json', 'number,state,labels'])
  const labels = labelNames(fresh)
  if (fresh.state !== 'OPEN' || !labels.includes('ready') || labels.includes('in-progress')) {
    return { ok: false, reason: 'lost-race' }
  }
  setLabels(number, { add: ['in-progress'], remove: ['ready'] })
  const workerUuid = randomUUID()
  commentPoolEvent(
    number,
    { event: 'claim', tick: tickIso, worker: workerUuid },
    `Claimed pelo pool-supervisor (tick ${tickIso}) — worker em spawn.`,
  )
  return { ok: true, workerUuid }
}

/** Undo the claim when the spawn itself failed — the issue goes back to ready. */
export const rollbackPoolClaim = (number, note) => {
  setLabels(number, { add: ['ready'], remove: ['in-progress'] })
  gh(['issue', 'comment', String(number), '--body', `Pool-supervisor: claim revertido — ${note}`])
}

/**
 * Failure path: a terminally failed worker's issue leaves the claim queue for
 * human triage. The pool only ever blocks issues IT claimed (claim marker).
 */
export const blockIssueFromPool = (number) => {
  setLabels(number, { add: ['blocked'], remove: ['in-progress'] })
}
