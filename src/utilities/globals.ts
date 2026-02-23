import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { cacheTag, revalidateTag } from 'next/cache'
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

export const getCachedGlobal = async <Slug extends Global>(slug: Slug, depth?: number) => {
  'use cache'
  cacheTag(getTag(slug))
  return await getGlobal(slug, depth)
}

export const revalidateGlobal = <Slug extends Global>(slug: Slug) =>
  revalidateTag(getTag(slug), 'max')
