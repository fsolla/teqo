/**
 * OPS46 — entry point that registers the Playwright ESM resolution hook
 * (see `e2eEsmResolve.mjs`). Passed to worker processes as
 * `NODE_OPTIONS=--import=<absolute path>` so bare `playwright test` runs
 * resolve `next/cache` and `server-only` exactly like `pnpm test:e2e` does.
 */
import { register } from 'node:module'

register(new URL('./e2eEsmResolve.mjs', import.meta.url))
