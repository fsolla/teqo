import { afterEach, describe, expect, it } from 'vitest'

import {
  clearRecentVisits,
  listRecentVisits,
  MAX_ENTRIES,
  recordRecentVisit,
  STORAGE_KEY,
  type RecentVisitEntry,
} from '@/utilities/recentVisits'

const sampleEntry = (overrides: Partial<RecentVisitEntry> = {}): RecentVisitEntry => ({
  href: '/campanha/pracas/seabra',
  label: 'Seabra',
  kind: 'plaza',
  visitedAt: 1_700_000_000_000,
  ...overrides,
})

describe('recentVisits storage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns an empty list when storage is missing or invalid', () => {
    expect(listRecentVisits()).toEqual([])
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(listRecentVisits()).toEqual([])
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ href: '/campanha/pracas/x' }))
    expect(listRecentVisits()).toEqual([])
  })

  it('drops persisted entries with retired visit kinds', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        sampleEntry({ kind: 'plaza' }),
        sampleEntry({ href: '/campanha/pracas', kind: 'plazaList' }),
        { ...sampleEntry({ href: '/campanha/nucleos/antigo' }), kind: 'nucleus' },
      ]),
    )

    expect(listRecentVisits()).toEqual([
      sampleEntry({ kind: 'plaza' }),
      sampleEntry({ href: '/campanha/pracas', kind: 'plazaList' }),
    ])
  })

  it('deduplicates by href and keeps the newest visit at the top', () => {
    recordRecentVisit(sampleEntry({ href: '/campanha/pracas/a', visitedAt: 10 }))
    recordRecentVisit(sampleEntry({ href: '/campanha/pracas/b', visitedAt: 20 }))
    recordRecentVisit(sampleEntry({ href: '/campanha/pracas/a', label: 'Atualizado', visitedAt: 30 }))

    expect(listRecentVisits()).toEqual([
      sampleEntry({ href: '/campanha/pracas/a', label: 'Atualizado', visitedAt: 30 }),
      sampleEntry({ href: '/campanha/pracas/b', visitedAt: 20 }),
    ])
  })

  it('truncates the list to MAX_ENTRIES', () => {
    for (let index = 0; index < MAX_ENTRIES + 2; index += 1) {
      recordRecentVisit(
        sampleEntry({
          href: `/campanha/pracas/praca-${index}`,
          label: `Praça ${index}`,
          visitedAt: index,
        }),
      )
    }

    const visits = listRecentVisits()
    expect(visits).toHaveLength(MAX_ENTRIES)
    expect(visits[0]?.href).toBe(`/campanha/pracas/praca-${MAX_ENTRIES + 1}`)
    expect(visits.at(-1)?.href).toBe('/campanha/pracas/praca-2')
  })

  it('clears stored visits', () => {
    recordRecentVisit(sampleEntry())
    clearRecentVisits()
    expect(listRecentVisits()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
