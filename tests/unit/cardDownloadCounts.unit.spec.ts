// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CARD_DOWNLOAD_COUNTS_CAPTION,
  CARD_DOWNLOAD_COUNTS_EMPTY_BODY,
  CARD_DOWNLOAD_COUNTS_EMPTY_CAPTION,
  CARD_DOWNLOAD_COUNTS_EMPTY_TITLE,
  CARD_DOWNLOAD_COUNTS_SUBTITLE,
  CARD_DOWNLOAD_COUNTS_TITLE,
  cardDownloadCountsFromRows,
  resolveCardDownloadCounts,
} from '@/lib/cardDownloadCounts'
import { CARD_MODELS } from '@/lib/cardModels'

describe('card download counts vocabulary', () => {
  it('pins the honest literals of the design', () => {
    expect(CARD_DOWNLOAD_COUNTS_TITLE).toBe('Cards')
    expect(CARD_DOWNLOAD_COUNTS_SUBTITLE).toBe('Downloads anônimos acumulados desde o lançamento.')
    expect(CARD_DOWNLOAD_COUNTS_CAPTION).toBe(
      'Os números contam downloads, não pessoas ou visitantes únicos.',
    )
    expect(CARD_DOWNLOAD_COUNTS_EMPTY_TITLE).toBe('Nenhum download ainda')
    expect(CARD_DOWNLOAD_COUNTS_EMPTY_BODY).toBe(
      'Os contadores aparecem quando alguém baixar um card.',
    )
    expect(CARD_DOWNLOAD_COUNTS_EMPTY_CAPTION).toBe(
      'A contagem será anônima e mostrará downloads por modelo, nunca pessoas.',
    )
  })
})

describe('cardDownloadCountsFromRows', () => {
  it('keeps the natural catalog order and labels, zero-filling the silent models', () => {
    const counts = cardDownloadCountsFromRows([
      { subjectId: 'minha-colinha', type: 'download', count: 7 },
      { subjectId: 'eu-sou-solla', type: 'download', count: 3 },
    ])

    expect(counts.map((entry) => entry.modelId)).toEqual(CARD_MODELS.map((model) => model.id))
    expect(counts.map((entry) => entry.label)).toEqual(CARD_MODELS.map((model) => model.label))
    expect(counts.map((entry) => entry.count)).toEqual([3, 0, 0, 0, 0, 7])
  })

  it('ignores every other event type, ids outside the catalog and non-positive counts', () => {
    const counts = cardDownloadCountsFromRows([
      { subjectId: 'time-de-voce', type: 'abertura', count: 9 },
      { subjectId: 'time-de-voce', type: 'compartilhar_whatsapp', count: 9 },
      { subjectId: 'peca-123', type: 'download', count: 9 },
      { subjectId: 'time-do-estadual', type: 'download', count: -4 },
      { subjectId: 'time-do-estadual', type: 'download', count: Number.NaN },
    ])

    expect(counts.every((entry) => entry.count === 0)).toBe(true)
  })

  it('sums duplicate rows of the same model instead of losing one', () => {
    const counts = cardDownloadCountsFromRows([
      { subjectId: 'perfil-quadrado', type: 'download', count: 2 },
      { subjectId: 'perfil-quadrado', type: 'download', count: 5 },
    ])

    expect(counts.find((entry) => entry.modelId === 'perfil-quadrado')?.count).toBe(7)
  })
})

describe('resolveCardDownloadCounts', () => {
  it('resolves an unavailable read — never an empty state', () => {
    expect(resolveCardDownloadCounts(null)).toEqual({ state: 'unavailable' })
  })

  it('resolves empty only for real zeros', () => {
    expect(resolveCardDownloadCounts([])).toEqual({ state: 'empty' })
    expect(
      resolveCardDownloadCounts([{ subjectId: 'eu-sou-solla', type: 'download', count: 0 }]),
    ).toEqual({ state: 'empty' })
  })

  it('resolves data as soon as one model has a download', () => {
    const view = resolveCardDownloadCounts([
      { subjectId: 'eu-sou-solla', type: 'download', count: 1 },
    ])

    expect(view.state).toBe('data')
    if (view.state === 'data') {
      expect(view.counts).toHaveLength(CARD_MODELS.length)
      expect(view.counts.find((entry) => entry.modelId === 'eu-sou-solla')?.count).toBe(1)
    }
  })
})
