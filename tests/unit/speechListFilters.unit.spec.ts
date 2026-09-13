// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildSpeechListWhere } from '@/utilities/speech/speechListFilters'
import { parseSpeechListParams } from '@/utilities/speech/speechListUrl'

describe('buildSpeechListWhere', () => {
  it('is empty without filters', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({}))).toEqual({})
  })

  it('assembles the facet filters', () => {
    const where = buildSpeechListWhere(
      parseSpeechListParams({
        year: '2026',
        topic: ['saude'],
        scope: ['bahia'],
        phase: ['Breves Comunicações'],
        municipality: '12',
      }),
    )

    expect(where).toEqual({
      and: [
        { year: { in: [2026] } },
        { topics: { in: ['saude'] } },
        { scopes: { in: ['bahia'] } },
        { phase: { in: ['Breves Comunicações'] } },
        { mentionedMunicipalities: { in: [12] } },
      ],
    })
  })

  it('searches the normalized speech text and the raw official keywords', () => {
    const where = buildSpeechListWhere(parseSpeechListParams({ q: 'Farmácia Popular' }))
    expect(where).toEqual({
      and: [
        {
          or: [
            { searchText: { like: 'farmacia popular' } },
            { keywords: { contains: 'Farmácia Popular' } },
          ],
        },
      ],
    })
  })

  it('maps each duration bucket to its range and ORs them', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: 'curta' }))).toEqual({
      and: [{ durationSeconds: { less_than: 120 } }],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['media'] }))).toEqual({
      and: [
        {
          durationSeconds: { greater_than_equal: 120, less_than: 300 },
        },
      ],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['longa'] }))).toEqual({
      and: [{ durationSeconds: { greater_than_equal: 300 } }],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['sem_duracao'] }))).toEqual({
      and: [{ durationSeconds: { exists: false } }],
    })

    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['curta', 'longa'] }))).toEqual({
      and: [
        {
          or: [
            { durationSeconds: { less_than: 120 } },
            { durationSeconds: { greater_than_equal: 300 } },
          ],
        },
      ],
    })
  })
})
