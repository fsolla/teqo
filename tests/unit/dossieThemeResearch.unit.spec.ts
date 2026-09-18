import { describe, expect, it } from 'vitest'

import {
  DOSSIER_RESEARCH_CHECKLIST_IDS,
  dossierChecklistForEra,
  dossierResearchReceipt,
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { THEME_UNIT } from '../../scripts/lib/dossieUnit.mjs'

// C190: the theme/area branch of the shared research contract. Same eras,
// `themeSlug` and `area|segmento|rede` spheres; the C186 municipality and C187
// institution behaviours are untouched.

const validItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: 'Entrega documentada.',
  sphere: 'area',
  sourceUrl: 'https://educacao.test/ato',
  sourceDate: '2024-02-01',
  ...overrides,
})

const eraResearch = (era: 'A' | 'B' | 'C', overrides: Record<string, unknown> = {}) => ({
  themeSlug: 'educacao',
  era,
  researchedAt: '2026-09-18T10:00:00.000Z',
  items: dossierChecklistForEra(era, THEME_UNIT).map((item) => validItem(item.id)),
  ...overrides,
})

describe('theme checklist', () => {
  it('exposes a theme checklist id per era (distinct ids)', () => {
    const ids = [
      ...dossierChecklistForEra('A', THEME_UNIT),
      ...dossierChecklistForEra('B', THEME_UNIT),
      ...dossierChecklistForEra('C', THEME_UNIT),
    ].map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('era_b_politicas')
    expect(ids).toContain('era_c_relatorias')
    expect(ids).toContain('era_c_audiencias')
    // Municipality ids remain the C186 public surface.
    expect(DOSSIER_RESEARCH_CHECKLIST_IDS).toContain('era_a_formacao')
  })
})

describe('normalizeDossierResearchInput (theme unit)', () => {
  it('requires themeSlug and keeps theme items', () => {
    const research = normalizeDossierResearchInput(eraResearch('C'), { unit: THEME_UNIT })
    expect(research.themeSlug).toBe('educacao')
    expect(research.items.length).toBe(dossierChecklistForEra('C', THEME_UNIT).length)
    expect(research.items.every((item) => item.sphere === 'area')).toBe(true)
  })

  it('rejects the municipality slug field', () => {
    expect(() =>
      normalizeDossierResearchInput(
        { municipalitySlug: 'ilheus', era: 'C', researchedAt: '2026-09-18T10:00:00.000Z' },
        { unit: THEME_UNIT },
      ),
    ).toThrow(/themeSlug/)
  })

  it('turns an invalid sphere into a gap with the theme vocabulary', () => {
    const items = dossierChecklistForEra('A', THEME_UNIT).map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, { sphere: 'instituicao' })
    const research = normalizeDossierResearchInput(eraResearch('A', { items }), {
      unit: THEME_UNIT,
    })
    expect(research.gaps).toContainEqual(
      expect.objectContaining({
        id: items[0].id,
        reason: expect.stringMatching(/area\/segmento\/rede/),
      }),
    )
  })

  it('defaults the sphere to area and keeps segmento/rede', () => {
    const research = normalizeDossierResearchInput(
      eraResearch('B', {
        items: [
          validItem('era_b_sesab', { sphere: undefined }),
          validItem('era_b_politicas', { sphere: 'segmento' }),
          validItem('era_b_investimentos', { sphere: 'rede' }),
        ],
      }),
      { unit: THEME_UNIT },
    )
    const byId = Object.fromEntries(research.items.map((item) => [item.id, item.sphere]))
    expect(byId.era_b_sesab).toBe('area')
    expect(byId.era_b_politicas).toBe('segmento')
    expect(byId.era_b_investimentos).toBe('rede')
  })

  it('builds a theme receipt with the theme research path', () => {
    const receipt = dossierResearchReceipt(
      normalizeDossierResearchInput(eraResearch('A'), { unit: THEME_UNIT }),
      { unit: THEME_UNIT },
    )
    expect(receipt.slug).toBe('educacao')
    expect(receipt.researchPath).toBe('data/dossie-solla-tema/educacao.a.research.json')
    expect(receipt.itemCount).toBeGreaterThan(0)
  })
})

describe('mergeDossierResearch (theme unit)', () => {
  it('merges the theme eras', () => {
    const merged = mergeDossierResearch(
      (['A', 'B', 'C'] as const).map((era) =>
        normalizeDossierResearchInput(eraResearch(era), { unit: THEME_UNIT }),
      ),
      { unit: THEME_UNIT },
    )
    expect(merged.themeSlug).toBe('educacao')
    expect(merged.eras).toEqual(['A', 'B', 'C'])
  })

  it('fails closed when theme slugs disagree', () => {
    const a = normalizeDossierResearchInput(eraResearch('A'), { unit: THEME_UNIT })
    const b = normalizeDossierResearchInput(eraResearch('B', { themeSlug: 'saude' }), {
      unit: THEME_UNIT,
    })
    expect(() => mergeDossierResearch([a, b], { unit: THEME_UNIT })).toThrow(/temas diferentes/)
  })
})
