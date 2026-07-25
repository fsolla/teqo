import 'server-only'

import type { Config } from '@/payload-types'

import { getDocumentCacheTag } from '@/utilities/documents'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

// Config-dependent cached document reads, kept separate from `documents.ts`
// (the tag/revalidation contract collections import) so the module graph
// stays acyclic — see the note there.

type Collection = keyof Config['collections']

/** Bare petition ids (no relationship population) — for `generateStaticParams`. */
export const getPetitionIds = async (): Promise<string[]> => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'petition',
    depth: 0,
    limit: 0,
    pagination: false,
    select: {},
  })
  return result.docs.map((doc) => String(doc.id))
}

const getDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
  depth?: number,
) =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.findByID({ collection, id, depth }),
  )

export const getCachedDocumentById = <Slug extends Collection>(
  collection: Slug,
  id: string | number,
  depth?: number,
) =>
  unstable_cache(
    () => getDocumentById(collection, id, depth),
    [getDocumentCacheTag(collection, id)],
    {
      tags: [getDocumentCacheTag(collection, id)],
    },
  )
