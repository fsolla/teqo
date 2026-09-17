import { describe, expect, it } from 'vitest'

import {
  BULLETIN_HIGHLIGHT_LIMIT,
  BULLETIN_MORE_LIMIT,
  buildBulletin,
} from '../../scripts/lib/dossieBulletin.mjs'

const fact = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `fato-${index}`,
  era: 'C',
  sphere: 'municipio',
  area: 'Saúde',
  headline: `Entrega ${index}`,
  detail: `Detalhe ${index}`,
  value: `R$ ${index} mil`,
  year: '2024',
  phase: 'empenhado',
  sourceUrl: `https://exemplo.test/${index}`,
  sourceDate: '2026-09-10',
  ...overrides,
})

const generatedAt = new Date('2026-09-17T12:00:00.000Z')

describe('buildBulletin', () => {
  it('caps highlights and "e mais" items', () => {
    const facts = Array.from({ length: 30 }, (_value, index) => fact(index))
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    expect(bulletin.highlights).toHaveLength(BULLETIN_HIGHLIGHT_LIMIT)
    expect(bulletin.moreItems).toHaveLength(BULLETIN_MORE_LIMIT)
  })

  it('orders município before região and a sourced number before none', () => {
    const facts = [
      fact(1, { sphere: 'regiao' }),
      fact(2, { value: null }),
      fact(3, { sphere: 'municipio', value: '10 UPAs' }),
    ]
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    expect(bulletin.highlights[0].title).toBe('Entrega 3')
  })

  it('composes the card eyebrow with area and sphere', () => {
    const bulletin = buildBulletin({
      facts: [fact(1, { sphere: 'regiao' })],
      municipality: 'Ilhéus',
      generatedAt,
    })
    expect(bulletin.highlights[0].eyebrow).toBe('Saúde · região')
  })

  it('renders an empty state without inventing facts', () => {
    const bulletin = buildBulletin({ facts: [], municipality: 'Ilhéus', generatedAt })
    expect(bulletin.highlights).toEqual([])
    expect(bulletin.moreItems).toEqual([])
    expect(bulletin.timeline.length).toBe(4)
  })

  it('never drops the fact source from the ledger (boletim can only inherit sourced facts)', () => {
    const facts = Array.from({ length: 25 }, (_value, index) => fact(index))
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    const chosen = bulletin.highlights.length + bulletin.moreItems.length
    expect(chosen).toBe(BULLETIN_HIGHLIGHT_LIMIT + BULLETIN_MORE_LIMIT)
    expect(facts.every((row) => Boolean(row.sourceUrl))).toBe(true)
  })
})
