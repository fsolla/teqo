/**
 * Seed-only Node module loader: stubs `next/cache` and `server-only`.
 *
 * The `post` and `tag` collections call `revalidateTag()` (via
 * `src/utilities/documents.ts`) inside their `afterChange` hooks. `revalidateTag`
 * throws "static generation store missing" when called outside a Next.js request
 * scope — which is exactly what happens in a standalone seed script, aborting
 * every `payload.create`. Rather than editing the collections (owned elsewhere),
 * we replace `next/cache` with harmless no-ops for the duration of the seed.
 *
 * Campaign collections also pull in utilities marked `import 'server-only'`; that
 * package throws outside the Next.js server runtime, so we stub it as an empty
 * module for CLI seeds (`db:seed:posts`, `db:seed:tse`).
 *
 * Registered via `--import=./scripts/seed-loader.mjs` in the seed npm scripts;
 * it affects only that process.
 */
import { register } from 'node:module'

const nextCacheShim =
  'data:text/javascript,' +
  encodeURIComponent(
    [
      'export const revalidateTag = () => {};',
      'export const revalidatePath = () => {};',
      'export const unstable_cache = (fn) => fn;',
      'export const unstable_noStore = () => {};',
    ].join('\n'),
  )

const serverOnlyShim = 'data:text/javascript,' + encodeURIComponent('export {};')

const hooks =
  'data:text/javascript,' +
  encodeURIComponent(
    `export function resolve(specifier, context, nextResolve) {
      if (specifier === 'next/cache') {
        return { url: ${JSON.stringify(nextCacheShim)}, shortCircuit: true }
      }
      if (specifier === 'server-only') {
        return { url: ${JSON.stringify(serverOnlyShim)}, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    }`,
  )

register(hooks)
