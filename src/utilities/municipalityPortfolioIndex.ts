import 'server-only'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { MUNICIPALITY_CATALOG_CACHE_TAG } from '@/utilities/municipalityRevalidation'

/**
 * Intentional admin bypass: read-only reference data (name/slug/geography) whose
 * grouping into territory chips is only correct against the complete catalog —
 * scoping it would break the "covers the whole TI" collapse for advisors. The
 * route gate has already asserted staff; what an actor may *add* is restricted
 * separately by the caller. Nothing here is per-actor, which is also what makes
 * the cross-request cache below safe.
 */
const queryMunicipalityPortfolioIndex = async (
  payload: Payload,
): Promise<MunicipalityPortfolioIndexEntry[]> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    // User-visible: `searchMunicipalityPortfolio` walks this array in order and
    // stops at `limit`, so the suggestion list is alphabetical only because this is.
    sort: 'name',
    select: { slug: true },
    overrideAccess: true,
  })

  return result.docs.map((municipality) => ({
    id: municipality.id,
    slug: municipality.slug,
  }))
}

/**
 * Full municipality index for client-side portfolio search (município / TI / ZE),
 * shared by every surface that edits a municipality relation by chips
 * (`/campanha/assessores`, `/campanha/liderancas`, `/campanha/dobradinhas`).
 *
 * Cached across requests: `slug` is a system field — `readOnly` in admin and
 * gated by `canSetCampaignSystemField` — so it only moves when a migration or
 * seed does, and the entry lives until `municipality-catalog` is busted.
 */
const loadMunicipalityPortfolioIndexCached = unstable_cache(
  async (): Promise<MunicipalityPortfolioIndexEntry[]> => {
    const payload = await getPayload({ config: configPromise })
    return queryMunicipalityPortfolioIndex(payload)
  },
  ['municipality-portfolio-index'],
  { tags: [MUNICIPALITY_CATALOG_CACHE_TAG] },
)

export const loadMunicipalityPortfolioIndex = (): Promise<MunicipalityPortfolioIndexEntry[]> =>
  loadMunicipalityPortfolioIndexCached()
