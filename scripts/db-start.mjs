/**
 * `pnpm db:start` — starts the ONE shared local Postgres container
 * (`compose -p teqo`), or does nothing when it is already up and healthy.
 *
 * The no-op guard matters because the container is shared by every worktree
 * (see scripts/lib/db-start.mjs): a plain `compose up` from another worktree
 * recreates it and kills every live dev/e2e connection. Recreate on purpose:
 * `pnpm db:start --force-recreate` (image bump / config change).
 */

import { pathToFileURL } from 'node:url'

import { startSharedPostgres } from './lib/db-start.mjs'

const USAGE = `Usage: pnpm db:start [--force-recreate]

Starts the shared local Postgres container (compose project "teqo").
No-op when the container is already up and healthy.

Options:
  --force-recreate   Recreate the container even when it is healthy
                     (apply a real compose/image change on purpose).
  -h, --help         Show this help.`

const main = async () => {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    process.exit(0)
  }
  const unknown = args.filter((arg) => arg !== '--force-recreate')
  if (unknown.length > 0) {
    console.error(`[db] Unknown option: ${unknown.join(', ')}`)
    console.error(USAGE)
    process.exit(2)
  }
  const forceRecreate = args.includes('--force-recreate')

  try {
    await startSharedPostgres({ cwd: process.cwd(), forceRecreate })
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('[db] Docker looks unreachable — is Docker running?')
      console.error('[db]   Start Docker and retry: pnpm db:start')
    } else {
      const message = error.stderr?.toString()?.trim() || error.message
      console.error(`[db] Failed to start the local Postgres: ${message.split('\n')[0]}`)
    }
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
