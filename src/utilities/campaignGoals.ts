import 'server-only'

import { cache } from 'react'

import type { Payload } from 'payload'

import type { CampaignGoal, CampaignUser, User } from '@/payload-types'

type CampaignGoalsReader = CampaignUser | User

/**
 * Request-scoped read of the `campaignGoals` global (E8 "conta da cadeira" —
 * state-level vote goal + margin, turned into a per-municipality suggested
 * goal by `municipalityPotential.ts`). Degrau 1 da caching ladder
 * (React `cache()` per-request dedup): the global changes rarely and every
 * page that shows coverage needs the same value once per request.
 *
 * No `unstable_cache`/tag layer on top: `/campanha` is dynamic with
 * per-request auth, so a cross-request cache would need its own
 * invalidation path for no read-latency benefit (see the global's own
 * comment on why it skips the `revalidateGlobal` hook).
 *
 * Access is enforced explicitly (not delegated to `payload.findGlobal`'s
 * default admin bypass): pass `user` + `overrideAccess: false` so leaders and
 * unauthenticated CLI-less callers hit the global's own `access.read` and get
 * denied, matching the Local API security pattern used everywhere else in
 * this codebase.
 */
export const loadCampaignGoals = cache(
  async (payload: Payload, user: CampaignGoalsReader): Promise<CampaignGoal> =>
    payload.findGlobal({
      slug: 'campaignGoals',
      depth: 0,
      user,
      overrideAccess: false,
    }),
)
