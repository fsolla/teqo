/**
 * Shared CLI skeleton for scripts/*.mjs (Pass 3 P3-H; the `scripts/lib/` home
 * exists since B5 F2). `die`, `sha256`, the download→cache→sha256 prologue,
 * `writeText`, the dotenv preamble and the local-host list were each spelled
 * 5–7 times — the newest script copied the OLD shape, i.e. live drift. The
 * convention guard in `codebaseConventions.unit.spec.ts` fails the build on
 * any of these re-spelled outside this module.
 */
import { createHash } from 'node:crypto'
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

/** Local database hosts — including the docker-compose service name. THE one list. */
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'postgres'])

export const ALLOW_REMOTE_DB_FLAG = 'ALLOW_REMOTE_DB'

export const isRemoteDbOverrideSet = () =>
  process.env[ALLOW_REMOTE_DB_FLAG] === 'true' || process.env[ALLOW_REMOTE_DB_FLAG] === '1'

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
