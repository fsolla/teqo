/**
 * Starts the ONE shared local Postgres container (`compose -p teqo`) from any
 * worktree, WITHOUT recreating it when it is already up and serving.
 *
 * Why the guard exists (OPS37, 2026-08-10): docker-compose.yml binds the
 * init scripts via a RELATIVE path (`./docker/postgres/init`), so compose
 * resolves a different absolute mount source per worktree and computes a
 * different `config_hash` for the same pinned project. A plain
 * `docker compose -p teqo up` from any other worktree therefore decides the
 * running container is stale and REPLACES it — killing every live connection
 * (dev servers and e2e runs of ALL worktrees die with `terminating connection
 * due to administrator command`). The bind mount only matters on the FIRST
 * volume initialization; after that it is dead weight in the hash.
 *
 * The container must be immutable while healthy: `db:start` and worktree
 * provisioning skip compose entirely when `teqo-postgres-1` is running and
 * healthy — or, when a peer worktree is still booting it (`starting`), wait
 * for that boot instead of replacing the container mid-healthcheck.
 * Legitimate recreation (image bump, config change) stays possible via an
 * explicit `--force-recreate`.
 */

import { execFileSync } from 'node:child_process'

/** Fixed compose project so `db:start`/provisioning always target ONE container. */
const SHARED_COMPOSE_PROJECT = 'teqo'

/** Compose names the project's service container `<project>-<service>-1`. */
const SHARED_POSTGRES_CONTAINER = 'teqo-postgres-1'

/** How long to wait for a peer's `starting` container before falling back to compose. */
const STARTING_WAIT_MS = 60_000

/** Poll interval while waiting for a `starting` container. */
const STARTING_POLL_INTERVAL_MS = 2_000

/**
 * Pure decision: skip compose entirely when the shared container is already
 * up and serving (`healthy`), or being brought up by a peer worktree right
 * now (`starting` — replacing it then would be a pointless race; we wait for
 * that boot instead). Anything else (stopped, unhealthy, no healthcheck)
 * falls through to compose up, which is safe: no live connections exist to
 * kill, and a pre-healthcheck container gets migrated back to the current
 * config.
 *
 * @returns {boolean} true when compose must NOT run.
 */
export const shouldSkipStart = ({ running, health }) =>
  running === true && (health === 'healthy' || health === 'starting')

/**
 * Parse `docker inspect --format '{{json .State}}'` output into
 * `{ running, health }`. `health` is empty when the container predates the
 * compose healthcheck (no `Health` object) — that never skips, so `db:start`
 * brings the container back to the current config exactly once.
 *
 * @returns {{ running: boolean, health: string } | null} null on unparseable output.
 */
export const parsePostgresContainerHealth = (jsonText) => {
  try {
    const state = JSON.parse(jsonText)
    return {
      running: state.Running === true,
      health: typeof state.Health?.Status === 'string' ? state.Health.Status : '',
    }
  } catch {
    return null
  }
}

/**
 * Inspect the shared container's state. Returns null when it does not exist
 * (compose will create it). Throws when Docker itself is unreachable — the
 * caller decides the remedy (CLI prints one; worktree provisioning falls back
 * to the shared databases).
 *
 * @returns {{ running: boolean, health: string } | null}
 */
const inspectSharedPostgres = () => {
  try {
    const output = execFileSync(
      'docker',
      ['inspect', '--format', '{{json .State}}', SHARED_POSTGRES_CONTAINER],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return parsePostgresContainerHealth(output)
  } catch (error) {
    const stderr = error.stderr?.toString() ?? ''
    if (stderr.includes('No such object')) return null
    throw error
  }
}

/**
 * Wait for a `starting` container to become `healthy`, bounded. Returns true
 * only when it is serving; false when it disappears, turns `unhealthy`, or
 * the timeout elapses — callers then fall back to compose up (no live
 * connections exist to kill on a container that never became healthy).
 * Timeouts are injectable so unit tests run without real waits.
 */
export const waitForHealthyPostgres = async ({
  timeoutMs = STARTING_WAIT_MS,
  intervalMs = STARTING_POLL_INTERVAL_MS,
} = {}) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    const state = inspectSharedPostgres()
    if (!state) return false
    if (state.health === 'healthy') return true
    if (state.health === 'unhealthy') return false
  }
  return false
}

/**
 * Start (or reuse) the shared Postgres container from `cwd` — a no-op when it
 * is already up and serving, unless `forceRecreate` explicitly asks for a
 * recreate (image bump / config change). Creates the container when missing,
 * starts it when stopped, and waits for a peer's fresh container instead of
 * replacing it mid-healthcheck — always with `--wait` for the healthcheck.
 */
export const startSharedPostgres = async ({ cwd, forceRecreate = false }) => {
  const state = inspectSharedPostgres()
  if (!forceRecreate && state && shouldSkipStart(state)) {
    if (state.health === 'healthy' || (await waitForHealthyPostgres())) {
      console.log(`[db] ${SHARED_POSTGRES_CONTAINER} already up (healthy) — nothing to recreate.`)
      return
    }
  }

  const args = ['compose', '-p', SHARED_COMPOSE_PROJECT, 'up', '-d']
  if (forceRecreate) args.push('--force-recreate')
  args.push('--wait', '--wait-timeout', '120', 'postgres')
  execFileSync('docker', args, { cwd, stdio: 'inherit' })
}
