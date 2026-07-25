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

export const revalidateDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
) => revalidateTag(getDocumentCacheTag(collection, id))

const getListingTag = <Slug extends Collection>(collection: Slug) => `${collection}s`

const revalidateCollectionListing = <Slug extends Collection>(collection: Slug) =>
  revalidateTag(getListingTag(collection))

export const revalidatePostsListing = () => revalidateCollectionListing('post')
