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
})
