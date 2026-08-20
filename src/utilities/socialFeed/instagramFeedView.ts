import 'server-only'

import type { SocialFeedSetting } from '@/payload-types'
import { REVALIDATE_SOCIAL_FEED_TAG } from '@/utilities/revalidateRequest'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import {
  describeInstagramError,
  eligibleInstagramPosts,
  failedInstagramSyncStatus,
  INSTAGRAM_MAX_RESULTS_CAP,
  type InstagramFeedResult,
  isInstagramFeedConfigured,
  loadInstagramFeed,
  persistInstagramAccessToken,
  persistInstagramSnapshot,
  persistInstagramSyncStatus,
  successInstagramSyncStatus,
} from '@/utilities/socialFeed/instagramFeed'

const excludedInstagramIds = (settings: SocialFeedSetting): string[] =>
  (settings.excludedItems ?? [])
    .filter((item) => item.platform === 'instagram')
    .map((item) => item.itemId)
    .filter(Boolean)

const isInstagramSnapshot = (value: unknown): value is { username?: unknown; posts?: unknown } =>
  typeof value === 'object' && value !== null

/**
 * Cached Instagram feed for the campaign home content board: `null` when the
 * feed is off (kill switch, platform toggle or missing credentials), otherwise
 * the latest eligible posts plus the profile username. A successful fetch
 * persists the RAW list (pre-exclusion) as the global snapshot AND the sync
 * status (so the admin panel shows "Sincronizado · há X min · N posts"); a
 * failed fetch persists the failure status with the product-language reason
 * and falls back to the snapshot with the current exclusions applied — so a
 * new exclusion works even while the API is down, and the page never breaks.
 * Busted by the global's `afterChange` (tag `social-feed`); the per-entry
 * `revalidate` keeps new uploads appearing without an admin edit.
 *
 * Lives in `instagramFeedView.ts` (NOT `instagramFeed.ts`) on purpose: this
 * module is the only one that imports `@payload-config`, while
 * `instagramFeed.ts` is reachable from `payload.config.ts` via the global's
 * sync hook — importing the config back from the feed module would close a
 * cycle the `check:cycles` gate rejects.
 */
export const getInstagramFeed = unstable_cache(
  async (): Promise<InstagramFeedResult | null> => {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({
      slug: 'social-feed-settings',
      depth: 0,
    })

    if (!isInstagramFeedConfigured(settings)) {
      return null
    }

    const maxItems = Math.min(Math.max(settings.instagramMaxItems ?? 3, 1), 5)
    const excludedIds = excludedInstagramIds(settings)

    try {
      const result = await loadInstagramFeed({
        accessToken: settings.instagramAccessToken as string,
        userId: settings.instagramUserId as string,
        maxResults: Math.min(maxItems + 10, INSTAGRAM_MAX_RESULTS_CAP),
      })
      await persistInstagramSnapshot(payload, { username: result.username, posts: result.posts })
      if (result.refreshedAccessToken) {
        await persistInstagramAccessToken(payload, result.refreshedAccessToken)
      }
      await persistInstagramSyncStatus(payload, successInstagramSyncStatus(result.posts.length))
      return {
        username: result.username,
        posts: eligibleInstagramPosts(result.posts, excludedIds, maxItems),
      }
    } catch (cause) {
      await persistInstagramSyncStatus(
        payload,
        failedInstagramSyncStatus(describeInstagramError(cause)),
      )
      const snapshot = settings.instagramFeedSnapshot as unknown
      if (!isInstagramSnapshot(snapshot) || !Array.isArray(snapshot.posts)) {
        return { username: null, posts: [] }
      }
      return {
        username: typeof snapshot.username === 'string' ? snapshot.username : null,
        posts: eligibleInstagramPosts(snapshot.posts, excludedIds, maxItems),
      }
    }
  },
  ['instagram-feed'],
  { tags: [REVALIDATE_SOCIAL_FEED_TAG], revalidate: 300 },
)
