import 'server-only'

import type { Payload } from 'payload'

import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'

/**
 * Full municipality index for client-side portfolio search (município / TI / ZE),
 * shared by every surface that edits a municipality relation by chips
 * (`/campanha/assessores`, `/campanha/liderancas`).
 *
 * Intentional admin bypass: read-only reference data (name/slug/geography) whose
 * grouping into territory chips is only correct against the complete catalog —
 * scoping it would break the "covers the whole TI" collapse for advisors. The
 * route gate has already asserted staff; what an actor may *add* is restricted
 * separately by the caller.
 */
export const loadMunicipalityPortfolioIndex = async (
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
    select: { name: true, slug: true, region: true },
    overrideAccess: true,
  })

  return result.docs.map((municipality) => ({
    id: municipality.id,
    name: municipality.name,
    slug: municipality.slug,
    region: municipality.region as BahiaIdentityTerritory,
  }))
}
