// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildSpeechListWhere,
  buildSpeechListWhereIncludingCutOrigins,
} from '@/utilities/speech/speechListFilters'
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

describe('buildSpeechListWhereIncludingCutOrigins (C174)', () => {
  it('matches the text branch or the origin speech of a matching cut', () => {
    const where = buildSpeechListWhereIncludingCutOrigins(
      parseSpeechListParams({ q: 'reforma' }),
      [7, 9],
    )

    expect(where).toEqual({
      and: [
        {
          or: [
            { searchText: { like: 'reforma' } },
            { keywords: { contains: 'reforma' } },
            { id: { in: [7, 9] } },
          ],
        },
      ],
    })
  })

  it('keeps the facets AND-ed and stays identical to the plain where without origins', () => {
    const withFacet = buildSpeechListWhereIncludingCutOrigins(
      parseSpeechListParams({ q: 'reforma', topic: ['saude'] }),
      [7],
    )
    expect(withFacet).toEqual({
      and: [
        { topics: { in: ['saude'] } },
        {
          or: [
            { searchText: { like: 'reforma' } },
            { keywords: { contains: 'reforma' } },
            { id: { in: [7] } },
          ],
        },
      ],
    })

    const state = parseSpeechListParams({ q: 'reforma' })
    expect(buildSpeechListWhereIncludingCutOrigins(state, [])).toEqual(buildSpeechListWhere(state))
  })
})
