/**
 * Fail-closed guard for the automated test suite.
 *
 * The tests delete and recreate records (see seedUser.ts), so they must NEVER
 * run against the production database. Rather than trying to detect prod (an
 * allowlist we could forget to update), we require the opposite: the database
 * name MUST end with `_test`. Anything else — including the production Neon
 * database — is rejected.
 */
export function assertTestDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Tests require a dedicated test database configured in .env.test ' +
        '(e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
    )
  }

  let databaseName: string
  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection string.')
  }

  if (!/_test$/.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against database "${databaseName || '(unknown)'}". ` +
        'The test database name must end with "_test". ' +
        'Configure DATABASE_URL in .env.test (e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
    )
  }
}
