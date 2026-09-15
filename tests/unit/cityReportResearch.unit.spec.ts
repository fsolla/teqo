import { describe, expect, it } from 'vitest'

import {
  normalizeResearchInput,
  RESEARCH_CHECKLIST_IDS,
} from '../../scripts/lib/cityReportResearch.mjs'

const now = new Date('2026-09-15T12:00:00.000Z')

const validItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Resposta de ${id}`,
  sourceUrl: `https://exemplo.test/${id}`,
  sourceDate: '2026-09-10',
  ...overrides,
})

const baseResearch = (overrides: Record<string, unknown> = {}) => ({
  municipalitySlug: 'teixeira-de-freitas',
  researchedAt: '2026-09-14T10:00:00.000Z',
  items: RESEARCH_CHECKLIST_IDS.map((id) => validItem(id)),
  news: [],
  gaps: [],
  ...overrides,
})

describe('normalizeResearchInput', () => {
  it('keeps fully sourced items', () => {
    const research = normalizeResearchInput(baseResearch(), { now })
    expect(research.items).toHaveLength(RESEARCH_CHECKLIST_IDS.length)
    expect(research.gaps).toEqual([])
  })

  it('throws when the research is not dated', () => {
    expect(() => normalizeResearchInput(baseResearch({ researchedAt: null }), { now })).toThrow(
      /researchedAt/,
    )
  })

  it('throws when the slug is missing', () => {
    expect(() => normalizeResearchInput(baseResearch({ municipalitySlug: '' }), { now })).toThrow(
      /municipalitySlug/,
    )
  })

  it('degrades an item without source to an explicit gap', () => {
    const research = normalizeResearchInput(
      baseResearch({
        items: [
          validItem('prefeito', { sourceUrl: null }),
          ...RESEARCH_CHECKLIST_IDS.slice(1).map((id) => validItem(id)),
        ],
      }),
      { now },
    )
    expect(research.items.find((item) => item.id === 'prefeito')).toBeUndefined()
    expect(research.gaps).toContainEqual(
      expect.objectContaining({ id: 'prefeito', reason: expect.stringMatching(/Sem fonte/) }),
    )
  })

  it('marks checklist items never researched as gaps', () => {
    const research = normalizeResearchInput(baseResearch({ items: [validItem('prefeito')] }), {
      now,
    })
    expect(research.gaps.filter((gap) => gap.reason === 'Não pesquisado.')).toHaveLength(
      RESEARCH_CHECKLIST_IDS.length - 1,
    )
  })

  it('treats an explicit gap as researched, without a duplicate "Não pesquisado"', () => {
    const research = normalizeResearchInput(
      baseResearch({
        items: RESEARCH_CHECKLIST_IDS.filter((id) => id !== 'emendas_web').map((id) =>
          validItem(id),
        ),
        gaps: [{ id: 'emendas_web', label: 'Emendas na web', reason: 'Fonte oficial respondeu.' }],
      }),
      { now },
    )
    const emendasGaps = research.gaps.filter((gap) => gap.id === 'emendas_web')
    expect(emendasGaps).toHaveLength(1)
    expect(emendasGaps[0].reason).toBe('Fonte oficial respondeu.')
    expect(research.gaps.filter((gap) => gap.reason === 'Não pesquisado.')).toHaveLength(0)
  })

  it('drops news outside the 90-day window and without source', () => {
    const research = normalizeResearchInput(
      baseResearch({
        news: [
          {
            title: 'Matéria válida',
            url: 'https://jornal.test/materia',
            publishedAt: '2026-09-01T00:00:00.000Z',
            outlet: 'Jornal Local',
          },
          {
            title: 'Velha',
            url: 'https://jornal.test/velha',
            publishedAt: '2026-01-01T00:00:00.000Z',
          },
          { title: 'Sem URL', publishedAt: '2026-09-01T00:00:00.000Z' },
        ],
      }),
      { now },
    )
    expect(research.news).toHaveLength(1)
    expect(research.news[0].title).toBe('Matéria válida')
    expect(research.gaps).toContainEqual(expect.objectContaining({ id: 'noticia_fora_da_janela' }))
    expect(research.gaps).toContainEqual(expect.objectContaining({ id: 'noticia_sem_fonte' }))
  })

  it('rejects unknown checklist ids', () => {
    const research = normalizeResearchInput(
      baseResearch({
        items: [...RESEARCH_CHECKLIST_IDS.map((id) => validItem(id)), validItem('inventado')],
      }),
      { now },
    )
    expect(research.items.find((item) => item.id === 'inventado')).toBeUndefined()
    expect(research.gaps).toContainEqual(
      expect.objectContaining({ id: 'inventado', reason: expect.stringMatching(/checklist/) }),
    )
  })
})
