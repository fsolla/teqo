// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildRecordingListWhere } from '@/utilities/recordings/recordingListFilters'

describe('recording list filters (C199/C200)', () => {
  it('returns an empty where without search or facet', () => {
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1 })).toEqual({})
  })

  it('searches the normalized transcript text', () => {
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1, q: 'Comissão' })).toEqual({
      searchText: { like: 'comissao' },
    })
  })

  it('filters one person through the derived names', () => {
    expect(
      buildRecordingListWhere({ source: 'enviadas', page: 1, people: ['Dep. Jorge Solla'] }),
    ).toEqual({ speakerNames: { contains: 'Dep. Jorge Solla' } })
  })

  it('ORs the selected people and ANDs them with the search', () => {
    expect(
      buildRecordingListWhere({
        source: 'enviadas',
        page: 1,
        q: 'merenda',
        people: ['Solla', 'Presidente'],
      }),
    ).toEqual({
      and: [
        { searchText: { like: 'merenda' } },
        {
          or: [
            { speakerNames: { contains: 'Solla' } },
            { speakerNames: { contains: 'Presidente' } },
          ],
        },
      ],
    })
  })

  it('ANDs the C219 facets (year, topic, scope, cited municipality)', () => {
    expect(
      buildRecordingListWhere({
        source: 'enviadas',
        page: 1,
        years: [2026],
        topics: ['saude'],
        scopes: ['bahia'],
        municipalities: [42],
      }),
    ).toEqual({
      and: [
        { year: { in: [2026] } },
        { topics: { in: ['saude'] } },
        { scopes: { in: ['bahia'] } },
        { mentionedMunicipalities: { in: [42] } },
      ],
    })
  })

  it('maps each duration bucket to the shared Câmara predicate', () => {
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1, durations: ['curta'] })).toEqual({
      durationSeconds: { less_than: 120 },
    })
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1, durations: ['media'] })).toEqual({
      durationSeconds: { greater_than_equal: 120, less_than: 300 },
    })
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1, durations: ['longa'] })).toEqual({
      durationSeconds: { greater_than_equal: 300 },
    })
    expect(
      buildRecordingListWhere({ source: 'enviadas', page: 1, durations: ['sem_duracao'] }),
    ).toEqual({ durationSeconds: { exists: false } })

    // Two buckets OR together inside the AND.
    expect(
      buildRecordingListWhere({ source: 'enviadas', page: 1, durations: ['curta', 'longa'] }),
    ).toEqual({
      or: [
        { durationSeconds: { less_than: 120 } },
        { durationSeconds: { greater_than_equal: 300 } },
      ],
    })
  })

  it('ORs the literal query with the expanded theme terms, deduped', () => {
    expect(
      buildRecordingListWhere({ source: 'enviadas', page: 1, q: 'saúde' }, [
        'acesso universal à saúde',
        'saúde',
      ]),
    ).toEqual({
      or: [{ searchText: { like: 'saude' } }, { searchText: { like: 'acesso universal a saude' } }],
    })
  })

  it('gates rows without a measured duration out of the duration orders', () => {
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1, sort: 'duracao_maior' })).toEqual(
      { durationSeconds: { exists: true } },
    )

    expect(
      buildRecordingListWhere({
        source: 'enviadas',
        page: 1,
        sort: 'duracao_menor',
        q: 'merenda',
      }),
    ).toEqual({
      and: [{ durationSeconds: { exists: true } }, { searchText: { like: 'merenda' } }],
    })

    // The default order carries no gate.
    expect(buildRecordingListWhere({ source: 'enviadas', page: 1 })).toEqual({})
  })
})
