/**
 * Shared CLI skeleton for scripts/*.mjs (Pass 3 P3-H; the `scripts/lib/` home
 * exists since B5 F2). `die`, `sha256`, the download→cache→sha256 prologue,
 * `writeText`, the dotenv preamble and the local-host list were each spelled
 * 5–7 times — the newest script copied the OLD shape, i.e. live drift. The
 * convention guard in `codebaseConventions.unit.spec.ts` fails the build on
 * any of these re-spelled outside this module.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/** Labelled `die` factory: `dieWithLabel('seed:tse')` → the script's `die`. */
export const dieWithLabel = (label) => (message) => {
  console.error(`\n[${label}] ${message}\n`)
  process.exit(1)
}

export const sha256Hex = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** The dotenv preamble every DB-touching script needs (.env.local wins over .env). */
export const loadCliEnv = () => {
  const { config: loadEnv } = require('dotenv')
  loadEnv({ path: '.env.local' })
  loadEnv({ path: '.env' })
}

/**
 * Local database hosts — docker-compose service name, the job-network service
 * names of the Forgejo-era runner (OPS62 X1: services by name, no host
 * publish — the GitHub hosted CI reaches services on published localhost
 * ports, OPS71; `postgres-int` remains active, `postgres-build` is a
 * defensive legacy entry since OPS88 removed the second container), and the
 * bridge gateway (OPS50: legacy per-port publish kept in the allowlist).
 * THE one list.
 */
export const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'postgres',
  'postgres-int',
  'postgres-build',
])

/**
 * Gateway of the default route, read from /proc/net/route (Linux). In the
 * Forgejo-era CI the self-hosted runner published each job's `services:`
 * Postgres on the bridge gateway IP (192.168.x.1 — differs per job), so a job
 * reached it via that IP instead of localhost; the GitHub hosted CI (OPS71)
 * reaches services on published localhost ports instead, and the bridge
 * gateway stays in the allowlist for Docker-based runners. The same octet
 * order the ci-pr.yml awk produces (the /proc fields are little-endian).
 * Returns null when there is no default route or the file is unreadable
 * (macOS/Windows dev boxes).
 */
export const defaultGatewayHost = () => {
  try {
    const routes = readFileSync('/proc/net/route', 'utf8').split('\n')
    for (const line of routes) {
      const fields = line.trim().split(/\s+/)
      if (fields[1] !== '00000000') continue
      const hex = fields[2] ?? ''
      if (hex === '00000000' || hex.length < 8) return null
      const octets = [
        parseInt(hex.slice(6, 8), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(0, 2), 16),
      ]
      const isRfc1918 =
        octets[0] === 10 ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168)
      if (!isRfc1918) return null
      return octets.join('.')
    }
  } catch {
    // /proc/net/route is Linux-only; fall through to the static list.
  }
  return null
}

const gatewayHost = defaultGatewayHost()
if (gatewayHost) LOCAL_HOSTS.add(gatewayHost)

/**
 * The one test-database name contract: `teqo_test` or `teqo_<worktree>_test`.
 * Shared by `tests/helpers/assertTestDatabase.ts` (test suite guard) and
 * `scripts/db-reset.mjs` (OPS88) so a DROP-SCHEMA script can never accept the
 * dev database `teqo` or any non-test name.
 */
export const TEST_DATABASE_NAME_RE = /^teqo(_[a-z0-9]+)?_test$/

export const ALLOW_REMOTE_DB_FLAG = 'ALLOW_REMOTE_DB'

/**
 * Truthy intent-flag check (the one spelling of the `true`/`1` semantics).
 * Deliberately exact: no trim, no case-folding — `TRUE` or `yes` stay refused
 * (relaxing a guard is a product decision, not a refactor byproduct).
 */
export const isTruthyEnv = (value) => value === 'true' || value === '1'

export const isRemoteDbOverrideSet = () => isTruthyEnv(process.env[ALLOW_REMOTE_DB_FLAG])

/**
 * Port for `next dev` (OPS40). Next's CLI resolves its port via commander's
 * `.env('PORT')` BEFORE `@next/env` loads `.env.local`, so a `PORT` written by
 * the worktree provisioner was silently ignored and every `pnpm dev` bound
 * 3000. `loadCliEnv()` has already merged real env > `.env.local` > `.env`
 * (override:false) into `process.env`, so reading `env.PORT` gives exactly the
 * precedence the repo wants: real env (Playwright's webServer) wins, then the
 * worktree's file, then no port at all (Next's 3000 default + allowRetry).
 * Returns null when absent (caller omits `-p`); throws fail-closed on a
 * non-empty invalid value (PORT=abc must not silently fall back to 3000).
 *
 * @param {Record<string, string | undefined>} [env]
 */
export const resolveDevPort = (env = process.env) => {
  const raw = (env.PORT ?? '').trim()
  if (raw === '') return null
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválida: ${JSON.stringify(raw)} (esperado 1..65535)`)
  }
  return port
}

/**
 * `next dev` argv for a resolved port. The port MUST go as a CLI flag — the
 * env-file value never reaches commander's `env('PORT')`. A null port omits
 * `-p`, keeping Next's default 3000 and its "retry a free port" behavior.
 */
export const nextDevArgs = (port) => (port === null ? ['dev'] : ['dev', '-p', String(port)])

/**
 * download → cache → sha256 with provenance logging. `ext` picks the cache
 * filename; when it is 'json' the parsed body rides along. `expectedSha256`
 * fails hard on mismatch (provenance-pinned sources, e.g. TSE zips).
 * `download` is injected (`downloadToBuffer` from src/lib/electionResultsZip.ts
 * needs the script's tsx loader, so it cannot be imported here).
 */
export const ensureCachedDownload = async ({
  label,
  key,
  url,
  ext,
  cacheDir,
  expectedSha256,
  download,
}) => {
  await mkdir(cacheDir, { recursive: true })
  const path = join(cacheDir, `${key}.${ext}`)
  let buffer
  try {
    await access(path)
    console.log(`[${label}] cache hit ${path}`)
    buffer = await readFile(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    console.log(`[${label}] downloading ${url}`)
    buffer = await download(url)
    await writeFile(path, buffer)
    console.log(`[${label}] saved ${path} (${buffer.length} bytes)`)
  }

  const hash = sha256Hex(buffer)
  if (expectedSha256 && hash !== expectedSha256) {
    dieWithLabel(label)(
      `SHA-256 mismatch for ${key}\n  expected=${expectedSha256}\n  actual=${hash}\n  Delete ${path} and retry.`,
    )
  }

  return {
    url,
    hash,
    buffer,
    // 'json' and 'geojson' both carry a JSON body.
    ...(ext.endsWith('json') ? { json: JSON.parse(buffer.toString('utf8')) } : {}),
  }
}

/** Write a repo file with the directory walk and the byte-count log line. */
export const writeRepoFile = async ({ label, root, relativePath, body }) => {
  const path = join(root, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body)
  console.log(`[${label}] wrote ${relativePath} (${Buffer.byteLength(body)} bytes)`)
}
