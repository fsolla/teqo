import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'
import { allParamValues } from '@/utilities/campaignListUrl'

/**
 * The `?region=` parser shared by the municípios and territórios list URLs
 * (P3-F) — deliberately its own module and NOT part of `campaignListUrl`:
 * this drags the static territory catalog, and the shared URL module must
 * stay cheap enough for the sidebar to import (the ~21 kB lesson of B18).
 */
const canonicalTerritoryBySearchValue = new Map(
  bahiaIdentityTerritories.map((territory) => [normalizeSearchPhrase(territory), territory]),
)

export const parseTerritoryRegionsParam = (
  value: string | string[] | undefined,
): BahiaIdentityTerritory[] => {
  const regions: BahiaIdentityTerritory[] = []
  const seen = new Set<BahiaIdentityTerritory>()
  for (const token of allParamValues(value)) {
    const region = canonicalTerritoryBySearchValue.get(normalizeSearchPhrase(token))
    if (!region || seen.has(region)) continue
    seen.add(region)
    regions.push(region)
  }
  return regions
}
