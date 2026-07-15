import type { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { revalidateTag, unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

type Collection = keyof Config['collections']

export const getDocuments = <Slug extends Collection>(collection: Slug, depth?: number) =>
  getPayload({ config: configPromise }).then((payload) => payload.find({ collection, depth }))

export const getDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
  depth?: number,
) =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.findByID({ collection, id, depth }),
  )

const getTag = <Slug extends Collection>(collection: Slug, id: string | number) =>
  `document_${collection}:${id}`

export const getCachedDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
  depth?: number,
) =>
  unstable_cache(() => getDocumentById(collection, id, depth), [getTag(collection, id)], {
    tags: [getTag(collection, id)],
  })

export const revalidateDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
) => revalidateTag(getTag(collection, id))

const getListingTag = <Slug extends Collection>(collection: Slug) => `${collection}s`

export const revalidateCollectionListing = <Slug extends Collection>(collection: Slug) =>
  revalidateTag(getListingTag(collection))

export const revalidatePostsListing = () => revalidateCollectionListing('post')
