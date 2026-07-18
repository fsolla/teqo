/**
 * Shared local-DB guard for CLI scripts (seeds, pnpm dev guard, etc.).
 * Host allowlist + ALLOW_REMOTE_DB escape hatch.
 */

const OVERRIDE_FLAG = 'ALLOW_REMOTE_DB'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'postgres'])

/**
 * @param {string} label Log/error prefix, e.g. "seed:tse"
 * @param {string} [usageHint] Extra lines shown when refusing a remote host
 */
export const assertLocalDatabase = (label, usageHint = '') => {
  const die = (message) => {
    console.error(`\n[${label}] ${message}\n`)
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) die('DATABASE_URL is not set. Refusing to continue.')

  if (process.env[OVERRIDE_FLAG] === 'true' || process.env[OVERRIDE_FLAG] === '1') {
    console.warn(
      `\n[${label}] ${OVERRIDE_FLAG} is set — connecting to a remote database on purpose. Be careful.\n`,
    )
    return
  }

  let host
  try {
    host = new URL(databaseUrl).hostname
  } catch {
    die('DATABASE_URL is not a valid connection string.')
  }

  if (!LOCAL_HOSTS.has(host)) {
    die(
      `DATABASE_URL points at a non-local host ("${host}").\n` +
        (usageHint ? `${usageHint}\n\n` : '') +
        `If you REALLY mean to use a remote database, re-run with:\n  ${OVERRIDE_FLAG}=true …`,
    )
  }

  console.log(`[${label}] OK — using local database host "${host}".`)
}
