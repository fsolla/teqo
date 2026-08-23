/**
 * OPS46 — ESM resolution hook for the Playwright runner process.
 *
 * next@15 ships NO `exports` map in its package.json, so native Node ESM
 * cannot resolve the bare `next/cache` subpath (the file exists as
 * `cache.js`, but ESM never tries extensions); `server-only` needs the
 * `react-server` export condition. `pnpm test:e2e` papers over both with
 * NODE_OPTIONS flags (`--conditions=react-server --import=tsx/esm`), but a
 * bare `playwright test` (VS Code extension, `--list`, ad-hoc runs) has
 * neither. This hook applies the same two resolutions in-process:
 *  - `next/cache` → `next/cache.js` (the shipped, TS-mapped entry)
 *  - inject `react-server` into the resolution conditions (same effect as
 *    the `--conditions=react-server` flag)
 *
 * Registered in the main process by `playwright.config.ts` and passed to the
 * worker processes via `NODE_OPTIONS=--import=...` (see `e2eEsmLoader.mjs`).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/cache') {
    return nextResolve('next/cache.js', context)
  }
  if (!context.conditions.includes('react-server')) {
    return nextResolve(specifier, {
      ...context,
      conditions: ['react-server', ...context.conditions],
    })
  }
  return nextResolve(specifier, context)
}
