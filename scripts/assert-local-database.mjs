/**
 * Shared local-DB guard for CLI scripts (seeds, pnpm dev guard, etc.).
 * Host allowlist + ALLOW_REMOTE_DB escape hatch.
 */

import {
  dieWithLabel,
  isRemoteDbOverrideSet,
  LOCAL_HOSTS,
  ALLOW_REMOTE_DB_FLAG as OVERRIDE_FLAG,
} from './lib/cli.mjs'

/**
 * @param {string} label Log/error prefix, e.g. "seed:tse"
 * @param {string} [usageHint] Extra lines shown when refusing a remote host
 */
export const assertLocalDatabase = (label, usageHint = '') => {
  const die = dieWithLabel(label)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) die('DATABASE_URL is not set. Refusing to continue.')

  if (isRemoteDbOverrideSet()) {
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
