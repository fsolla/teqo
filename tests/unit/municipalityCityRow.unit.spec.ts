import { describe, expect, it } from 'vitest'

import type { Municipality } from '@/payload-types'
import {
  CITY_MUNICIPALITY_ID,
  buildCityMunicipalityDoc,
  cityMatchesFilter,
  cityTerritorialClass,
  insertCityAtNativeSortPosition,
} from '@/utilities/municipality/municipalityCityRow'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'

/**
 * B178 — the city row of the municipality list behaves like a normal entity:
 * `cityMatchesFilter` mirrors `buildMunicipalityListWhere` semantics over the
 * city's virtual values, and `insertCityAtNativeSortPosition` places it under
 * native sorts without re-sorting the SQL-ordered docs.
 */

const emptyState = (): MunicipalityListState => ({ page: 1 })

describe('cityMatchesFilter', () => {
  it('selects the city in the default recorte', () => {
    expect(cityMatchesFilter(emptyState())).toBe(true)
  })

  it('matches the free-text search the same way the DB name contains does', () => {
    expect(cityMatchesFilter({ ...emptyState(), q: 'salvador' })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), q: 'Salvador' })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), q: 'cidade' })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), q: 'são paulo' })).toBe(false)
    // A bare zone number is a zone search — the city has no zoneNumber.
    expect(cityMatchesFilter({ ...emptyState(), q: '3' })).toBe(false)
  })

  it('matches the region filter with its own territory', () => {
    expect(cityMatchesFilter({ ...emptyState(), regions: ['Metropolitano de Salvador'] })).toBe(
      true,
    )
    expect(cityMatchesFilter({ ...emptyState(), regions: ['Chapada Diamantina'] })).toBe(false)
  })

  it('matches the slug filter only for its own slug', () => {
    expect(cityMatchesFilter({ ...emptyState(), slugs: ['salvador'] })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), slugs: ['salvador-ze-1'] })).toBe(false)
  })

  it('never matches filters the city has no value for', () => {
    expect(cityMatchesFilter({ ...emptyState(), advisors: [1] })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), priority: 'alta' })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), trends: ['favoravel'] })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), levels: ['n0'] })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), stateDeputies: [1] })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), leaderships: [1] })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), parties: ['PT'] })).toBe(false)
  })

  it('matches the absence sentinels like a municipality without those links', () => {
    expect(cityMatchesFilter({ ...emptyState(), coverage: 'sem_assessor' })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), coverage: 'com_assessor' })).toBe(false)
    expect(cityMatchesFilter({ ...emptyState(), levels: ['sem_nivel'] })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), stateDeputies: ['sem_dobradinha'] })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), leaderships: ['sem_lideranca'] })).toBe(true)
    expect(cityMatchesFilter({ ...emptyState(), parties: ['sem_partido'] })).toBe(true)
    // A mixed selection still fails: named values cannot be satisfied.
    expect(cityMatchesFilter({ ...emptyState(), levels: ['n0', 'sem_nivel'] })).toBe(false)
  })

  it('matches the class filter only for its own aggregate class', () => {
    const ownClass = cityTerritorialClass().class
    expect(cityMatchesFilter({ ...emptyState(), classes: [ownClass] })).toBe(true)
    const allClasses: MunicipalityTerritorialClass[] = [
      'reduto',
      'expansao',
      'manutencao',
      'marginal',
      'sem_base',
    ]
    for (const other of allClasses.filter((value) => value !== ownClass)) {
      expect(cityMatchesFilter({ ...emptyState(), classes: [other] })).toBe(false)
    }
  })
})

const cityDoc = buildCityMunicipalityDoc()

describe('buildCityMunicipalityDoc', () => {
  it('uses a sentinel id and virtual values only', () => {
    expect(cityDoc.id).toBe(CITY_MUNICIPALITY_ID)
    expect(cityDoc.slug).toBe('salvador')
    expect(cityDoc.name).toBe('Salvador (cidade)')
    expect(cityDoc.advisors).toEqual([])
    expect(cityDoc.stateDeputies).toEqual([])
    expect(cityDoc.engagementLevel).toBeNull()
    expect(cityDoc.expectedVotes).toBeUndefined()
    expect(cityDoc.lastUpdateAt).toBeNull()
  })
})

const doc = (name: string, region: string) =>
  ({ slug: `slug-${name}`, name, region }) as Municipality

describe('insertCityAtNativeSortPosition', () => {
  const docs = [
    doc('Alagoinhas', 'Litoral Norte e Agreste Baiano'),
    doc('Salvador — ZE 1', 'Metropolitano de Salvador'),
    doc('Salvador — ZE 19', 'Metropolitano de Salvador'),
    doc('Teixeira de Freitas', 'Extremo Sul'),
  ]

  it('places the city inside the Salvador block on name asc without re-sorting the rest', () => {
    const sorted = insertCityAtNativeSortPosition(docs, cityDoc, 'name', 'asc')
    const names = sorted.map((entry) => entry.name)
    // Node's pt-BR collation orders "Salvador — ZE N" before "Salvador
    // (cidade)" (the em dash + digit collate ahead of the parenthesized word),
    // so the city lands right after its zones — still inside the block, with
    // every other row keeping the SQL order.
    expect(names).toEqual([
      'Alagoinhas',
      'Salvador — ZE 1',
      'Salvador — ZE 19',
      'Salvador (cidade)',
      'Teixeira de Freitas',
    ])
  })

  it('places the city first within the block on name desc', () => {
    const sorted = insertCityAtNativeSortPosition(docs, cityDoc, 'name', 'desc')
    const names = sorted.map((entry) => entry.name)
    expect(names[0]).toBe('Salvador (cidade)')
    expect(names.indexOf('Salvador — ZE 1')).toBeLessThan(names.indexOf('Teixeira de Freitas'))
  })

  it('keeps the SQL order of the other rows untouched', () => {
    const sorted = insertCityAtNativeSortPosition(docs, cityDoc, 'name', 'asc')
    const zoneIndex = sorted.findIndex((entry) => entry.name === 'Salvador — ZE 1')
    expect(sorted[zoneIndex + 1]?.name).toBe('Salvador — ZE 19')
  })

  it('sorts the city to the end for null-valued native keys', () => {
    const sorted = insertCityAtNativeSortPosition(docs, cityDoc, 'lastUpdateAt', 'asc')
    expect(sorted[sorted.length - 1]?.slug).toBe(cityDoc.slug)
    const sortedDesc = insertCityAtNativeSortPosition(docs, cityDoc, 'trend', 'desc')
    expect(sortedDesc[sortedDesc.length - 1]?.slug).toBe(cityDoc.slug)
  })
})
