/**
 * Refresh the stage database: create a NEW Neon branch from the current prod
 * snapshot and swap the `STAGE_DATABASE_URL` secret in the GitHub `stage`
 * Environment. Human / `workflow_dispatch` only — agents must never run this
 * (it touches the prod Neon project).
 *
 * Refresh is "new branch + swap secret", never DELETE/INSERT of real data:
 * Neon branches are copy-on-write snapshots of prod at creation time.
 *
 * Requirements:
 *   NEON_API_KEY  — Neon API key with access to the prod project (get one at
 *                   https://console.neon.tech/app/settings/api-keys). Never
 *                   committed; export it in your shell or pass via env.
 *   gh            — authenticated GitHub CLI (updates the secret).
 *
 * Usage:
 *   NEON_API_KEY=… pnpm db:refresh:stage                 # refresh + swap secret
 *   NEON_API_KEY=… pnpm db:refresh:stage -- --delete-old # also delete the previous stage branch
 *   NEON_API_KEY=… node scripts/refresh-stage.mjs --dry-run
 */

import { dieWithLabel } from './lib/cli.mjs'

const LABEL = 'refresh:stage'
const die = dieWithLabel(LABEL)

const PROJECT_ID = process.env.NEON_PROJECT_ID
if (!PROJECT_ID) {
  die('Set NEON_PROJECT_ID (Neon console → project id).')
}
const DATABASE_NAME = 'neondb'
const ROLE_NAME = 'neondb_owner'
const API = 'https://console.neon.tech/api/v2'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const DELETE_OLD = args.has('--delete-old')

const apiKey = process.env.NEON_API_KEY
if (!apiKey) {
  die(
    'NEON_API_KEY is not set. This script is human-only: it creates a branch on the PROD Neon ' +
      'project and swaps the stage secret. Export a Neon API key and re-run.',
  )
}

const request = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    die(`Neon API ${method} ${path} → ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

const log = (message) => console.log(`[${LABEL}] ${message}`)

// 1. Find the prod default branch (the snapshot source) and the current stage branch.
const { branches } = await request('GET', `/projects/${PROJECT_ID}/branches`)
const prodBranch = branches.find((branch) => branch.default)
if (!prodBranch) die(`No default branch found on project ${PROJECT_ID}.`)
const oldStage = branches.find((branch) => branch.name === 'stage')
log(`prod branch: ${prodBranch.id} (${prodBranch.name})`)
if (oldStage) log(`current stage branch: ${oldStage.id}`)

if (DRY_RUN) {
  log('dry-run — would create a new `stage` branch from prod and swap STAGE_DATABASE_URL.')
  process.exit(0)
}

// 2. Replace the old stage branch with a fresh one from prod (delete first so
//    the name is free; the old branch is a stale snapshot, not data we keep).
if (oldStage) {
  await request('DELETE', `/projects/${PROJECT_ID}/branches/${oldStage.id}`)
  log(`deleted old stage branch ${oldStage.id}`)
}

const timestamp = new Date().toISOString().slice(0, 10)
const created = await request('POST', `/projects/${PROJECT_ID}/branches`, {
  branch: { name: 'stage', parent_id: prodBranch.id },
  endpoints: [{ type: 'read_write' }],
})
const stageBranch = created.branch
log(`created stage branch ${stageBranch.id} from prod snapshot (${timestamp})`)

// 3. Resolve the new connection string. UNPOOLED on purpose: the int suite
//    (and Payload's own advisory locks) need real session state, which the
//    transaction-mode pooler does not guarantee — the suite hung and GitHub
//    cancelled the run at the 1-hour mark on 2026-07-30 with the pooled URL.
const { uri } = await request(
  'GET',
  `/projects/${PROJECT_ID}/connection_uri?branch_id=${stageBranch.id}` +
    `&database_name=${DATABASE_NAME}&role_name=${ROLE_NAME}&pooled=false`,
)
log(`new stage connection string: ${uri.replace(/:\/\/[^@]*@/, '://***@')}`)

// 4. Swap the GitHub secret in the `stage` Environment.
const { execFileSync } = await import('node:child_process')
execFileSync('gh', ['secret', 'set', 'STAGE_DATABASE_URL', '--env', 'stage', '--body', uri], {
  stdio: 'inherit',
})
log('STAGE_DATABASE_URL updated in the GitHub `stage` environment.')

if (DELETE_OLD && oldStage) {
  log('note: --delete-old is a no-op now — the old branch was already replaced in step 2.')
}

log('OK — stage database refreshed. Next ci-stage run uses the new snapshot.')
process.exit(0)
