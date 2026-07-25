import 'server-only'

import type { Config } from '@/payload-types'

import { getGlobalCacheTag } from '@/utilities/globals'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

// Config-dependent cached global reads, kept separate from `globals.ts` (the
// tag/revalidation contract global hooks import) so the module graph stays
// acyclic — see the note in `documents.ts`.

type Global = keyof Config['globals']

async function getGlobal<Slug extends Global>(slug: Slug, depth?: number) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

type CachedGlobalFactory<Slug extends Global = Global> = () => Promise<Config['globals'][Slug]>

const cachedGlobalFactories = new Map<string, CachedGlobalFactory>()

export const getCachedGlobal = <Slug extends Global>(slug: Slug, depth?: number) => {
  const tag = getGlobalCacheTag(slug)
  const cacheKey = `${tag}:${depth ?? 0}`
  const existing = cachedGlobalFactories.get(cacheKey) as CachedGlobalFactory<Slug> | undefined
  if (existing) return existing

  const factory = unstable_cache(async () => getGlobal(slug, depth), [cacheKey], {
    tags: [tag],
  }) as CachedGlobalFactory<Slug>
  cachedGlobalFactories.set(cacheKey, factory as CachedGlobalFactory)
  return factory
}
