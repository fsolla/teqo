import 'server-only'

/**
 * Cache tag for `unstable_cache` entries derived from the município catalog's
 * system fields (name / slug / region), which are `readOnly` in admin and
 * writable only by `canSetCampaignSystemField` — i.e. by a migration or seed.
 * The runbook mirrors `election-tse`: after a migration that adds or renames a
 * município, `POST /api/revalidate?tag=municipality-catalog` (allowlist in
 * revalidateRequest.ts).
 *
 * The tag lives alone here (the `electionCache.ts` precedent) so importing it
 * never drags `next/cache`'s `revalidatePath` into a module that only caches.
 */
export const MUNICIPALITY_CATALOG_CACHE_TAG = 'municipality-catalog'
