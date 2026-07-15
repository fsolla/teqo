/**
 * Seed-only Node module loader: stubs `next/cache` with no-ops.
 *
 * The `post` and `tag` collections call `revalidateTag()` (via
 * `src/utilities/documents.ts`) inside their `afterChange` hooks. `revalidateTag`
 * throws "static generation store missing" when called outside a Next.js request
 * scope — which is exactly what happens in a standalone seed script, aborting
 * every `payload.create`. Rather than editing the collections (owned elsewhere),
 * we replace `next/cache` with harmless no-ops for the duration of the seed.
 *
 * Registered via `--import=./scripts/seed-loader.mjs` in the `db:seed:posts`
 * npm script; it affects only that process.
 */
import { register } from 'node:module'

const shim =
  'data:text/javascript,' +
  encodeURIComponent(
    [
      'export const revalidateTag = () => {};',
      'export const revalidatePath = () => {};',
      'export const unstable_cache = (fn) => fn;',
      'export const unstable_noStore = () => {};',
    ].join('\n'),
  )

const hooks =
  'data:text/javascript,' +
  encodeURIComponent(
    `export function resolve(specifier, context, nextResolve) {
      if (specifier === 'next/cache') {
        return { url: ${JSON.stringify(shim)}, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    }`,
  )

register(hooks)
