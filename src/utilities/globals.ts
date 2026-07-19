import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { revalidateTag, unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

type Global = keyof Config['globals']

export async function getGlobal<Slug extends Global>(slug: Slug, depth?: number) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

const getTag = (slug: string) => `global_${slug}`

const cachedGlobalFactories = new Map<string, ReturnType<typeof unstable_cache>>()

export const getCachedGlobal = <Slug extends Global>(slug: Slug, depth?: number) => {
  const tag = getTag(slug)
  const cacheKey = `${tag}:${depth ?? 0}`
  let factory = cachedGlobalFactories.get(cacheKey)
  if (!factory) {
    factory = unstable_cache(async () => getGlobal(slug, depth), [cacheKey], { tags: [tag] })
    cachedGlobalFactories.set(cacheKey, factory)
  }
  return factory
}

export const revalidateGlobal = <Slug extends Global>(slug: Slug) => revalidateTag(getTag(slug))
