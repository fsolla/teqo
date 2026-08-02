import { describe, expect, it } from 'vitest'

import type { HomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'
import { mergeHomeSearchNearestMunicipality } from '@/lib/homeSearchNearestMunicipalityMerge'

const hit = (slug: string, name: string): HomeSearchMunicipalityHit => ({
  kind: 'municipality',
  slug,
  name,
  region: 'TI',
  priority: 'normal',
  votePosition2022: null,
})

describe('mergeHomeSearchNearestMunicipality (B117 / B125)', () => {
  const serverHits = [hit('b', 'Brumado'), hit('c', 'Cairu')]
  const hitBySlug = new Map([
    ['a', hit('a', 'Abaíra')],
    ['b', hit('b', 'Brumado')],
    ['c', hit('c', 'Cairu')],
  ])

  it('prefixes nearest slug and dedupes from server list', () => {
    const merged = mergeHomeSearchNearestMunicipality({
      nearestSlug: 'a',
      serverHits,
      hitBySlug,
    })
    expect(merged.map((row) => row.slug)).toEqual(['a', 'b', 'c'])
  })

  it('keeps server order when nearest is already first on server', () => {
    const merged = mergeHomeSearchNearestMunicipality({
      nearestSlug: 'b',
      serverHits,
      hitBySlug,
    })
    expect(merged.map((row) => row.slug)).toEqual(['b', 'c'])
  })

  it('returns server list unchanged when nearest slug is missing', () => {
    const merged = mergeHomeSearchNearestMunicipality({
      nearestSlug: 'missing',
      serverHits,
      hitBySlug,
    })
    expect(merged).toEqual(serverHits)
  })

  it('returns server list unchanged when nearest slug is null', () => {
    const merged = mergeHomeSearchNearestMunicipality({
      nearestSlug: null,
      serverHits,
      hitBySlug,
    })
    expect(merged).toEqual(serverHits)
  })

  it('does not add geo reason or distance to the prefixed hit', () => {
    const merged = mergeHomeSearchNearestMunicipality({
      nearestSlug: 'a',
      serverHits,
      hitBySlug,
    })
    const nearest = merged[0]
    expect(nearest.region).toBe('TI')
    expect(JSON.stringify(nearest)).not.toMatch(/Perto de você|km/i)
  })
})
