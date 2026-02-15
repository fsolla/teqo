import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import { revalidateTag } from 'next/cache'

type Global = keyof Config['globals']

export async function getGlobal<Slug extends Global>(slug: Slug, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = <Slug extends Global>(slug: Slug, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })

export const revalidateGlobal = <Slug extends Global>(slug: Slug) => revalidateTag(`global_${slug}`)
