import { describe, expect, it } from 'vitest'

import {
  BULLETIN_DEFENSE_LIMIT,
  BULLETIN_HIGHLIGHT_LIMIT,
  buildBulletin,
  nextBulletinFit,
} from '../../scripts/lib/dossieBulletin.mjs'
import { MUNICIPALITY_UNIT } from '../../scripts/lib/dossieUnit.mjs'

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

const defense = (index: number, overrides: Record<string, unknown> = {}) =>
  fact(index, { defense: true, headline: `Defesa ${index}`, ...overrides })

const generatedAt = new Date('2026-09-17T12:00:00.000Z')

describe('buildBulletin', () => {
  it('caps highlights and "e mais" items', () => {
    const facts = Array.from({ length: 30 }, (_value, index) => fact(index))
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    expect(bulletin.highlights).toHaveLength(BULLETIN_HIGHLIGHT_LIMIT)
    // The unit descriptor owns the "E mais" budget (long labels wrap).
    expect(bulletin.moreItems).toHaveLength(MUNICIPALITY_UNIT.bulletinMoreLimit)
  })

  it('counts the facts left out of the one-page boletim (never a silent drop, C188)', () => {
    const facts = Array.from({ length: 25 }, (_value, index) => fact(index))
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    expect(bulletin.factsTotal).toBe(25)
    expect(
      bulletin.highlights.length +
        bulletin.moreItems.length +
        bulletin.defenses.length +
        bulletin.factsRemaining,
    ).toBe(bulletin.factsTotal)
  })

  it('has no remainder when everything fits', () => {
    const bulletin = buildBulletin({ facts: [fact(1)], municipality: 'Ilhéus', generatedAt })
    expect(bulletin.factsRemaining).toBe(0)
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

  it('renders an empty state without inventing facts', () => {
    const bulletin = buildBulletin({ facts: [], municipality: 'Ilhéus', generatedAt })
    expect(bulletin.highlights).toEqual([])
    expect(bulletin.moreItems).toEqual([])
    expect(bulletin.defenses).toEqual([])
    expect(bulletin.timeline.length).toBe(4)
  })

  it('prints the defenses outside the highlight ranking and counts them', () => {
    const facts = [
      defense(1, { headline: 'Defende o SAMU regional' }),
      defense(2, { headline: 'Defende campus da UFBA' }),
      defense(3, { headline: 'Defende a Policlínica' }),
      ...Array.from({ length: 25 }, (_value, index) => fact(index)),
    ]
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    expect(bulletin.defenses).toHaveLength(BULLETIN_DEFENSE_LIMIT)
    expect(bulletin.defenses[0]).toMatchObject({
      label: 'Defende o SAMU regional',
      text: 'Detalhe 1',
    })
    // The defenses never displace a sourced finding from the printed slots.
    expect(bulletin.highlights[0].title).toBe('Entrega 0')
    expect(
      bulletin.highlights.length +
        bulletin.moreItems.length +
        bulletin.defenses.length +
        bulletin.factsRemaining,
    ).toBe(bulletin.factsTotal)
  })

  it('maps every highlight, "e mais" item and defense to a ledger fact (never invents)', () => {
    const facts = [defense(99), ...Array.from({ length: 25 }, (_value, index) => fact(index))]
    const bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    const headlines = new Set(facts.map((row) => row.headline))
    expect(bulletin.highlights.every((row) => headlines.has(row.title))).toBe(true)
    expect(bulletin.moreItems.every((row) => headlines.has(row.label))).toBe(true)
    expect(bulletin.defenses.every((row) => headlines.has(row.label))).toBe(true)
  })
})

describe('nextBulletinFit', () => {
  it('reduces the printed facts first and then the defenses', () => {
    const facts = [
      defense(1),
      defense(2),
      ...Array.from({ length: 10 }, (_value, index) => fact(index)),
    ]
    let bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt })
    let next = nextBulletinFit(bulletin)
    expect(next).toEqual({ printLimit: 8 })
    bulletin = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt, ...next })
    next = nextBulletinFit(bulletin)
    expect(next).toEqual({ printLimit: 6 })
    // Down to zero printed facts, the defenses are the next budget.
    const zeroed = buildBulletin({ facts, municipality: 'Ilhéus', generatedAt, printLimit: 0 })
    expect(nextBulletinFit(zeroed)).toEqual({ printLimit: 0, defenseLimit: 1 })
    const oneDefense = buildBulletin({
      facts,
      municipality: 'Ilhéus',
      generatedAt,
      printLimit: 0,
      defenseLimit: 1,
    })
    expect(nextBulletinFit(oneDefense)).toEqual({ printLimit: 0, defenseLimit: 0 })
  })

  it('returns null when there is nothing left to cut (fail-closed)', () => {
    const bulletin = buildBulletin({
      facts: [fact(1)],
      municipality: 'Ilhéus',
      generatedAt,
      printLimit: 0,
      defenseLimit: 0,
    })
    expect(nextBulletinFit(bulletin)).toBeNull()
  })
})
