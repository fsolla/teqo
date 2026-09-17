import { describe, expect, it } from 'vitest'

import {
  DOSSIER_RESEARCH_CHECKLIST_IDS,
  dossierChecklistForEra,
  dossierResearchReceipt,
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { INSTITUTION_UNIT } from '../../scripts/lib/dossieUnit.mjs'

// C187: the institution branch of the shared research contract. Same eras,
// institution slug field and `instituicao|setor|rede` spheres; the C186
// municipality behaviour is untouched (see dossieResearch.unit.spec.ts).

const validItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: 'Entrega documentada.',
  sphere: 'instituicao',
  sourceUrl: 'https://ufba.test/ato',
  sourceDate: '2024-02-01',
  ...overrides,
})

const eraResearch = (era: 'A' | 'B' | 'C', overrides: Record<string, unknown> = {}) => ({
  institutionSlug: 'ufba',
  era,
  researchedAt: '2026-09-17T10:00:00.000Z',
  items: dossierChecklistForEra(era, INSTITUTION_UNIT).map((item) => validItem(item.id)),
  ...overrides,
})

describe('institution checklist', () => {
  it('exposes an institution checklist id per era (distinct ids)', () => {
    const ids = [
      ...dossierChecklistForEra('A', INSTITUTION_UNIT),
      ...dossierChecklistForEra('B', INSTITUTION_UNIT),
      ...dossierChecklistForEra('C', INSTITUTION_UNIT),
    ].map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('era_a_vinculo')
    expect(ids).toContain('era_c_parcerias')
    // Municipality ids remain the C186 public surface.
    expect(DOSSIER_RESEARCH_CHECKLIST_IDS).toContain('era_a_formacao')
  })
})

describe('normalizeDossierResearchInput (institution unit)', () => {
  it('requires institutionSlug and keeps institution items', () => {
    const research = normalizeDossierResearchInput(eraResearch('C'), { unit: INSTITUTION_UNIT })
    expect(research.institutionSlug).toBe('ufba')
    expect(research.items.length).toBe(dossierChecklistForEra('C', INSTITUTION_UNIT).length)
    expect(research.items.every((item) => item.sphere === 'instituicao')).toBe(true)
  })

  it('rejects the municipality slug field', () => {
    expect(() =>
      normalizeDossierResearchInput(
        { municipalitySlug: 'ilheus', era: 'C', researchedAt: '2026-09-17T10:00:00.000Z' },
        { unit: INSTITUTION_UNIT },
      ),
    ).toThrow(/institutionSlug/)
  })

  it('turns an invalid sphere into a gap with the institution vocabulary', () => {
    const items = dossierChecklistForEra('A', INSTITUTION_UNIT).map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, { sphere: 'municipio' })
    const research = normalizeDossierResearchInput(eraResearch('A', { items }), {
      unit: INSTITUTION_UNIT,
    })
    expect(research.gaps).toContainEqual(
      expect.objectContaining({
        id: items[0].id,
        reason: expect.stringMatching(/instituicao\/setor\/rede/),
      }),
    )
  })

  it('defaults the sphere to instituicao and keeps setor/rede', () => {
    const research = normalizeDossierResearchInput(
      eraResearch('B', {
        items: [
          validItem('era_b_sesab', { sphere: undefined }),
          validItem('era_b_equipamentos', { sphere: 'setor' }),
          validItem('era_b_programas', { sphere: 'rede' }),
        ],
      }),
      { unit: INSTITUTION_UNIT },
    )
    const byId = Object.fromEntries(research.items.map((item) => [item.id, item.sphere]))
    expect(byId.era_b_sesab).toBe('instituicao')
    expect(byId.era_b_equipamentos).toBe('setor')
    expect(byId.era_b_programas).toBe('rede')
  })

  it('builds an institution receipt with the institution research path', () => {
    const receipt = dossierResearchReceipt(
      normalizeDossierResearchInput(eraResearch('A'), { unit: INSTITUTION_UNIT }),
      { unit: INSTITUTION_UNIT },
    )
    expect(receipt.slug).toBe('ufba')
    expect(receipt.researchPath).toBe('data/dossie-solla-instituicao/ufba.a.research.json')
    expect(receipt.itemCount).toBeGreaterThan(0)
  })
})

describe('mergeDossierResearch (institution unit)', () => {
  it('merges the institution eras', () => {
    const merged = mergeDossierResearch(
      (['A', 'B', 'C'] as const).map((era) =>
        normalizeDossierResearchInput(eraResearch(era), { unit: INSTITUTION_UNIT }),
      ),
      { unit: INSTITUTION_UNIT },
    )
    expect(merged.institutionSlug).toBe('ufba')
    expect(merged.eras).toEqual(['A', 'B', 'C'])
  })

  it('fails closed when institution slugs disagree', () => {
    const a = normalizeDossierResearchInput(eraResearch('A'), { unit: INSTITUTION_UNIT })
    const b = normalizeDossierResearchInput(eraResearch('B', { institutionSlug: 'correios' }), {
      unit: INSTITUTION_UNIT,
    })
    expect(() => mergeDossierResearch([a, b], { unit: INSTITUTION_UNIT })).toThrow(
      /instituições diferentes/,
    )
  })
})
