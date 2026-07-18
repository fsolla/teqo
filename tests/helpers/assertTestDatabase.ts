/**
 * Fail-closed guard for the automated test suite.
 *
 * The tests delete and recreate records (see seedUser.ts), so they must NEVER
 * run against the production database. Rather than trying to detect prod (an
 * allowlist we could forget to update), we require the exact local test
 * database. A remote database is rejected even if its name looks test-like.
 */
export function assertTestDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Tests require a dedicated test database configured in .env.test ' +
        '(e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection string.')
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (
    parsedUrl.protocol !== 'postgresql:' ||
    databaseName !== 'teqo_test' ||
    !localHosts.has(parsedUrl.hostname)
  ) {
    throw new Error(
      `Refusing to run tests using protocol "${parsedUrl.protocol || '(unknown)'}" against database ` +
        `"${databaseName || '(unknown)'}" on host ` +
        `"${parsedUrl.hostname || '(unknown)'}". Tests require the exact database "teqo_test" ` +
        'over postgresql: on localhost, 127.0.0.1, or ::1. ' +
        'Configure DATABASE_URL in .env.test (e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
    )
  }
}
