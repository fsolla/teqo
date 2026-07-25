import { describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  applyMunicipalityKindFilter,
  buildMunicipalityFilterHref,
  buildMunicipalityListHref,
  buildMunicipalityListWhere,
  buildMunicipalitySortHref,
  formatMunicipalityActiveFiltersSummary,
  formatMunicipalityConcentrationHint,
  formatMunicipalityListSortSummary,
  formatMunicipalitySignalAgeLabel,
  isMunicipalityColumnFilterActive,
  isMunicipalitySignalCold,
  MUNICIPALITY_COLD_SIGNAL_DAYS,
  municipalityListSortLabels,
  municipalitySignalAgeInDays,
  parseMunicipalityListParams,
  parseMunicipalitySortValue,
  resolveMunicipalityLastSignalAt,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  shouldUpdateMunicipalitySearchUrl,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
} from '@/utilities/municipalityUi'

describe('shouldUpdateMunicipalitySearchUrl', () => {
  it('returns false when canonical q matches the current URL q', () => {
    expect(shouldUpdateMunicipalitySearchUrl('salvador', 'salvador')).toBe(false)
    expect(shouldUpdateMunicipalitySearchUrl('  salvador  ', 'salvador')).toBe(false)
  })

  it('returns true when q differs or is newly set', () => {
    expect(shouldUpdateMunicipalitySearchUrl('salv', 'salvador')).toBe(true)
    expect(shouldUpdateMunicipalitySearchUrl('salvador', undefined)).toBe(true)
    expect(shouldUpdateMunicipalitySearchUrl('', 'salvador')).toBe(true)
  })
})

describe('municipality list sort params (A11 + B15 + E9)', () => {
  it('omits the default deficit/desc from the URL (E9 allocation queue order)', () => {
    const state = parseMunicipalityListParams({ sort: 'deficit', dir: 'desc' })
    expect(state).toMatchObject({ sort: 'deficit', dir: 'desc' })
    expect(resolveMunicipalityListSort(state)).toEqual({ sort: 'deficit', dir: 'desc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios')
  })

  it('treats an empty query as deficit desc (biggest uncovered goal first)', () => {
    const state = parseMunicipalityListParams({})
    expect(resolveMunicipalityListSort(state)).toEqual({ sort: 'deficit', dir: 'desc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios')
  })

  it('keeps sort=votos in the URL now that it is no longer the default', () => {
    const state = parseMunicipalityListParams({ sort: 'votos', dir: 'desc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios?sort=votos')
  })

  it('opens frescor on the coldest signal (desc default) and keeps asc explicit', () => {
    const base = parseMunicipalityListParams({})
    expect(buildMunicipalitySortHref(base, 'frescor')).toBe('/campanha/municipios?sort=frescor')
    const cold = parseMunicipalityListParams({ sort: 'frescor' })
    expect(resolveMunicipalityListSort(cold)).toEqual({ sort: 'frescor', dir: 'desc' })
    expect(buildMunicipalitySortHref(cold, 'frescor')).toBe(
      '/campanha/municipios?sort=frescor&dir=asc',
    )
  })

  it('keeps sort=name when sorting alphabetically (dir=asc is the name default)', () => {
    const state = parseMunicipalityListParams({ sort: 'name', dir: 'asc' })
    expect(state.sort).toBe('name')
    expect(state.dir).toBe('asc')
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios?sort=name')
  })

  it('keeps sort=votos&dir=asc when ascending', () => {
    const state = parseMunicipalityListParams({ sort: 'votos', dir: 'asc' })
    expect(state).toMatchObject({ sort: 'votos', dir: 'asc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios?sort=votos&dir=asc')
  })

  it('toggles deficit from the default desc to asc', () => {
    const base = parseMunicipalityListParams({})
    const href = buildMunicipalitySortHref(base, 'deficit')
    expect(href).toBe('/campanha/municipios?sort=deficit&dir=asc')
  })

  it('switches from name back to the default deficit desc (omitted URL)', () => {
    const base = parseMunicipalityListParams({ sort: 'name' })
    expect(buildMunicipalitySortHref(base, 'deficit')).toBe('/campanha/municipios')
  })

  it('parses mobile Ordenar values with | and rejects junk', () => {
    expect(parseMunicipalitySortValue('votos|desc')).toEqual({ key: 'votos', dir: 'desc' })
    expect(parseMunicipalitySortValue('name|asc')).toEqual({ key: 'name', dir: 'asc' })
    expect(parseMunicipalitySortValue('priority|asc')).toBeNull()
    expect(parseMunicipalitySortValue('votos')).toBeNull()
    expect(serializeMunicipalitySortValue('votos', 'desc')).toBe('votos|desc')
  })

  it('summarizes the active sort in plain language', () => {
    expect(formatMunicipalityListSortSummary('votos', 'desc')).toBe('Ordenado por 2022 ↓')
    expect(formatMunicipalityListSortSummary('votos', 'asc')).toBe('Ordenado por 2022 ↑')
    expect(formatMunicipalityListSortSummary('name', 'asc')).toBe('Ordenado por nome (A–Z)')
    expect(formatMunicipalityListSortSummary('region', 'asc')).toBe('Ordenado por Território ↑')
    expect(formatMunicipalityListSortSummary('deficit', 'desc')).toBe(
      'Ordenado por déficit da meta (maior primeiro)',
    )
    expect(formatMunicipalityListSortSummary('frescor', 'desc')).toBe(
      'Ordenado por frescor (sinal mais frio primeiro)',
    )
  })

  it('formats the concentração header hint once for tooltip/caption', () => {
    expect(formatMunicipalityConcentrationHint()).toMatch(/votação estadual/)
    expect(formatMunicipalityConcentrationHint()).toMatch(/435/)
    expect(formatMunicipalityConcentrationHint()).not.toMatch(/^%/)
    expect(formatMunicipalityConcentrationHint(12)).toMatch(/12/)
  })

  it('labels the advisor-count sort as Assessores (not Cobertura da meta)', () => {
    expect(municipalityListSortLabels.coverage).toBe('Assessores')
    expect(formatMunicipalityListSortSummary('coverage', 'asc')).toBe('Ordenado por Assessores ↑')
  })
})

describe('municipality list header filters (B16+)', () => {
  it('toggles multi region OR filters and preserves sort/dir', () => {
    const state = parseMunicipalityListParams({
      page: '3',
      sort: 'votos',
      dir: 'asc',
      kind: 'zona',
    })
    const withRegion = toggleMunicipalityMultiFilterValue(state, 'region', 'Irecê')
    expect(withRegion.regions).toEqual(['Irecê'])
    expect(withRegion.page).toBe(1)
    expect(buildMunicipalityFilterHref(withRegion)).toBe(
      '/campanha/municipios?region=Irec%C3%AA&kind=zona&sort=votos&dir=asc',
    )

    const withTwo = toggleMunicipalityMultiFilterValue(withRegion, 'region', 'Recôncavo')
    expect(withTwo.regions).toEqual(['Irecê', 'Recôncavo'])
    expect(buildMunicipalityListHref(withTwo, 1)).toContain('region=Irec')
    expect(buildMunicipalityListHref(withTwo, 1)).toContain('region=Rec')

    const cleared = toggleMunicipalityMultiFilterValue(withRegion, 'region', 'Irecê')
    expect(cleared.regions).toBeUndefined()
  })

  it('toggles the Prioritária filter in and out of the URL, keeping other filters', () => {
    const state = parseMunicipalityListParams({ region: 'Irecê' })

    const on = toggleMunicipalityPriorityFilter(state)
    expect(on.priority).toBe('alta')
    expect(buildMunicipalityFilterHref(on)).toBe(
      '/campanha/municipios?region=Irec%C3%AA&priority=alta',
    )

    const off = toggleMunicipalityPriorityFilter(on)
    expect(off.priority).toBeUndefined()
    expect(buildMunicipalityFilterHref(off)).toBe('/campanha/municipios?region=Irec%C3%AA')
  })

  it('treats every trend selected as "todas" (no narrowing constraint)', () => {
    const one = parseMunicipalityListParams({ trend: 'favoravel' })
    expect(one.trends).toEqual(['favoravel'])
    expect(isMunicipalityColumnFilterActive(one, 'trend')).toBe(true)
    expect(buildMunicipalityListWhere(one)).toEqual({
      and: [{ 'politicalTrend.status': { in: ['favoravel'] } }],
    })

    const all = parseMunicipalityListParams({ trend: ['favoravel', 'neutra', 'desfavoravel'] })
    expect(isMunicipalityColumnFilterActive(all, 'trend')).toBe(false)
    expect(buildMunicipalityListWhere(all)).toEqual({})
    expect(formatMunicipalityActiveFiltersSummary(all)).toBeNull()

    const none = toggleMunicipalityMultiFilterValue(one, 'trend', 'favoravel')
    expect(none.trends).toBeUndefined()
    expect(buildMunicipalityFilterHref(none)).toBe('/campanha/municipios')
  })

  it('toggles coverage by re-clicking the active value', () => {
    const state = parseMunicipalityListParams({})
    const on = toggleMunicipalityExclusiveFilterValue(state, 'coverage', 'com_assessor')
    expect(on.coverage).toBe('com_assessor')
    const off = toggleMunicipalityExclusiveFilterValue(on, 'coverage', 'com_assessor')
    expect(off.coverage).toBeUndefined()
  })

  it('discards invalid filter values', () => {
    const state = parseMunicipalityListParams({})
    expect(
      toggleMunicipalityMultiFilterValue(state, 'region', 'NotATerritory').regions,
    ).toBeUndefined()
    expect(applyMunicipalityKindFilter(state, 'bairro').kind).toBeUndefined()
    expect(
      toggleMunicipalityExclusiveFilterValue(state, 'coverage', 'maybe').coverage,
    ).toBeUndefined()
    expect(toggleMunicipalityMultiFilterValue(state, 'trend', 'alta').trends).toBeUndefined()
    expect(parseMunicipalityListParams({ slug: 'not-a-slug', advisor: 'x' }).slugs).toBeUndefined()
    expect(parseMunicipalityListParams({ advisor: 'x' }).advisors).toBeUndefined()
  })

  it('parses repeated advisor and slug params as OR filters', () => {
    const slug = municipalityCatalog[0]?.slug
    expect(slug).toBeTruthy()
    const state = parseMunicipalityListParams({
      slug: [slug!, 'also-invalid'],
      advisor: ['12', '12', '7'],
    })
    expect(state.slugs).toEqual([slug])
    expect(state.advisors).toEqual([7, 12])
  })

  it('summarizes active filters for the slim bar', () => {
    expect(formatMunicipalityActiveFiltersSummary(parseMunicipalityListParams({}))).toBeNull()
    expect(
      formatMunicipalityActiveFiltersSummary(
        parseMunicipalityListParams({ region: 'Irecê', priority: 'alta', q: 'feira' }),
      ),
    ).toBe('Prioritária · Irecê · Busca "feira"')
  })
})

describe('E9 frescor do sinal', () => {
  const now = new Date('2026-07-24T12:00:00.000Z')

  it('takes the latest of the staff update and the pledge dates', () => {
    expect(
      resolveMunicipalityLastSignalAt('2026-07-01T00:00:00.000Z', '2026-07-10T00:00:00.000Z'),
    ).toBe('2026-07-10T00:00:00.000Z')
    expect(
      resolveMunicipalityLastSignalAt('2026-07-20T00:00:00.000Z', '2026-07-10T00:00:00.000Z'),
    ).toBe('2026-07-20T00:00:00.000Z')
  })

  it('falls back to whichever side exists, and stays null when neither does', () => {
    expect(resolveMunicipalityLastSignalAt(null, '2026-07-10T00:00:00.000Z')).toBe(
      '2026-07-10T00:00:00.000Z',
    )
    expect(resolveMunicipalityLastSignalAt('2026-07-10T00:00:00.000Z', null)).toBe(
      '2026-07-10T00:00:00.000Z',
    )
    expect(resolveMunicipalityLastSignalAt(null, null)).toBeNull()
  })

  it('floors the age in days and never goes negative on a future timestamp', () => {
    expect(municipalitySignalAgeInDays('2026-07-24T00:00:00.000Z', now)).toBe(0)
    expect(municipalitySignalAgeInDays('2026-07-23T00:00:00.000Z', now)).toBe(1)
    expect(municipalitySignalAgeInDays('2026-07-01T00:00:00.000Z', now)).toBe(23)
    expect(municipalitySignalAgeInDays('2026-08-01T00:00:00.000Z', now)).toBe(0)
    expect(municipalitySignalAgeInDays(null, now)).toBeNull()
  })

  it('treats "no signal at all" as cold, alongside anything past the threshold', () => {
    expect(isMunicipalitySignalCold(null)).toBe(true)
    expect(isMunicipalitySignalCold(MUNICIPALITY_COLD_SIGNAL_DAYS)).toBe(true)
    expect(isMunicipalitySignalCold(MUNICIPALITY_COLD_SIGNAL_DAYS - 1)).toBe(false)
    expect(isMunicipalitySignalCold(0)).toBe(false)
  })

  it('labels the age in dense pt-BR copy', () => {
    expect(formatMunicipalitySignalAgeLabel(null)).toBe('Sem sinal')
    expect(formatMunicipalitySignalAgeLabel(0)).toBe('hoje')
    expect(formatMunicipalitySignalAgeLabel(1)).toBe('há 1 dia')
    expect(formatMunicipalitySignalAgeLabel(30)).toBe('há 30 dias')
  })
})
