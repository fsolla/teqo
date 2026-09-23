import 'server-only'

import { resolveLiveShareLinkDestination, type ShareLinkLiveTarget } from '@/lib/shareLink'
import { getCollectionListingTag } from '@/utilities/documents'
import { resolveOgImage } from '@/utilities/ogImageReads'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { ShareLink } from '@/payload-types'

// Config-dependent cached read of a published share link by slug. Kept apart
// from `documents.ts` (the tag vocabulary/revalidation contract collections
// import) so the module graph stays acyclic — same split as `documentReads.ts`.
// The anonymous filter lives in the query itself: a draft never leaves here.

const findPublishedShareLinkBySlug = async (
  slug: string,
  depth: number,
): Promise<ShareLink | null> => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'shareLink',
    where: { slug: { equals: slug }, published: { equals: true } },
    depth,
    limit: 1,
  })

  return result.docs[0] ?? null
}

/**
 * Public read of `jorgesolla1313.com.br/<slug>`. Cached under the collection
 * listing tag (`shareLinks`), busted by the collection's afterChange/afterDelete
 * hooks — one tag invalidates every slug, the same listing contract as posts.
 */
export const getCachedPublishedShareLinkBySlug = (slug: string, depth = 1) =>
  unstable_cache(
    () => findPublishedShareLinkBySlug(slug, depth),
    ['share-link-by-slug', slug, String(depth)],
    {
      tags: [getCollectionListingTag('shareLink')],
    },
  )

/**
 * S29 — the fresh read behind the announcement page's activation poll. It must
 * NOT be cached: the whole point is seeing the "no ar" flag flip without a
 * reload. The anonymous contract is the same as the cached loader — the
 * `published: true` filter is the barrier, so a draft never resolves here.
 */
export const loadPublishedShareLinkLiveTarget = async (
  slug: string,
): Promise<ShareLinkLiveTarget | null> => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'shareLink',
    where: { slug: { equals: slug }, published: { equals: true } },
    depth: 0,
    limit: 1,
    // Deliberate access bypass: this is an unauthenticated public read, and the
    // `published: true` where clause above is the fail-closed gate.
    overrideAccess: true,
  })

  const link = result.docs[0]
  if (!link) return null

  return resolveLiveShareLinkDestination(link.destinations)
}

/**
 * The card image: the link's own upload first; without it the site default
 * image of the `metadata` global. Delegates to the single OG owner
 * (`ogImageReads.ts`), which absolutizes on the deployment origin — never on
 * the global `URL` (a canonical domain served elsewhere 404s the media proxy
 * and makes WhatsApp drop the thumbnail).
 */
export const resolveShareLinkOgImageUrl = async (link: ShareLink): Promise<string | null> =>
  (await resolveOgImage(link.image)).url
