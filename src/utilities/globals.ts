import 'server-only'

import type { Config } from '@/payload-types'

import { revalidateTag } from 'next/cache'

// Tag vocabulary + revalidation helper only. Imported by globals'
// afterChange hooks (aggregated by payload.config.ts), so it must NOT import
// `@payload-config` — see the cycle note in `documents.ts`. Config-dependent
// cached reads live in `globalReads.ts`.

type Global = keyof Config['globals']

export const getGlobalCacheTag = (slug: string) => `global_${slug}`

export const revalidateGlobal = <Slug extends Global>(slug: Slug) =>
  revalidateTag(getGlobalCacheTag(slug))
