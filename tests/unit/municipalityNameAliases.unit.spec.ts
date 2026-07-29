// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { canonicalizeMunicipalityName } from '@/lib/electionResults'
import { MUNICIPALITY_NAME_ALIASES } from '@/lib/municipalityNameAliases'
import { resolveBahiaMunicipality } from '@/lib/schemas/supporter'

/**
 * P3-H pin (guard class 5): the curated alias table is DATA, so a future
 * divergence between the two resolution paths turns red here — every variant
 * must resolve through BOTH the TSE pipeline (canonicalizeMunicipalityName)
 * and the supporter import (resolveBahiaMunicipality). The pre-fold bug this
 * pins against: the supporter path rejected 4 of these 5 spellings.
 */
describe('municipality name aliases (P3-H)', () => {
  it.each(MUNICIPALITY_NAME_ALIASES)('"%s" resolves via every path', (variant, canonical) => {
    expect(resolveBahiaMunicipality(variant)).toBe(canonical)
    expect(canonicalizeMunicipalityName(variant)).toBe(canonical)
  })

  it.each(MUNICIPALITY_NAME_ALIASES)('canonical "%s" resolves via every path', (_v, canonical) => {
    expect(resolveBahiaMunicipality(canonical)).toBe(canonical)
    expect(canonicalizeMunicipalityName(canonical)).toBe(canonical)
  })
})
