import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPeopleSavedFilters,
  listPeopleSavedFilters,
  removePeopleSavedFilter,
  savePeopleSavedFilter,
  STORAGE_KEY,
  subscribePeopleSavedFilters,
} from '@/utilities/people/peopleSavedFilters'

/**
 * C100 saved-filter store — the same behavioral contract as the B18
 * municipality suite, exercised through the shared `createSavedFilterStore`
 * factory (the municipality module keeps its own pinned suite).
 */

const hrefFor = (page = 1): string => `/campanha/pessoas?q=${page}`

const stub = (entries: unknown): void => {
  if (entries === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

describe('peopleSavedFilters storage', () => {
  beforeEach(() => {
    clearPeopleSavedFilters()
    vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'removeItem')
  })

  it('returns an empty list for an empty store', () => {
    expect(listPeopleSavedFilters()).toEqual([])
    stub('not-json')
    expect(listPeopleSavedFilters()).toEqual([])
    stub({ href: '/campanha/pessoas' })
    expect(listPeopleSavedFilters()).toEqual([])
  })

  it('saves entries alphabetically and rejects foreign hrefs', () => {
    savePeopleSavedFilter({ href: hrefFor(1), name: 'Zona da Mata' })
    savePeopleSavedFilter({ href: '/campanha/municipios?q=x', name: 'De outra lista' })
    savePeopleSavedFilter({ href: hrefFor(2), name: 'Àgua Fria' })
    expect(listPeopleSavedFilters().map((entry) => entry.name)).toEqual([
      'Àgua Fria',
      'Zona da Mata',
    ])
    expect(
      listPeopleSavedFilters().every((entry) => entry.href.startsWith('/campanha/pessoas')),
    ).toBe(true)
  })

  it('renames an entry with the same href instead of duplicating it', () => {
    savePeopleSavedFilter({ href: hrefFor(1), name: 'Primeiro nome' })
    expect(savePeopleSavedFilter({ href: hrefFor(1), name: 'Segundo nome' })).toBe('saved')
    expect(listPeopleSavedFilters()).toEqual([{ href: hrefFor(1), name: 'Segundo nome' }])
  })

  it('trims and caps the name', () => {
    savePeopleSavedFilter({ href: hrefFor(1), name: ` ${'a'.repeat(80)} ` })
    expect(listPeopleSavedFilters()[0]?.name).toBe('a'.repeat(60))
  })

  it('refuses a blank name', () => {
    expect(savePeopleSavedFilter({ href: hrefFor(1), name: '   ' })).toBe('failed')
    expect(listPeopleSavedFilters()).toEqual([])
  })

  it('refuses a save past the entry cap, but still allows renames', () => {
    for (let index = 0; index < 12; index += 1) {
      savePeopleSavedFilter({ href: hrefFor(index), name: `Recorte ${index}` })
    }
    expect(savePeopleSavedFilter({ href: hrefFor(99), name: 'Um a mais' })).toBe('limit')
    expect(listPeopleSavedFilters()).toHaveLength(12)
    expect(savePeopleSavedFilter({ href: hrefFor(0), name: 'Renomeado no teto' })).toBe('saved')
    expect(listPeopleSavedFilters().some((entry) => entry.name === 'Renomeado no teto')).toBe(true)
  })

  it('removes and clears entries', () => {
    savePeopleSavedFilter({ href: hrefFor(1), name: 'Um' })
    savePeopleSavedFilter({ href: hrefFor(2), name: 'Dois' })
    removePeopleSavedFilter(hrefFor(1))
    expect(listPeopleSavedFilters()).toEqual([{ href: hrefFor(2), name: 'Dois' }])
    clearPeopleSavedFilters()
    expect(listPeopleSavedFilters()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('caches the snapshot until a write and notifies subscribers', () => {
    savePeopleSavedFilter({ href: hrefFor(1), name: 'Um' })
    const first = listPeopleSavedFilters()
    expect(listPeopleSavedFilters()).toBe(first)
    const subscriber = vi.fn()
    const unsubscribe = subscribePeopleSavedFilters(subscriber)
    savePeopleSavedFilter({ href: hrefFor(2), name: 'Dois' })
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(listPeopleSavedFilters()).not.toBe(first)
    unsubscribe()
  })
})
