import { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

type Collection = keyof Config['collections']

export const getDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string,
  depth?: number,
) =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.findByID({ collection, id, depth }),
  )

const getTag = <Slug extends Collection>(collection: Slug, id: string) =>
  `document_${collection}:${id}`

export const getCachedDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string,
  depth?: number,
) =>
  unstable_cache(() => getDocumentById(collection, id, depth), [id], {
    tags: [getTag(collection, id)],
  })

export const revalidateDocumentById = <Slug extends Collection>(collection: Slug, id: string) =>
  revalidateTag(getTag(collection, id))
