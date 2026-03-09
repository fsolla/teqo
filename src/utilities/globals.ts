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

export const getCachedGlobal = <Slug extends Global>(slug: Slug, depth?: number) =>
  unstable_cache(async () => getGlobal(slug, depth), [getTag(slug)])

export const revalidateGlobal = <Slug extends Global>(slug: Slug) => revalidateTag(getTag(slug))
