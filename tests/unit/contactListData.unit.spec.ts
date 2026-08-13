import { describe, expect, it } from 'vitest'

import type { Contact } from '@/payload-types'

import {
  contactFilterFacetsFromRows,
  filterContactRows,
  sortContactRows,
  toContactRowViewModel,
  type ContactRowViewModel,
} from '@/utilities/contacts/contactListData'
import type { ContactListState } from '@/utilities/contacts/contactListUrl'

const baseRow = (overrides: Partial<ContactRowViewModel> = {}): ContactRowViewModel => ({
  contactID: 1,
  name: 'Ana Souza',
  email: 'ana@example.com',
  phones: ['71999990000'],
  gender: 'feminino',
  state: 'BA',
  city: 'Salvador',
  postalCode: '40000-000',
  vinculos: ['liderancas'],
  ...overrides,
})

const rows = [
  baseRow({ contactID: 1, name: 'Ana Souza', gender: 'feminino', state: 'BA', city: 'Salvador' }),
  baseRow({
    contactID: 2,
    name: 'Bruno Lima',
    gender: 'masculino',
    state: 'SP',
    city: 'São Paulo',
    email: null,
    vinculos: [],
  }),
  baseRow({
    contactID: 3,
    name: 'Carla Mendes',
    gender: null,
    state: null,
    city: null,
    phones: [],
    email: 'carla@example.com',
    vinculos: ['dobradinhas', 'equipe'],
  }),
]

describe('toContactRowViewModel', () => {
  it('maps the contact doc keeping phone order and normalizing optionals', () => {
    const view = toContactRowViewModel({
      id: 7,
      name: '  Maria  ',
      email: 'maria@example.com',
      phones: [{ value: '71 9' }, { value: '75 8' }],
      gender: 'outro',
      state: 'BA',
      city: 'Camaçari',
      postalCode: '42800-000',
    } as unknown as Contact)
    expect(view).toEqual({
      contactID: 7,
      name: '  Maria  ',
      email: 'maria@example.com',
      phones: ['71 9', '75 8'],
      gender: 'outro',
      state: 'BA',
      city: 'Camaçari',
      postalCode: '42800-000',
      vinculos: [],
    })
  })

  it('degrades unknown enum values and absent optionals to null', () => {
    const view = toContactRowViewModel({
      id: 8,
      name: 'Sem Dados',
      email: null,
      phones: null,
      gender: 'desconhecido',
      state: 'BAHIA',
      city: null,
      postalCode: null,
    } as unknown as Contact)
    expect(view).toEqual({
      contactID: 8,
      name: 'Sem Dados',
      email: null,
      phones: [],
      gender: null,
      state: null,
      city: null,
      postalCode: null,
      vinculos: [],
    })
  })
})

describe('filterContactRows', () => {
  const state = (partial: Partial<ContactListState>): ContactListState => ({
    page: 1,
    ...partial,
  })

  it('keeps every row when no filter is active', () => {
    expect(filterContactRows(rows, state({}))).toHaveLength(3)
  })

  it('filters by gender and drops rows without a gender', () => {
    expect(
      filterContactRows(rows, state({ genders: ['feminino'] })).map((r) => r.contactID),
    ).toEqual([1])
    expect(
      filterContactRows(rows, state({ genders: ['masculino'] })).map((r) => r.contactID),
    ).toEqual([2])
  })

  it('filters by state and drops rows without a state', () => {
    expect(filterContactRows(rows, state({ states: ['BA'] })).map((r) => r.contactID)).toEqual([1])
  })

  it('filters by city case-insensitively', () => {
    expect(
      filterContactRows(rows, state({ cities: ['salvador'] })).map((r) => r.contactID),
    ).toEqual([1])
    expect(
      filterContactRows(rows, state({ cities: ['Salvador', 'São Paulo'] })).map((r) => r.contactID),
    ).toEqual([1, 2])
  })

  it('filters by absence with OR semantics and never matches a complete ficha', () => {
    expect(
      filterContactRows(rows, state({ ausencias: ['sem_telefone'] })).map((r) => r.contactID),
    ).toEqual([3])
    expect(
      filterContactRows(rows, state({ ausencias: ['sem_email'] })).map((r) => r.contactID),
    ).toEqual([2])
    expect(
      filterContactRows(rows, state({ ausencias: ['sem_telefone', 'sem_email'] })).map(
        (r) => r.contactID,
      ),
    ).toEqual([2, 3])
  })

  it('filters by vínculo with OR semantics (any of the selected links)', () => {
    expect(
      filterContactRows(rows, state({ vinculos: ['liderancas'] })).map((r) => r.contactID),
    ).toEqual([1])
    expect(
      filterContactRows(rows, state({ vinculos: ['dobradinhas', 'liderancas'] })).map(
        (r) => r.contactID,
      ),
    ).toEqual([1, 3])
    // A ficha without any link never matches a vínculo filter.
    expect(
      filterContactRows(rows, state({ vinculos: ['assessores'] })).map((r) => r.contactID),
    ).toEqual([])
  })

  it('combines filters with AND between facets', () => {
    expect(
      filterContactRows(rows, state({ genders: ['feminino'], states: ['BA'] })).map(
        (r) => r.contactID,
      ),
    ).toEqual([1])
    expect(
      filterContactRows(rows, state({ genders: ['feminino'], states: ['SP'] })).map(
        (r) => r.contactID,
      ),
    ).toEqual([])
  })
})

describe('contactFilterFacetsFromRows', () => {
  it('derives facets from the scoped rows, seeded with the active selections', () => {
    expect(
      contactFilterFacetsFromRows(rows, { page: 1, genders: ['feminino'], states: ['BA'] }),
    ).toEqual({
      genders: ['feminino', 'masculino'],
      states: ['BA', 'SP'],
      cities: ['Salvador', 'São Paulo'],
      vinculos: ['dobradinhas', 'equipe', 'liderancas'],
    })
  })

  it('keeps the first-seen city casing when deduping case-insensitively', () => {
    expect(
      contactFilterFacetsFromRows(
        [baseRow({ contactID: 1, city: 'Salvador' }), baseRow({ contactID: 2, city: 'salvador' })],
        { page: 1 },
      ).cities,
    ).toEqual(['Salvador'])
  })

  it('returns empty facets for an empty scope', () => {
    expect(contactFilterFacetsFromRows([], { page: 1 })).toEqual({
      genders: [],
      states: [],
      cities: [],
      vinculos: [],
    })
  })
})

describe('sortContactRows', () => {
  it('sorts by name asc by default, ties by contact id', () => {
    expect(sortContactRows(rows, 'name', 'asc').map((r) => r.contactID)).toEqual([1, 2, 3])
    expect(sortContactRows(rows, 'name', 'desc').map((r) => r.contactID)).toEqual([3, 2, 1])
  })

  it('sorts by city and estado, landing nulls last in both directions', () => {
    const byCityAsc = sortContactRows(rows, 'cidade', 'asc')
    expect(byCityAsc.map((r) => r.contactID)).toEqual([1, 2, 3])
    expect(byCityAsc[2].city).toBeNull()

    const byCityDesc = sortContactRows(rows, 'cidade', 'desc')
    expect(byCityDesc.map((r) => r.contactID)).toEqual([2, 1, 3])

    const byEstadoAsc = sortContactRows(rows, 'estado', 'asc')
    expect(byEstadoAsc.map((r) => r.contactID)).toEqual([1, 2, 3])
  })

  it('sorts by email, landing null emails last', () => {
    const byEmailAsc = sortContactRows(rows, 'email', 'asc')
    expect(byEmailAsc.map((r) => r.contactID)).toEqual([1, 3, 2])
    const byEmailDesc = sortContactRows(rows, 'email', 'desc')
    expect(byEmailDesc.map((r) => r.contactID)).toEqual([3, 1, 2])
  })

  it('does not mutate the input rows', () => {
    const before = [...rows].map((r) => r.contactID)
    sortContactRows(rows, 'name', 'desc')
    expect(rows.map((r) => r.contactID)).toEqual(before)
  })
})
