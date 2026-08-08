/**
 * Diagnoses local database connectivity and prints the actual remedy instead
 * of letting Payload fail minutes later with a bare ECONNREFUSED.
 *
 * Checks both targets: dev (DATABASE_URL from the environment, then
 * .env.local, then .env — Next.js precedence) and test (.env.test). For each
 * it attempts a real Postgres connection and, on failure, inspects Docker to
 * name the culprit: Teqo's container exited, the host port held by another
 * project's container, a missing database, or no container at all.
 *
 * Usage: pnpm db:doctor
 * Also imported by scripts/guard-dev-db.mjs as a preflight for `pnpm dev`.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { parse as parseEnv } from 'dotenv'
import pg from 'pg'

const isTeqoContainer = (name) => name.includes('teqo')

// Container names come from `docker ps` output, but validate them against
// Docker's own name charset anyway before they reach another exec call —
// defense in depth against argument-shaped names (cannot start with `-`).
const isSafeContainerName = (name) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)

/** @returns {Array<{name: string, status: string, ports: string, image: string}> | null} */
const listContainers = () => {
  try {
    const output = execFileSync(
      'docker',
      ['ps', '-a', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name = '', status = '', ports = '', image = ''] = line.split('\t')
        return { name, status, ports, image }
      })
  } catch {
    return null // docker CLI missing or the daemon is not running
  }
}

/** Host port a container publishes Postgres on, even while exited. */
const containerHostPort = (name) => {
  if (!isSafeContainerName(name)) return null
  try {
    const output = execFileSync(
      'docker',
      [
        'inspect',
        '--format',
        '{{(index (index .HostConfig.PortBindings "5432/tcp") 0).HostPort}}',
        name,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return output.trim() || null
  } catch {
    return null
  }
}

const remediesForConnectionRefused = (port, containers) => {
  if (!containers) {
    return [
      'Docker looks unreachable — is Docker Desktop running?',
      'Then start the database: pnpm db:start',
    ]
  }

  const teqoContainers = containers.filter((container) => isTeqoContainer(container.name))
  const remedies = []

  for (const container of teqoContainers) {
    const hostPort = containerHostPort(container.name)
    if (container.status.startsWith('Restarting')) {
      remedies.push(
        `Container "${container.name}" is crash-looping — inspect: docker logs ${container.name}`,
      )
    } else if (container.status.startsWith('Up')) {
      if (hostPort && hostPort !== String(port)) {
        remedies.push(
          `Container "${container.name}" is running but publishes host port ${hostPort}, ` +
            `while this DATABASE_URL expects ${port} — fix the URL or use the other container.`,
        )
      }
    } else {
      remedies.push(
        `Container "${container.name}" exists but is not running` +
          (hostPort ? ` (publishes host port ${hostPort})` : '') +
          ` — run: docker start ${container.name}`,
      )
    }
  }

  if (teqoContainers.length === 0) {
    remedies.push('No Teqo Postgres container found — run: pnpm db:start')
  } else if (remedies.length === 0) {
    remedies.push(
      `Nothing is listening on port ${port} and no Teqo container explains it — try: pnpm db:start`,
    )
  }

  return remedies
}

const remediesForBadServer = (port, containers, message) => {
  const remedies = [`Something IS listening on port ${port}, but the connection failed: ${message}`]

  const holder = containers?.find(
    (container) => container.status.startsWith('Up') && container.ports.includes(`:${port}->`),
  )
  if (holder && !isTeqoContainer(holder.name)) {
    remedies.push(
      `Host port ${port} is held by another project's container ("${holder.name}") — ` +
        `stop it (docker stop ${holder.name}) and start Teqo's (pnpm db:start), or point DATABASE_URL at another port.`,
    )
  } else if (holder && /database .* does not exist/.test(message)) {
    remedies.push(
      `The server is Teqo's, but the database is missing. The compose init only creates databases on the FIRST ` +
        `volume initialization — create it manually: docker exec ${holder.name} createdb -U teqo <database>`,
    )
  }

  return remedies
}

/**
 * Node's happy-eyeballs connect (::1 + 127.0.0.1) throws an AggregateError
 * whose own message is EMPTY — the useful ECONNREFUSED lives in `.errors`.
 */
const describeError = (error) => {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return [...new Set(error.errors.map(describeError))].join('; ') || error.message
  }
  if (error instanceof Error) return error.message || String(error)
  return String(error)
}

/**
 * @param {{ label: string, databaseUrl: string }} target
 * @returns {Promise<boolean>} true when the database answered `SELECT 1`.
 */
export const diagnoseDatabaseTarget = async ({ label, databaseUrl }) => {
  let url
  try {
    url = new URL(databaseUrl)
  } catch {
    console.error(`[${label}] DATABASE_URL is not a valid connection string.`)
    return false
  }

  const where = `${url.hostname}:${url.port || '5432'}${url.pathname}`
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2500 })

  try {
    await client.connect()
    await client.query('SELECT 1')
    console.log(`[${label}] OK — ${where} is up and answering.`)
    return true
  } catch (error) {
    const message = describeError(error)
    const port = Number(url.port || '5432')
    const refused = /ECONNREFUSED|ENOTFOUND|timeout/i.test(message)
    const containers = listContainers()
    const remedies = refused
      ? remediesForConnectionRefused(port, containers)
      : remediesForBadServer(port, containers, message)

    console.error(`[${label}] FAIL — cannot use ${where} (${message})`)
    for (const remedy of remedies) console.error(`[${label}]   → ${remedy}`)
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

/** Named volume a container mounts at the Postgres data directory, if any. */
const postgresDataVolume = (name) => {
  if (!isSafeContainerName(name)) return null
  try {
    const output = execFileSync(
      'docker',
      [
        'inspect',
        '--format',
        '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}',
        name,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return output.trim() || null
  } catch {
    return null
  }
}

/**
 * Two Postgres containers mounting the SAME data volume silently corrupt the
 * WAL: the postmaster lock file cannot interlock across container PID
 * namespaces, so both instances happily write one PGDATA. This exact setup
 * (a manual `teqo-postgres` next to compose's `teqo-postgres-1`, both on
 * `teqo_pgdata`) produced a checkpoint PANIC on 2026-07-25.
 *
 * @returns {boolean} true when no data volume is shared.
 */
export const warnOnSharedDataVolumes = () => {
  const containers = listContainers()
  if (!containers) return true

  const byVolume = new Map()
  for (const container of containers) {
    if (!container.image.includes('postgres')) continue
    const volume = postgresDataVolume(container.name)
    if (!volume) continue
    byVolume.set(volume, [...(byVolume.get(volume) ?? []), container.name])
  }

  let clean = true
  for (const [volume, names] of byVolume) {
    if (names.length < 2) continue
    clean = false
    console.error(
      `[doctor] DANGER — containers ${names.join(' and ')} mount the SAME data volume "${volume}". ` +
        `Two Postgres instances on one PGDATA corrupt each other's WAL. ` +
        `Keep the compose one (pnpm db:start) and remove the rest: docker rm -f <name>.`,
    )
  }
  return clean
}

const readEnvFile = (path) => {
  try {
    return parseEnv(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Test target exactly as the suites resolve it: `.env.test` then
 * `.env.test.local` (per-worktree, gitignored, wins), then the
 * TEQO_TEST_DATABASE_URL escape hatch beats DATABASE_URL (same order as
 * vitest.setup.ts / playwright.config.ts).
 */
const readTestTargetEnv = () => {
  const layered = { ...readEnvFile('.env.test'), ...readEnvFile('.env.test.local') }
  return layered.TEQO_TEST_DATABASE_URL ?? layered.DATABASE_URL
}

const main = async () => {
  // Next.js precedence for the dev target, without mutating process.env.
  const devUrl =
    process.env.DATABASE_URL ??
    readEnvFile('.env.local').DATABASE_URL ??
    readEnvFile('.env').DATABASE_URL
  const testUrl = readTestTargetEnv()

  let healthy = warnOnSharedDataVolumes()
  if (devUrl) {
    healthy = (await diagnoseDatabaseTarget({ label: 'dev', databaseUrl: devUrl })) && healthy
  } else {
    console.error('[dev] No DATABASE_URL found in the environment, .env.local or .env.')
    healthy = false
  }
  if (testUrl) {
    healthy = (await diagnoseDatabaseTarget({ label: 'test', databaseUrl: testUrl })) && healthy
  } else {
    console.error('[test] No DATABASE_URL found in .env.test.')
    healthy = false
  }

  process.exit(healthy ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
