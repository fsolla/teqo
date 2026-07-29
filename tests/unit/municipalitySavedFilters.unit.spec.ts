import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearMunicipalitySavedFilters,
  listMunicipalitySavedFilters,
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  removeMunicipalitySavedFilter,
  saveMunicipalitySavedFilter,
  STORAGE_KEY,
} from '@/utilities/municipality/municipalitySavedFilters'

const hrefFor = (index: number) => `/campanha/municipios?q=recorte-${index}`

describe('municipalitySavedFilters storage', () => {
  afterEach(() => {
    clearMunicipalitySavedFilters()
    localStorage.clear()
  })

  it('returns an empty list when storage is missing or invalid', () => {
    expect(listMunicipalitySavedFilters()).toEqual([])
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(listMunicipalitySavedFilters()).toEqual([])
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ href: '/campanha/municipios' }))
    expect(listMunicipalitySavedFilters()).toEqual([])
  })

  it('drops persisted entries with a foreign href or a blank name', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { href: '/campanha/municipios?priority=alta', name: 'Prioritárias' },
        { href: '/campanha/liderancas?q=x', name: 'Outra lista' },
        { href: '/campanha/municipios?kind=zona', name: '   ' },
      ]),
    )

    expect(listMunicipalitySavedFilters()).toEqual([
      { href: '/campanha/municipios?priority=alta', name: 'Prioritárias' },
    ])
  })

  it('sorts alphabetically so a re-save never reorders the submenu', () => {
    saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Zona da Mata' })
    saveMunicipalitySavedFilter({ href: hrefFor(2), name: 'Àgua Fria' })
    saveMunicipalitySavedFilter({ href: hrefFor(3), name: 'Metropolitano' })

    expect(listMunicipalitySavedFilters().map((entry) => entry.name)).toEqual([
      'Àgua Fria',
      'Metropolitano',
      'Zona da Mata',
    ])
  })

  it('renames instead of duplicating when the same recorte is saved again', () => {
    saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Primeiro nome' })
    expect(saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Segundo nome' })).toBe('saved')

    expect(listMunicipalitySavedFilters()).toEqual([{ href: hrefFor(1), name: 'Segundo nome' }])
  })

  it('trims and caps the name', () => {
    saveMunicipalitySavedFilter({
      href: hrefFor(1),
      name: `  ${'a'.repeat(MAX_NAME_LENGTH + 10)}  `,
    })

    expect(listMunicipalitySavedFilters()[0]?.name).toBe('a'.repeat(MAX_NAME_LENGTH))
  })

  it('refuses a blank name', () => {
    expect(saveMunicipalitySavedFilter({ href: hrefFor(1), name: '   ' })).toBe('failed')
    expect(listMunicipalitySavedFilters()).toEqual([])
  })

  it('refuses a new entry at the cap instead of evicting a named one', () => {
    for (let index = 0; index < MAX_ENTRIES; index += 1) {
      expect(saveMunicipalitySavedFilter({ href: hrefFor(index), name: `Recorte ${index}` })).toBe(
        'saved',
      )
    }

    expect(saveMunicipalitySavedFilter({ href: hrefFor(99), name: 'Um a mais' })).toBe('limit')
    expect(listMunicipalitySavedFilters()).toHaveLength(MAX_ENTRIES)
    expect(listMunicipalitySavedFilters().some((entry) => entry.name === 'Um a mais')).toBe(false)
  })

  it('still renames an existing entry at the cap', () => {
    for (let index = 0; index < MAX_ENTRIES; index += 1) {
      saveMunicipalitySavedFilter({ href: hrefFor(index), name: `Recorte ${index}` })
    }

    expect(saveMunicipalitySavedFilter({ href: hrefFor(0), name: 'Renomeado no teto' })).toBe(
      'saved',
    )
    expect(listMunicipalitySavedFilters()).toHaveLength(MAX_ENTRIES)
    expect(listMunicipalitySavedFilters().some((entry) => entry.name === 'Renomeado no teto')).toBe(
      true,
    )
  })

  it('reports a failed write when storage refuses it', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Sem espaço' })).toBe('failed')
    setItem.mockRestore()
    expect(listMunicipalitySavedFilters()).toEqual([])
  })

  it('removes by href and clears everything', () => {
    saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Um' })
    saveMunicipalitySavedFilter({ href: hrefFor(2), name: 'Dois' })

    removeMunicipalitySavedFilter(hrefFor(1))
    expect(listMunicipalitySavedFilters()).toEqual([{ href: hrefFor(2), name: 'Dois' }])

    clearMunicipalitySavedFilters()
    expect(listMunicipalitySavedFilters()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('serves a stable snapshot reference until a write invalidates it', () => {
    saveMunicipalitySavedFilter({ href: hrefFor(1), name: 'Um' })
    const first = listMunicipalitySavedFilters()

    expect(listMunicipalitySavedFilters()).toBe(first)

    saveMunicipalitySavedFilter({ href: hrefFor(2), name: 'Dois' })
    expect(listMunicipalitySavedFilters()).not.toBe(first)
  })
})
