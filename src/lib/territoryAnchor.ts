import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { slugify } from '@/lib/slug'

const TERRITORY_PAGE_PATH = '/campanha/territorios'

/** Fragment id for parent TI rows — must match `TerritoryList` `rowId` and `TerritoryLink` hrefs. */
export const territoryAnchorId = (region: BahiaIdentityTerritory | string): string =>
  `ti-${slugify(region)}`

export const buildTerritoryPageHref = (region: BahiaIdentityTerritory | string): string =>
  `${TERRITORY_PAGE_PATH}#${territoryAnchorId(region)}`
