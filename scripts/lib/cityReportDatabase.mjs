/**
 * Read-only database plumbing for the city report extraction (C163).
 *
 * The extraction runs against production on the homeserver. The read-only
 * guarantee is set at the connection level (Postgres `options` startup
 * parameter): every statement of the session fails if it tries to write — the
 * guard does not depend on the script being careful.
 */

export const READ_ONLY_PG_OPTIONS = '-c default_transaction_read_only=on -c statement_timeout=30000'

export const withReadOnlyDatabaseUrl = (databaseUrl, options = READ_ONLY_PG_OPTIONS) => {
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL ausente — a extração read-only precisa do alvo.')
  }
  let url
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL inválida.')
  }
  const existing = url.searchParams.get('options')
  url.searchParams.set('options', existing ? `${existing} ${options}` : options)
  return url.toString()
}

/** `host:porta/banco` — connection label without credentials, for the report footer. */
export const databaseLabel = (databaseUrl) => {
  try {
    const url = new URL(databaseUrl)
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`
  } catch {
    return 'desconhecida'
  }
}
