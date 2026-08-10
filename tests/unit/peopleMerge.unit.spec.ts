import { describe, expect, it } from 'vitest'

import {
  filterPeopleRows,
  mergePeopleSources,
  peopleFilterFacetsFromRows,
  scopePeopleRows,
  type MergedPerson,
  type PeopleMergeSources,
} from '@/utilities/people/peopleData'

const source: PeopleMergeSources = {
  leaderships: [
    {
      id: 10,
      contactID: 100,
      name: 'Maria Souza',
      phone: '71999990001',
      email: 'maria@example.com',
      city: 'Feira de Santana',
      municipalityIDs: [3, 4],
      supportStatus: 'engajado',
      hasAppAccess: true,
      advisorIDs: [21],
    },
  ],
  deputies: [
    {
      id: 20,
      contactID: 101,
      name: 'Ana Lima',
      phone: null,
      email: 'ana@example.com',
      city: 'Camaçari',
      party: 'PCdoB',
      municipalityIDs: [5],
      advisorIDs: [22, 23],
    },
  ],
  staff: [
    {
      id: 31,
      contactID: 100,
      name: 'Maria Souza',
      phone: '71999990001',
      email: 'maria@example.com',
      city: 'Feira de Santana',
      role: 'advisor',
      municipalityIDs: [3, 6],
    },
    {
      id: 32,
      contactID: 102,
      name: 'João Pereira',
      phone: null,
      email: null,
      city: null,
      role: 'advisor',
      municipalityIDs: [],
    },
    {
      id: 33,
      contactID: 103,
      name: 'Jorge Solla',
      phone: null,
      email: null,
      city: null,
      role: 'candidate',
      municipalityIDs: [1],
    },
  ],
}

const byContact = (rows: readonly MergedPerson[], contactID: number): MergedPerson => {
  const row = rows.find((person) => person.contactID === contactID)
  if (!row) throw new Error(`Missing merged person ${contactID}`)
  return row
}

describe('mergePeopleSources (C100)', () => {
  it('merges one row per contact, accumulating capacities', () => {
    const rows = mergePeopleSources(source)

    expect(rows.map((row) => row.contactID).sort()).toEqual([100, 101, 102, 103])

    const maria = byContact(rows, 100)
    expect(maria.name).toBe('Maria Souza')
    expect(maria.phone).toBe('71999990001')
    expect(maria.email).toBe('maria@example.com')
    expect(maria.city).toBe('Feira de Santana')
    expect(maria.leadershipID).toBe(10)
    expect(maria.leadershipMunicipalityIDs).toEqual([3, 4])
    expect(maria.supportStatus).toBe('engajado')
    expect(maria.hasAppAccess).toBe(true)
    expect(maria.staff.map((account) => account.id)).toEqual([31])
    expect(maria.assessoraMunicipalityIDs).toEqual([3, 6])
    expect(maria.capacityMunicipalityIDs).toEqual([3, 4, 6])
  })

  it('carries the party from the dobradinha and keeps its municipalities', () => {
    const ana = byContact(mergePeopleSources(source), 101)
    expect(ana.party).toBe('PCdoB')
    expect(ana.deputyID).toBe(20)
    expect(ana.deputyMunicipalityIDs).toEqual([5])
    expect(ana.capacityMunicipalityIDs).toEqual([5])
  })

  it('keeps a staff account with an EMPTY carteira as a capacity (gate 2026-08-09)', () => {
    const joao = byContact(mergePeopleSources(source), 102)
    expect(joao.staff).toHaveLength(1)
    expect(joao.assessoraMunicipalityIDs).toEqual([])
    expect(joao.capacityMunicipalityIDs).toEqual([])
  })

  it('sorts and dedupes the capacity municipality unions', () => {
    const maria = byContact(mergePeopleSources(source), 100)
    expect(maria.assessoraMunicipalityIDs).toEqual([3, 6])
    expect(maria.capacityMunicipalityIDs).toEqual([3, 4, 6])
  })

  it('merges multiple staff accounts sharing one ficha into one row', () => {
    const rows = mergePeopleSources({
      leaderships: [],
      deputies: [],
      staff: [
        {
          id: 41,
          contactID: 200,
          name: 'Dupla',
          phone: null,
          email: null,
          city: null,
          role: 'advisor',
          municipalityIDs: [1],
        },
        {
          id: 42,
          contactID: 200,
          name: 'Dupla',
          phone: null,
          email: null,
          city: null,
          role: 'coordinator',
          municipalityIDs: [2],
        },
      ],
    })
    const person = byContact(rows, 200)
    expect(person.staff.map((account) => account.id).sort()).toEqual([41, 42])
    expect(person.assessoraMunicipalityIDs).toEqual([1, 2])
    expect(rows).toHaveLength(1)
  })
})

describe('scopePeopleRows (advisor viewer)', () => {
  it('keeps every row for unrestricted actors', () => {
    const rows = mergePeopleSources(source)
    expect(scopePeopleRows(rows, null)).toHaveLength(4)
  })

  it('keeps rows with any capacity municipality in the portfolio', () => {
    const rows = mergePeopleSources(source)
    const scoped = scopePeopleRows(rows, new Set([6]))
    expect(scoped.map((row) => row.contactID).sort()).toEqual([100])
  })

  it('drops rows without any capacity municipality in the portfolio', () => {
    const rows = mergePeopleSources(source)
    const scoped = scopePeopleRows(rows, new Set([1]))
    expect(scoped.map((row) => row.contactID)).toEqual([103])
  })

  it('hides staff with an empty carteira from every advisor portfolio', () => {
    const rows = mergePeopleSources(source)
    const scoped = scopePeopleRows(rows, new Set([3, 4, 5, 6]))
    expect(scoped.some((row) => row.contactID === 102)).toBe(false)
  })
})

describe('filterPeopleRows', () => {
  const rows = mergePeopleSources(source)

  it('filters by capacity with OR semantics within the facet', () => {
    expect(
      filterPeopleRows(rows, { page: 1, capacities: ['lideranca'] }).map((row) => row.contactID),
    ).toEqual([100])
    expect(
      filterPeopleRows(rows, { page: 1, capacities: ['lideranca', 'dobradinha'] })
        .map((row) => row.contactID)
        .sort(),
    ).toEqual([100, 101])
    expect(
      filterPeopleRows(rows, { page: 1, capacities: ['assessora'] })
        .map((row) => row.contactID)
        .sort(),
    ).toEqual([100, 103])
  })

  it('filters by municipality intersecting any capacity', () => {
    expect(
      filterPeopleRows(rows, { page: 1, municipalities: [5] }).map((row) => row.contactID),
    ).toEqual([101])
    expect(
      filterPeopleRows(rows, { page: 1, municipalities: [3] }).map((row) => row.contactID),
    ).toEqual([100])
    expect(filterPeopleRows(rows, { page: 1, municipalities: [99] })).toEqual([])
  })

  it('filters by leadership status, dropping non-leadership rows', () => {
    expect(
      filterPeopleRows(rows, { page: 1, statuses: ['engajado'] }).map((row) => row.contactID),
    ).toEqual([100])
    expect(filterPeopleRows(rows, { page: 1, statuses: ['negativo'] })).toEqual([])
  })
})

describe('peopleFilterFacetsFromRows', () => {
  it('unions the capacity municipalities and statuses of the scoped rows with the selected values', () => {
    const rows = mergePeopleSources(source)
    const facets = peopleFilterFacetsFromRows(rows, { page: 1, municipalities: [99] })
    expect(facets.municipalityIDs).toEqual([1, 3, 4, 5, 6, 99])
    expect(facets.statuses).toEqual(['engajado'])
  })
})
