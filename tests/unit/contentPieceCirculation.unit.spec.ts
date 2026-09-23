// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CONTENT_PIECE_CIRCULATION_HISTORY_LABEL,
  CONTENT_PIECE_CIRCULATION_METRICS,
  CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_LABEL,
  CONTENT_PIECE_CIRCULATION_ZERO_LABEL,
  EMPTY_CONTENT_PIECE_CIRCULATION,
  contentPieceCirculationFromRows,
  isContentPieceCirculationEmpty,
  resolveContentPieceCirculation,
  showsContentPieceCirculationHistory,
  type ContentPieceCirculationCounts,
} from '@/lib/contentPieceCirculation'

const counts = (
  overrides: Partial<ContentPieceCirculationCounts> = {},
): ContentPieceCirculationCounts => ({ ...EMPTY_CONTENT_PIECE_CIRCULATION, ...overrides })

describe('content piece circulation vocabulary', () => {
  it('maps the four event types to the four counters, once each', () => {
    expect(CONTENT_PIECE_CIRCULATION_METRICS.map((metric) => metric.eventType)).toEqual([
      'abertura',
      'download',
      'compartilhar_whatsapp',
      'compartilhar_link',
    ])
    expect(new Set(CONTENT_PIECE_CIRCULATION_METRICS.map((metric) => metric.key)).size).toBe(4)
    // The detail names the action the fourth counter measures.
    expect(
      CONTENT_PIECE_CIRCULATION_METRICS.find((metric) => metric.key === 'link')?.detailLabel,
    ).toBe('Link copiado')
  })

  it('pins the honest literals of the design', () => {
    expect(CONTENT_PIECE_CIRCULATION_ZERO_LABEL).toBe(
      '0 abertura · 0 download · 0 WhatsApp · 0 link',
    )
    expect(CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_LABEL).toBe('Sem dados — ainda não publicada')
    expect(CONTENT_PIECE_CIRCULATION_HISTORY_LABEL).toBe(
      'Histórico de quando esteve publicada · peça fora do ar',
    )
  })
})

describe('contentPieceCirculationFromRows', () => {
  it('groups the aggregate rows per piece, ignoring unknown types and subjects', () => {
    const byPieceId = contentPieceCirculationFromRows([
      { subjectId: '7', type: 'abertura', count: 3 },
      { subjectId: '7', type: 'download', count: 1 },
      { subjectId: '7', type: 'compartilhar_whatsapp', count: 2 },
      { subjectId: '8', type: 'compartilhar_link', count: 4 },
      // Unknown event type and non-numeric subject (card model ids arrive with
      // subjectType 'card', never through the piece mapper).
      { subjectId: '7', type: 'card_download', count: 9 },
      { subjectId: 'time-de-voce', type: 'download', count: 9 },
      { subjectId: '0', type: 'download', count: 9 },
    ])

    expect(byPieceId.get(7)).toEqual({ opens: 3, downloads: 1, whatsapp: 2, link: 0 })
    expect(byPieceId.get(8)).toEqual({ opens: 0, downloads: 0, whatsapp: 0, link: 4 })
    expect(byPieceId.size).toBe(2)
  })

  it('normalizes hostile counts to non-negative integers', () => {
    const byPieceId = contentPieceCirculationFromRows([
      { subjectId: '7', type: 'download', count: Number.NaN },
      { subjectId: '7', type: 'abertura', count: 2.7 },
      { subjectId: '8', type: 'download', count: -4 },
    ])

    expect(byPieceId.get(7)).toEqual({ opens: 2, downloads: 0, whatsapp: 0, link: 0 })
    expect(byPieceId.get(8)).toEqual({ opens: 0, downloads: 0, whatsapp: 0, link: 0 })
  })
})

describe('resolveContentPieceCirculation', () => {
  it('a failed read is unavailable, whatever the counts and publication say', () => {
    expect(
      resolveContentPieceCirculation({
        counts: counts({ opens: 5 }),
        hasBeenPublished: true,
        unavailable: true,
      }),
    ).toEqual({ state: 'unavailable' })
  })

  it('real counters win over everything — an unpublished piece keeps its history', () => {
    expect(
      resolveContentPieceCirculation({
        counts: counts({ downloads: 1 }),
        hasBeenPublished: true,
        unavailable: false,
      }),
    ).toEqual({ state: 'data', counts: counts({ downloads: 1 }) })
  })

  it('a published piece with no events shows zeros; a never published one does not', () => {
    expect(resolveContentPieceCirculation({ hasBeenPublished: true, unavailable: false })).toEqual({
      state: 'data',
      counts: EMPTY_CONTENT_PIECE_CIRCULATION,
    })
    expect(resolveContentPieceCirculation({ hasBeenPublished: false, unavailable: false })).toEqual(
      { state: 'neverPublished' },
    )
  })

  it('flags the historical counters of an unpublished piece only', () => {
    const withHistory = { state: 'data', counts: counts({ opens: 2 }) } as const
    const zeros = { state: 'data', counts: EMPTY_CONTENT_PIECE_CIRCULATION } as const

    expect(showsContentPieceCirculationHistory(withHistory, false)).toBe(true)
    expect(showsContentPieceCirculationHistory(withHistory, true)).toBe(false)
    expect(showsContentPieceCirculationHistory(zeros, false)).toBe(false)
    expect(showsContentPieceCirculationHistory({ state: 'neverPublished' }, false)).toBe(false)
    expect(showsContentPieceCirculationHistory({ state: 'unavailable' }, false)).toBe(false)
  })

  it('knows an all-zero piece from a piece with any signal', () => {
    expect(isContentPieceCirculationEmpty(EMPTY_CONTENT_PIECE_CIRCULATION)).toBe(true)
    expect(isContentPieceCirculationEmpty(counts({ link: 1 }))).toBe(false)
  })
})
