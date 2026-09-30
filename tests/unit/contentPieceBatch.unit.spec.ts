import { describe, expect, it } from 'vitest'

import {
  contentPieceBatchDeleteTitle,
  contentPieceBatchReceiptMessage,
  contentPieceSelectionLabel,
  type ContentPieceBatchOutcome,
} from '@/lib/contentPieceBatch'

const outcome = (
  action: ContentPieceBatchOutcome['action'],
  affected: number,
  failed = 0,
): ContentPieceBatchOutcome => ({
  action,
  affected,
  failures: Array.from({ length: failed }, (_, index) => ({
    contentPieceId: index + 1,
    message: 'Peça não encontrada.',
  })),
})

describe('contentPieceBatch (C236)', () => {
  it('writes the all-success receipt in the plan literals, singular included', () => {
    expect(contentPieceBatchReceiptMessage(outcome('publicar', 3))).toBe('3 peças publicadas')
    expect(contentPieceBatchReceiptMessage(outcome('despublicar', 1))).toBe('1 peça despublicada')
    expect(contentPieceBatchReceiptMessage(outcome('apagar', 3))).toBe('3 peças apagadas')
    expect(contentPieceBatchReceiptMessage(outcome('apagar', 1))).toBe('1 peça apagada')
  })

  it('never calls a partial outcome a success: it separates affected from failures', () => {
    expect(contentPieceBatchReceiptMessage(outcome('apagar', 2, 1))).toBe(
      '2 de 3 peças apagadas. 1 falhou.',
    )
    expect(contentPieceBatchReceiptMessage(outcome('publicar', 1, 2))).toBe(
      '1 de 3 peças publicadas. 2 falharam.',
    )
    expect(contentPieceBatchReceiptMessage(outcome('despublicar', 0, 1))).toBe(
      '0 de 1 peça despublicada. 1 falhou.',
    )
  })

  it('counts the selection with the TourComposerForm singular', () => {
    expect(contentPieceSelectionLabel(1)).toBe('1 selecionada')
    expect(contentPieceSelectionLabel(3)).toBe('3 selecionadas')
  })

  it('titles the mass delete and reuses the C222 singular', () => {
    expect(contentPieceBatchDeleteTitle(1)).toBe('Apagar esta peça?')
    expect(contentPieceBatchDeleteTitle(3)).toBe('Apagar 3 peças selecionadas?')
  })
})
