import 'server-only'

/**
 * Cache tag for every `unstable_cache` entry derived from the immutable TSE
 * election collections (2014/2018/2022). The data only changes when the seed
 * is re-run (`pnpm db:seed:tse`), so the runbook is: re-seed → `POST
 * /api/revalidate?tag=election-tse` (see revalidateRequest.ts allowlist).
 */
export const ELECTION_TSE_CACHE_TAG = 'election-tse'
