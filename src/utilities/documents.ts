import 'server-only'

import type { Config } from '@/payload-types'

import { revalidateTag } from 'next/cache'

// Tag vocabulary + revalidation helpers only. This module is imported by
// collections (afterChange hooks), which payload.config.ts aggregates — so it
// must NOT import `@payload-config`, or the module graph becomes circular
// (payload.config → collection → here → payload.config). Config-dependent
// cached reads live in `documentReads.ts`.

type Collection = keyof Config['collections']

export const getDocumentCacheTag = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
) => `document_${collection}:${id}`

/**
 * `revalidateTag` throws Next's "static generation store missing" invariant when
 * a Local API write happens OUTSIDE a request scope — e2e fixtures, one-off
 * scripts, seeds. There is no cache to bust in that case, so that one invariant
 * is swallowed; every other failure still propagates (a silently broken
 * revalidation inside a request would be a real bug).
 */
const revalidateTagSafely = (tag: string): void => {
  try {
    revalidateTag(tag)
  } catch (error) {
    if (error instanceof Error && error.message.includes('static generation store missing')) return
    throw error
  }
}

export const revalidateDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
) => revalidateTagSafely(getDocumentCacheTag(collection, id))

export const getCollectionListingTag = <Slug extends Collection>(collection: Slug) =>
  `${collection}s`

const revalidateCollectionListing = <Slug extends Collection>(collection: Slug) =>
  revalidateTagSafely(getCollectionListingTag(collection))

export const revalidatePostsListing = () => revalidateCollectionListing('post')

export const revalidateShareLinksListing = () => revalidateCollectionListing('shareLink')

export const revalidateJinglesListing = () => revalidateCollectionListing('jingle')

/** C211 — the content pieces listing tag the public Central (S27) will read. */
export const revalidateContentPiecesListing = () => revalidateCollectionListing('contentPiece')
