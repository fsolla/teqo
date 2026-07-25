import 'server-only'

import type { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { revalidateTag, unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

type Global = keyof Config['globals']

async function getGlobal<Slug extends Global>(slug: Slug, depth?: number) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

export const getGlobalCacheTag = (slug: string) => `global_${slug}`

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

export const revalidateGlobal = <Slug extends Global>(slug: Slug) =>
  revalidateTag(getGlobalCacheTag(slug))
