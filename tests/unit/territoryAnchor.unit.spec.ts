import { describe, expect, it } from 'vitest'

import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { buildTerritoryPageHref, territoryAnchorId } from '@/lib/territoryAnchor'

describe('territoryAnchor', () => {
  it('pins a known territory name to a stable anchor and href', () => {
    expect(territoryAnchorId('Velho Chico')).toBe('ti-velho-chico')
    expect(buildTerritoryPageHref('Velho Chico')).toBe('/campanha/territorios#ti-velho-chico')
  })

  it('produces 27 distinct anchor ids for the official TI catalog', () => {
    const ids = bahiaIdentityTerritories.map((name) => territoryAnchorId(name))
    expect(ids).toHaveLength(27)
    expect(new Set(ids).size).toBe(27)
  })
})
