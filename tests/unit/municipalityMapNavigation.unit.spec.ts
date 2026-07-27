import { describe, expect, it } from 'vitest'

import {
  buildMunicipalitiesByIbgeCode,
  buildMunicipalitiesByMapKey,
  mapKeyForMunicipality,
  resolveMunicipalityMapNavigation,
} from '@/utilities/municipalityMapNavigation'

const abaira = { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108', kind: 'municipio' } as const
const salvadorZe1 = {
  slug: 'salvador-ze-1',
  name: 'Salvador — ZE 1',
  ibgeCode: '2927408',
  kind: 'zona',
} as const
const salvadorZe2 = {
  slug: 'salvador-ze-2',
  name: 'Salvador — ZE 2',
  ibgeCode: '2927408',
  kind: 'zona',
} as const

describe('municipalityMapNavigation', () => {
  it('buildMunicipalitiesByIbgeCode groups municipalities by ibgeCode and sorts by name', () => {
    const result = buildMunicipalitiesByIbgeCode([salvadorZe2, salvadorZe1, abaira])

    expect(result['2900108']).toEqual([{ slug: 'abaira', name: 'Abaíra' }])
    expect(result['2927408']).toEqual([
      { slug: 'salvador-ze-1', name: 'Salvador — ZE 1' },
      { slug: 'salvador-ze-2', name: 'Salvador — ZE 2' },
    ])
  })

  it('keys zone municipalities by slug and everything else by codarea', () => {
    expect(mapKeyForMunicipality(abaira)).toBe('2900108')
    expect(mapKeyForMunicipality(salvadorZe1)).toBe('salvador-ze-1')
  })

  it('gives every zone its own map key instead of pooling them under the city', () => {
    const byMapKey = buildMunicipalitiesByMapKey([salvadorZe1, salvadorZe2, abaira])

    expect(Object.keys(byMapKey).sort()).toEqual(['2900108', 'salvador-ze-1', 'salvador-ze-2'])
    expect(byMapKey['2927408']).toBeUndefined()
    expect(byMapKey['salvador-ze-2']).toEqual({
      slug: 'salvador-ze-2',
      name: 'Salvador — ZE 2',
    })
  })

  it('resolveMunicipalityMapNavigation returns none for an unknown or empty key', () => {
    const byMapKey = buildMunicipalitiesByMapKey([abaira])

    expect(resolveMunicipalityMapNavigation('9999999', byMapKey)).toEqual({ kind: 'none' })
    expect(resolveMunicipalityMapNavigation('2900108', {})).toEqual({ kind: 'none' })
  })

  it('resolveMunicipalityMapNavigation opens the unit behind the key, zone included', () => {
    const byMapKey = buildMunicipalitiesByMapKey([abaira, salvadorZe1])

    expect(resolveMunicipalityMapNavigation('2900108', byMapKey)).toEqual({
      kind: 'navigate',
      slug: 'abaira',
    })
    expect(resolveMunicipalityMapNavigation('salvador-ze-1', byMapKey)).toEqual({
      kind: 'navigate',
      slug: 'salvador-ze-1',
    })
  })
})
