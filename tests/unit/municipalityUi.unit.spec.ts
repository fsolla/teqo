import { describe, expect, it } from 'vitest'

import {
  buildMunicipalityListHref,
  buildMunicipalitySortHref,
  formatMunicipalityConcentrationHint,
  formatMunicipalityListSortSummary,
  parseMunicipalityListParams,
  parseMunicipalitySortValue,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  shouldUpdateMunicipalitySearchUrl,
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

describe('municipality list sort params (A11 + B15)', () => {
  it('omits default votos/desc from the URL (mesa order)', () => {
    const state = parseMunicipalityListParams({ sort: 'votos', dir: 'desc' })
    expect(state).toMatchObject({ sort: 'votos', dir: 'desc' })
    expect(resolveMunicipalityListSort(state)).toEqual({ sort: 'votos', dir: 'desc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios')
  })

  it('treats an empty query as votos desc', () => {
    const state = parseMunicipalityListParams({})
    expect(resolveMunicipalityListSort(state)).toEqual({ sort: 'votos', dir: 'desc' })
    expect(buildMunicipalityListHref(state, 1)).toBe('/campanha/municipios')
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

  it('toggles votos from default desc to asc', () => {
    const base = parseMunicipalityListParams({})
    const href = buildMunicipalitySortHref(base, 'votos')
    expect(href).toBe('/campanha/municipios?sort=votos&dir=asc')
  })

  it('switches from name to votos with default desc (omitted URL)', () => {
    const base = parseMunicipalityListParams({ sort: 'name' })
    expect(buildMunicipalitySortHref(base, 'votos')).toBe('/campanha/municipios')
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
    expect(formatMunicipalityListSortSummary('region', 'asc')).toBe(
      'Ordenado por Território de identidade ↑',
    )
  })

  it('formats the concentração header hint once for tooltip/caption', () => {
    expect(formatMunicipalityConcentrationHint()).toMatch(/votação estadual/)
    expect(formatMunicipalityConcentrationHint()).toMatch(/435/)
    expect(formatMunicipalityConcentrationHint()).not.toMatch(/^%/)
    expect(formatMunicipalityConcentrationHint(12)).toMatch(/12/)
  })
})
