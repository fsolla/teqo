import { describe, expect, it } from 'vitest'

import {
  parseCampaignHiddenColumns,
  resolveCampaignColumnVisibility,
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

  it('keeps an absent list distinct from an explicitly empty list', () => {
    expect(parseCampaignHiddenColumns(undefined)).toEqual({})
    expect(parseCampaignHiddenColumns('')).toEqual({})
    expect(parseCampaignHiddenColumns('municipios:__none__')).toEqual({ municipios: [] })
  })

  it('ignores malformed entries instead of guessing', () => {
    expect(parseCampaignHiddenColumns('garbage')).toEqual({})
    expect(parseCampaignHiddenColumns(':kind')).toEqual({})
    expect(parseCampaignHiddenColumns('municipios:')).toEqual({})
  })

  it('drops unknown lists and column ids that are not identifiers', () => {
    expect(parseCampaignHiddenColumns('desconhecida:email|municipios:kind')).toEqual({
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
  it('round-trips hidden columns and explicit empty lists', () => {
    const value = { municipios: ['kind', 'trend'], demandas: [] }
    const serialized = serializeCampaignHiddenColumns(value)

    expect(parseCampaignHiddenColumns(serialized)).toEqual(value)
    expect(serializeCampaignHiddenColumns({ municipios: [] })).toBe('municipios:__none__')
    expect(serializeCampaignHiddenColumns({})).toBe('')
  })

  it('never emits a character that would break the cookie value', () => {
    const serialized = serializeCampaignHiddenColumns({ municipios: ['kind', 'trend'] })

    expect(serialized).not.toMatch(/[;,\s"\\]/)
  })
})

describe('resolveCampaignColumnVisibility', () => {
  it('applies compact defaults only when municipios is absent', () => {
    expect(resolveCampaignColumnVisibility('municipios', {})).toEqual({
      listId: 'municipios',
      hiddenColumnIds: ['goalCoverage', 'lastSignal'],
    })
    expect(resolveCampaignColumnVisibility('municipios', { municipios: [] })).toEqual({
      listId: 'municipios',
      hiddenColumnIds: [],
    })
  })

  it('keeps the existing empty default for every other list', () => {
    expect(resolveCampaignColumnVisibility('organizacoes', {})).toEqual({
      listId: 'organizacoes',
      hiddenColumnIds: [],
    })
  })

  it('hides Cobertura by default on territorios (B175), like goalCoverage on municipios', () => {
    expect(resolveCampaignColumnVisibility('territorios', {})).toEqual({
      listId: 'territorios',
      hiddenColumnIds: ['cobertura'],
    })
    expect(resolveCampaignColumnVisibility('territorios', { territorios: [] })).toEqual({
      listId: 'territorios',
      hiddenColumnIds: [],
    })
  })

  it('hides the email column by default on every person list (B197)', () => {
    for (const listId of ['liderancas', 'pessoas', 'apoiadores', 'assessores'] as const) {
      expect(resolveCampaignColumnVisibility(listId, {})).toEqual({
        listId,
        hiddenColumnIds: ['email'],
      })
    }
  })

  it('hides the Nome de legenda column by default on dobradinhas too (C129)', () => {
    expect(resolveCampaignColumnVisibility('dobradinhas', {})).toEqual({
      listId: 'dobradinhas',
      hiddenColumnIds: ['email', 'ballotName'],
    })
  })

  it('keeps a stored choice on a person list winning over the email default (B197)', () => {
    expect(resolveCampaignColumnVisibility('liderancas', { liderancas: [] })).toEqual({
      listId: 'liderancas',
      hiddenColumnIds: [],
    })
    expect(
      resolveCampaignColumnVisibility('assessores', { assessores: ['email', 'phone'] }),
    ).toEqual({
      listId: 'assessores',
      hiddenColumnIds: ['email', 'phone'],
    })
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
