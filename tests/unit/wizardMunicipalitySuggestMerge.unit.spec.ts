import { describe, expect, it } from 'vitest'

import type { HomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_SUGGEST_LIMIT } from '@/lib/homeSearchSuggest'
import {
  listWizardContinuitySlugs,
  mergeWizardMunicipalitySuggestions,
  municipalitySlugFromRecentVisitHref,
  WIZARD_CONTINUITY_LAST_ACTED_LABEL,
  WIZARD_CONTINUITY_VISITED_LABEL,
  type WizardContinuityVisitInput,
} from '@/lib/wizardMunicipalitySuggestMerge'

const hit = (
  partial: Partial<HomeSearchMunicipalityHit> & Pick<HomeSearchMunicipalityHit, 'slug' | 'name'>,
): HomeSearchMunicipalityHit => ({
  kind: 'municipality',
  region: 'Região',
  priority: null,
  votePosition2022: null,
  ...partial,
})

const visit = (
  overrides: Partial<WizardContinuityVisitInput> = {},
): WizardContinuityVisitInput => ({
  href: '/campanha/municipios/cairu',
  kind: 'municipality',
  ...overrides,
})

describe('municipalitySlugFromRecentVisitHref', () => {
  it('extracts municipality slug from detail href', () => {
    expect(municipalitySlugFromRecentVisitHref('/campanha/municipios/itabuna')).toBe('itabuna')
    expect(municipalitySlugFromRecentVisitHref('/campanha/municipios')).toBeNull()
    expect(municipalitySlugFromRecentVisitHref('/campanha/atividades/foo')).toBeNull()
  })
})

describe('listWizardContinuitySlugs', () => {
  const scope = new Set(['itabuna', 'cairu', 'valenca'])

  it('orders last-acted before visited and filters out of scope', () => {
    const continuity = listWizardContinuitySlugs({
      lastActedSlug: 'itabuna',
      recentVisits: [
        visit({ href: '/campanha/municipios/cairu' }),
        visit({ href: '/campanha/municipios/fora' }),
        visit({ href: '/campanha/municipios/valenca' }),
      ],
      scopeSlugs: scope,
    })

    expect(continuity).toEqual([
      { source: 'last-acted', slug: 'itabuna' },
      { source: 'visited', slug: 'cairu' },
      { source: 'visited', slug: 'valenca' },
    ])
  })

  it('deduplicates visited slug that matches last-acted', () => {
    const continuity = listWizardContinuitySlugs({
      lastActedSlug: 'cairu',
      recentVisits: [visit({ href: '/campanha/municipios/cairu' })],
      scopeSlugs: new Set(['cairu']),
    })

    expect(continuity).toEqual([{ source: 'last-acted', slug: 'cairu' }])
  })

  it('ignores non-municipality visits and caps visited count', () => {
    const continuity = listWizardContinuitySlugs({
      lastActedSlug: null,
      recentVisits: [
        visit({ href: '/campanha/municipios', kind: 'municipalityList' }),
        visit({ href: '/campanha/municipios/a' }),
        visit({ href: '/campanha/municipios/b' }),
        visit({ href: '/campanha/municipios/c' }),
        visit({ href: '/campanha/municipios/d' }),
      ],
      scopeSlugs: new Set(['a', 'b', 'c', 'd']),
      maxVisited: 3,
    })

    expect(continuity.map((item) => item.slug)).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeWizardMunicipalitySuggestions', () => {
  const hitBySlug = new Map(
    [
      hit({ slug: 'geo', name: 'Geo' }),
      hit({ slug: 'acted', name: 'Acted' }),
      hit({ slug: 'visited', name: 'Visited' }),
      hit({ slug: 'forgot-a', name: 'Forgot A', region: 'Costa do Dendê' }),
      hit({ slug: 'forgot-b', name: 'Forgot B' }),
    ].map((row) => [row.slug, row]),
  )

  it('dedupes in geo > continuity > server order without geo copy on the row', () => {
    const merged = mergeWizardMunicipalitySuggestions({
      geoSlug: 'forgot-a',
      continuity: [
        { source: 'last-acted', slug: 'acted' },
        { source: 'visited', slug: 'visited' },
        { source: 'visited', slug: 'forgot-a' },
      ],
      serverHits: [
        hit({ slug: 'forgot-a', name: 'Forgot A', region: 'Costa do Dendê' }),
        hit({ slug: 'forgot-b', name: 'Forgot B' }),
      ],
      hitBySlug,
    })

    expect(merged.map((row) => row.hit.slug)).toEqual(['forgot-a', 'acted', 'visited', 'forgot-b'])
    expect(merged.find((row) => row.hit.slug === 'forgot-a')?.hit.region).toBe('Costa do Dendê')
    expect(JSON.stringify(merged.find((row) => row.hit.slug === 'forgot-a')?.hit)).not.toMatch(
      /Perto de você|km/i,
    )
    expect(merged.find((row) => row.hit.slug === 'acted')?.continuityReason).toBe(
      WIZARD_CONTINUITY_LAST_ACTED_LABEL,
    )
    expect(merged.find((row) => row.hit.slug === 'visited')?.continuityReason).toBe(
      WIZARD_CONTINUITY_VISITED_LABEL,
    )
    expect(merged.find((row) => row.hit.slug === 'forgot-b')?.continuityReason).toBeUndefined()
  })

  it('caps the merged list at HOME_SEARCH_SUGGEST_LIMIT', () => {
    const manyHits = Array.from({ length: 10 }, (_, index) =>
      hit({ slug: `m-${index}`, name: `M ${index}` }),
    )
    const manyBySlug = new Map(manyHits.map((row) => [row.slug, row]))

    const merged = mergeWizardMunicipalitySuggestions({
      continuity: [],
      serverHits: manyHits,
      hitBySlug: manyBySlug,
    })

    expect(merged).toHaveLength(HOME_SEARCH_SUGGEST_LIMIT)
  })
})
