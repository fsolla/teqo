import { getCollectionListingTag } from '@/utilities/documents'
import { ELECTION_TSE_CACHE_TAG } from '@/utilities/electionCache'
import { getGlobalCacheTag } from '@/utilities/globals'
import { MUNICIPALITY_CATALOG_CACHE_TAG } from '@/utilities/municipality/municipalityCatalogCache'

export const REVALIDATE_POSTS_TAG = 'posts' as const

export const REVALIDATE_PRIVACY_POLICY_CACHE_TAG = getGlobalCacheTag('privacy-policy')

/**
 * C233 — the archive photos listing tag the public album (`/fotos`) caches
 * under. Derived from the same owner the collection hook busts, so the runbook
 * tag and the code can never drift.
 */
const REVALIDATE_ARCHIVE_PHOTOS_TAG = getCollectionListingTag('archivePhoto')

/**
 * Cache tag of the campaign home content board's external feeds (`unstable_cache`
 * entry of `getYouTubeFeed`). The `SocialFeedSettings` global's `afterChange`
 * busts it; the runbook tag is also allowlisted here for direct-DB writes.
 */
export const REVALIDATE_SOCIAL_FEED_TAG = 'social-feed' as const

const ALLOWED_REVALIDATE_TAGS = [
  REVALIDATE_POSTS_TAG,
  REVALIDATE_PRIVACY_POLICY_CACHE_TAG,
  ELECTION_TSE_CACHE_TAG,
  MUNICIPALITY_CATALOG_CACHE_TAG,
  REVALIDATE_SOCIAL_FEED_TAG,
  REVALIDATE_ARCHIVE_PHOTOS_TAG,
] as const

type AllowedRevalidateTag = (typeof ALLOWED_REVALIDATE_TAGS)[number]

const allowedTagSet = new Set<string>(ALLOWED_REVALIDATE_TAGS)

export type ResolveRevalidateTagResult =
  | { ok: true; tag: AllowedRevalidateTag }
  | { ok: false; error: string }

const isAllowedRevalidateTag = (tag: string): tag is AllowedRevalidateTag => allowedTagSet.has(tag)

export const resolveRevalidateTag = (
  queryTag: string | null | undefined,
  bodyTag: string | null | undefined,
): ResolveRevalidateTagResult => {
  const requested = queryTag ?? bodyTag

  if (requested == null || requested === '') {
    return { ok: true, tag: REVALIDATE_POSTS_TAG }
  }

  if (!isAllowedRevalidateTag(requested)) {
    return {
      ok: false,
      error: `Unknown tag. Allowed: ${ALLOWED_REVALIDATE_TAGS.join(', ')}`,
    }
  }

  return { ok: true, tag: requested }
}
