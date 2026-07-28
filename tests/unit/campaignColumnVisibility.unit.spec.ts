import { describe, expect, it } from 'vitest'

import {
  parseCampaignHiddenColumns,
  resolveVisibleColumns,
  serializeCampaignHiddenColumns,
  toggleHiddenColumn,
} from '@/lib/campaignColumnVisibility'

describe('parseCampaignHiddenColumns', () => {
  it('reads one list and several lists', () => {
    expect(parseCampaignHiddenColumns('municipios:kind~trend')).toEqual({
      municipios: ['kind', 'trend'],
    })
    expect(parseCampaignHiddenColumns('municipios:kind|liderancas:organizations')).toEqual({
      municipios: ['kind'],
      liderancas: ['organizations'],
    })
  })

  it('shows the full table when the cookie is absent, empty or malformed', () => {
    expect(parseCampaignHiddenColumns(undefined)).toEqual({})
    expect(parseCampaignHiddenColumns('')).toEqual({})
    expect(parseCampaignHiddenColumns('garbage')).toEqual({})
    expect(parseCampaignHiddenColumns(':kind')).toEqual({})
    expect(parseCampaignHiddenColumns('municipios:')).toEqual({})
  })

  it('drops unknown lists and column ids that are not identifiers', () => {
    expect(parseCampaignHiddenColumns('assessores:email|municipios:kind')).toEqual({
      municipios: ['kind'],
    })
    expect(parseCampaignHiddenColumns('municipios:kind~<script>~trend')).toEqual({
      municipios: ['kind', 'trend'],
    })
  })

  it('dedupes and refuses an oversized cookie instead of trusting it', () => {
    expect(parseCampaignHiddenColumns('municipios:kind~kind')).toEqual({ municipios: ['kind'] })
    expect(parseCampaignHiddenColumns(`municipios:${'a'.repeat(4000)}`)).toEqual({})
  })
})

describe('serializeCampaignHiddenColumns', () => {
  it('round-trips through parse and omits lists with nothing hidden', () => {
    const value = { municipios: ['kind', 'trend'], demandas: ['requester'] }
    const serialized = serializeCampaignHiddenColumns(value)

    expect(parseCampaignHiddenColumns(serialized)).toEqual(value)
    expect(serializeCampaignHiddenColumns({ municipios: [] })).toBe('')
  })

  it('never emits a character that would break the cookie value', () => {
    const serialized = serializeCampaignHiddenColumns({ municipios: ['kind', 'trend'] })

    expect(serialized).not.toMatch(/[;,\s"\\]/)
  })
})

describe('toggleHiddenColumn', () => {
  it('hides, shows and never duplicates an id', () => {
    const hidden = toggleHiddenColumn([], 'kind', false)
    expect(hidden).toEqual(['kind'])

    expect(toggleHiddenColumn(hidden, 'kind', false)).toEqual(['kind'])
    expect(toggleHiddenColumn(hidden, 'kind', true)).toEqual([])
  })

  it('leaves the other columns of the list alone', () => {
    expect(toggleHiddenColumn(['trend', 'kind'], 'kind', true)).toEqual(['trend'])
    expect(toggleHiddenColumn(['trend'], 'kind', false)).toEqual(['trend', 'kind'])
  })
})

describe('resolveVisibleColumns', () => {
  const columns = [{ id: 'name', mandatory: true }, { id: 'kind' }, { id: 'trend' }]

  it('drops the hidden columns and keeps the declared order', () => {
    expect(resolveVisibleColumns(columns, ['trend']).map((column) => column.id)).toEqual([
      'name',
      'kind',
    ])
  })

  it('never drops a mandatory column, whatever the cookie says', () => {
    expect(resolveVisibleColumns(columns, ['name', 'kind', 'trend']).map((c) => c.id)).toEqual([
      'name',
    ])
  })

  it('returns every column when nothing is hidden', () => {
    expect(resolveVisibleColumns(columns, undefined)).toHaveLength(3)
    expect(resolveVisibleColumns(columns, [])).toHaveLength(3)
  })
})
