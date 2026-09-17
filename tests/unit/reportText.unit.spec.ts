import { describe, expect, it } from 'vitest'

import { stripInlineSources } from '../../scripts/lib/reportText.mjs'

describe('stripInlineSources', () => {
  it('drops a trailing token and the stray space before punctuation', () => {
    expect(stripInlineSources('Pagamento pendente de confirmação {{fonte}}.')).toBe(
      'Pagamento pendente de confirmação.',
    )
  })

  it('drops indexed tokens and collapses the leftover spaces', () => {
    expect(stripInlineSources('Fato {{fonte:2}} e outro {{fonte:3}} aqui.')).toBe(
      'Fato e outro aqui.',
    )
  })

  it('leaves text without tokens untouched', () => {
    expect(stripInlineSources('Sem marcador de fonte.')).toBe('Sem marcador de fonte.')
  })
})
