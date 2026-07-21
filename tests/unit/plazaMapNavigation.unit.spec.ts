import { describe, expect, it } from 'vitest'

import {
  buildPlazasByIbgeCode,
  resolvePlazaMapNavigation,
} from '@/utilities/plazaMapNavigation'

describe('plazaMapNavigation', () => {
  it('buildPlazasByIbgeCode groups plazas by ibgeCode and sorts by name', () => {
    const result = buildPlazasByIbgeCode([
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

  it('resolvePlazaMapNavigation returns none when ibgeCode is missing or empty', () => {
    const byIbge = buildPlazasByIbgeCode([
      { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108' },
    ])

    expect(resolvePlazaMapNavigation('9999999', byIbge)).toEqual({ kind: 'none' })
    expect(resolvePlazaMapNavigation('2900108', {})).toEqual({ kind: 'none' })
  })

  it('resolvePlazaMapNavigation returns navigate for a single plaza', () => {
    const byIbge = buildPlazasByIbgeCode([
      { slug: 'abaira', name: 'Abaíra', ibgeCode: '2900108' },
    ])

    expect(resolvePlazaMapNavigation('2900108', byIbge)).toEqual({
      kind: 'navigate',
      slug: 'abaira',
    })
  })

  it('resolvePlazaMapNavigation returns zones for multiple plazas on the same ibgeCode', () => {
    const byIbge = buildPlazasByIbgeCode([
      { slug: 'salvador-ze-1', name: 'Salvador ZE 1', ibgeCode: '2927408' },
      { slug: 'salvador-ze-2', name: 'Salvador ZE 2', ibgeCode: '2927408' },
    ])

    expect(resolvePlazaMapNavigation('2927408', byIbge)).toEqual({ kind: 'zones' })
  })
})
