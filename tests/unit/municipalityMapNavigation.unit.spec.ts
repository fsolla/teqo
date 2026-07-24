import { describe, expect, it } from 'vitest'

import {
  buildMunicipalitiesByIbgeCode,
  resolveMunicipalityMapNavigation,
} from '@/utilities/municipalityMapNavigation'

describe('municipalityMapNavigation', () => {
  it('buildMunicipalitiesByIbgeCode groups municipalities by ibgeCode and sorts by name', () => {
    const result = buildMunicipalitiesByIbgeCode([
      { slug: 'salvador-ze-2', name: 'Salvador ZE 2', ibgeCode: '2927408' },
      { slug: 'salvador-ze-1', name: 'Salvador ZE 1', ibgeCode: '2927408' },
      { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108' },
    ])

    expect(result['2900108']).toEqual([{ slug: 'abaira', name: 'Abaíra' }])
    expect(result['2927408']).toEqual([
      { slug: 'salvador-ze-1', name: 'Salvador ZE 1' },
      { slug: 'salvador-ze-2', name: 'Salvador ZE 2' },
    ])
  })

  it('resolveMunicipalityMapNavigation returns none when ibgeCode is missing or empty', () => {
    const byIbge = buildMunicipalitiesByIbgeCode([
      { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108' },
    ])

    expect(resolveMunicipalityMapNavigation('9999999', byIbge)).toEqual({ kind: 'none' })
    expect(resolveMunicipalityMapNavigation('2900108', {})).toEqual({ kind: 'none' })
  })

  it('resolveMunicipalityMapNavigation returns navigate for a single municipality', () => {
    const byIbge = buildMunicipalitiesByIbgeCode([
      { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108' },
    ])

    expect(resolveMunicipalityMapNavigation('2900108', byIbge)).toEqual({
      kind: 'navigate',
      slug: 'abaira',
    })
  })

  it('resolveMunicipalityMapNavigation returns zones for multiple municipalities on the same ibgeCode', () => {
    const byIbge = buildMunicipalitiesByIbgeCode([
      { slug: 'salvador-ze-1', name: 'Salvador ZE 1', ibgeCode: '2927408' },
      { slug: 'salvador-ze-2', name: 'Salvador ZE 2', ibgeCode: '2927408' },
    ])

    expect(resolveMunicipalityMapNavigation('2927408', byIbge)).toEqual({ kind: 'zones' })
  })
})
