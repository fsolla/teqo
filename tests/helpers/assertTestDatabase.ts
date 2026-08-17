/**
 * Fail-closed guard for the automated test suite.
 *
 * The tests delete and recreate records (see seedUser.ts), so they must NEVER
 * run against the production database. Rather than trying to detect prod (an
 * allowlist we could forget to update), we require a LOCAL database whose name
 * is `teqo_test` or `teqo_<worktree>_test` (per-worktree isolation generated
 * by `pnpm worktree next`). A remote database is rejected even if its name
 * looks test-like.
 */

/** `teqo_test`, `teqo_wt15_test`, … — the _test suffix is the hard contract. */
const TEST_DATABASE_NAME = /^teqo(_[a-z0-9]+)?_test$/

// Self-hosted Forgejo runner: the job's postgres service is published on the
// bridge gateway IP (RFC1918), not localhost. Same source as the CLI guard so
// both guards admit exactly the same hosts (OPS50).
import { defaultGatewayHost } from '../../scripts/lib/cli.mjs'

export function assertTestDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Tests require a dedicated local test database configured in ' +
        '.env.test (e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
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
  const gateway = defaultGatewayHost()
  if (gateway) localHosts.add(gateway)

  if (
    parsedUrl.protocol !== 'postgresql:' ||
    !TEST_DATABASE_NAME.test(databaseName) ||
    !localHosts.has(parsedUrl.hostname)
  ) {
    throw new Error(
      `Refusing to run tests using protocol "${parsedUrl.protocol || '(unknown)'}" against database ` +
        `"${databaseName || '(unknown)'}" on host ` +
        `"${parsedUrl.hostname || '(unknown)'}". Tests require a local database named ` +
        '`teqo_test` or `teqo_<worktree>_test` (per-worktree isolation from `pnpm worktree next`) ' +
        'over postgresql: on localhost, 127.0.0.1, or ::1. ' +
        'Configure DATABASE_URL in .env.test (e.g. postgresql://teqo:teqo@localhost:5432/teqo_test).',
    )
  }
}
