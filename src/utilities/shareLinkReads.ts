import 'server-only'

import { resolveLiveShareLinkDestination, type ShareLinkLiveTarget } from '@/lib/shareLink'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { getCollectionListingTag } from '@/utilities/documents'
import { getCachedGlobal } from '@/utilities/globalReads'
import { resolveDeploymentOrigin, resolveSiteMetadata, toAbsoluteUrl } from '@/utilities/seo'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { Media, ShareLink } from '@/payload-types'

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

const mediaOf = (value: Media | number | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null

/**
 * The card image: the link's own upload first; without it the site default
 * image of the `metadata` global — never a relative URL the WhatsApp crawler
 * cannot resolve. Media lives behind this app's `/api/media/file/…` proxy, so
 * the absolute URL is built on the deployment origin (`NEXT_PUBLIC_SITE_URL`),
 * not on the `metadata` global `URL`: the global can be a canonical domain
 * served by another platform (today the legacy WordPress), which 404s the
 * proxy path and makes WhatsApp drop the thumbnail. The global `siteUrl` is
 * the fallback when the env is missing.
 */
export const resolveShareLinkOgImageUrl = async (link: ShareLink): Promise<string | null> => {
  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl } = resolveSiteMetadata(globalMetadata)
  const origin = resolveDeploymentOrigin(siteUrl)
  if (!origin) return null

  const configured = mediaOf(link.image)?.url
  if (configured) return toAbsoluteUrl(configured, origin)

  const fallback =
    typeof globalMetadata.image === 'number'
      ? await getCachedDocumentById('media', String(globalMetadata.image))()
      : globalMetadata.image
  const fallbackUrl = mediaOf(fallback)?.url
  if (!fallbackUrl) return null

  return toAbsoluteUrl(fallbackUrl, origin)
}
