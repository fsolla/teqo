// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildSpeechListWhere,
  buildSpeechListWhereIncludingCutOrigins,
} from '@/utilities/speech/speechListFilters'
import { parseSpeechListParams } from '@/utilities/speech/speechListUrl'

// C215 — the Câmara list contract always carries the source discriminator.
const camara = { origin: { equals: 'camara' } }

describe('buildSpeechListWhere', () => {
  it('keeps only the Câmara discriminator without filters', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({}))).toEqual({ and: [camara] })
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
        camara,
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
        camara,
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
      and: [camara, { durationSeconds: { less_than: 120 } }],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['media'] }))).toEqual({
      and: [
        camara,
        {
          durationSeconds: { greater_than_equal: 120, less_than: 300 },
        },
      ],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['longa'] }))).toEqual({
      and: [camara, { durationSeconds: { greater_than_equal: 300 } }],
    })
    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['sem_duracao'] }))).toEqual({
      and: [camara, { durationSeconds: { exists: false } }],
    })

    expect(buildSpeechListWhere(parseSpeechListParams({ duration: ['curta', 'longa'] }))).toEqual({
      and: [
        camara,
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
        camara,
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
        camara,
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

describe('buildSpeechListWhere theme expansion (C192)', () => {
  it('ORs the query with every expanded theme term', () => {
    const where = buildSpeechListWhere(parseSpeechListParams({ q: 'defesa do SUS' }), [
      'saúde pública',
      'SUS',
    ])

    expect(where).toEqual({
      and: [
        camara,
        {
          or: [
            { searchText: { like: 'defesa do sus' } },
            { keywords: { contains: 'defesa do SUS' } },
            { searchText: { like: 'saude publica' } },
            { keywords: { contains: 'saúde pública' } },
            { searchText: { like: 'sus' } },
            { keywords: { contains: 'SUS' } },
          ],
        },
      ],
    })
  })

  it('dedupes a term that repeats the query', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({ q: 'SUS' }), ['SUS'])).toEqual({
      and: [camara, { or: [{ searchText: { like: 'sus' } }, { keywords: { contains: 'SUS' } }] }],
    })
  })

  it('keeps the facets AND-ed and the cut origins OR-ed alongside the expansion', () => {
    expect(
      buildSpeechListWhereIncludingCutOrigins(
        parseSpeechListParams({ q: 'reforma', topic: ['saude'] }),
        [7],
        ['saúde'],
      ),
    ).toEqual({
      and: [
        camara,
        { topics: { in: ['saude'] } },
        {
          or: [
            { searchText: { like: 'reforma' } },
            { keywords: { contains: 'reforma' } },
            { searchText: { like: 'saude' } },
            { keywords: { contains: 'saúde' } },
            { id: { in: [7] } },
          ],
        },
      ],
    })
  })

  it('stays byte-identical to today without theme terms', () => {
    const state = parseSpeechListParams({ q: 'reforma' })
    expect(buildSpeechListWhere(state, [])).toEqual(buildSpeechListWhere(state))
  })
})

// C216 — the web source derives `origin: web` from the state and has no Fase
// facet; the duration-sort gate only exists there.
describe('buildSpeechListWhere web source (C216)', () => {
  const web = { origin: { equals: 'web' } }

  it('keeps only the web discriminator without filters', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({ source: 'internet' }))).toEqual({
      and: [web],
    })
  })

  it('assembles the facet filters and ignores a phase that slipped through', () => {
    const state = parseSpeechListParams({
      source: 'internet',
      year: '2026',
      topic: ['saude'],
      municipality: '12',
      phase: 'Ordem do Dia',
    })

    expect(buildSpeechListWhere(state)).toEqual({
      and: [
        web,
        { year: { in: [2026] } },
        { topics: { in: ['saude'] } },
        { mentionedMunicipalities: { in: [12] } },
      ],
    })
  })

  it('searches the normalized text and the raw keyword branch (the row may have neither)', () => {
    expect(buildSpeechListWhere(parseSpeechListParams({ source: 'internet', q: 'SUS' }))).toEqual({
      and: [web, { or: [{ searchText: { like: 'sus' } }, { keywords: { contains: 'SUS' } }] }],
    })
  })

  it('gates the duration orders on a measured duration', () => {
    expect(
      buildSpeechListWhere(parseSpeechListParams({ source: 'internet', sort: 'duracao_maior' })),
    ).toEqual({ and: [web, { durationSeconds: { exists: true } }] })

    expect(buildSpeechListWhere(parseSpeechListParams({ source: 'internet' }))).toEqual({
      and: [web],
    })
  })
})
