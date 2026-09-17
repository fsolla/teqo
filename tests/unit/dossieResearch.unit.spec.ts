import { describe, expect, it, vi } from 'vitest'

import {
  DOSSIER_BRIEF_NOTE_MAX,
  DOSSIER_BRIEF_TITLE_MAX,
  DOSSIER_RESEARCH_CHECKLIST_IDS,
  dossierChecklistForEra,
  dossierResearchReceipt,
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'

const validItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Resposta de ${id}`,
  sourceUrl: `https://exemplo.test/${id}`,
  sourceDate: '2026-09-10',
  ...overrides,
})

const eraResearch = (era: 'A' | 'B' | 'C', overrides: Record<string, unknown> = {}) => ({
  municipalitySlug: 'ilheus',
  era,
  researchedAt: '2026-09-16T10:00:00.000Z',
  items: dossierChecklistForEra(era).map((item) => validItem(item.id)),
  news: [],
  gaps: [],
  ...overrides,
})

describe('normalizeDossierResearchInput', () => {
  it('exposes a per-era checklist covering three eras', () => {
    expect(dossierChecklistForEra('A').length).toBeGreaterThan(0)
    expect(dossierChecklistForEra('B').length).toBeGreaterThan(0)
    expect(dossierChecklistForEra('C').length).toBeGreaterThan(0)
    expect(new Set(DOSSIER_RESEARCH_CHECKLIST_IDS).size).toBe(DOSSIER_RESEARCH_CHECKLIST_IDS.length)
  })

  it('keeps fully sourced items and defaults the sphere to município', () => {
    const research = normalizeDossierResearchInput(eraResearch('C'))
    expect(research.items).toHaveLength(dossierChecklistForEra('C').length)
    expect(research.gaps).toEqual([])
    expect(research.items.every((item) => item.sphere === 'municipio')).toBe(true)
  })

  it('normalizes the optional per-item summary without changing the source contract (C188)', () => {
    const items = dossierChecklistForEra('C').map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, { summary: '  Recurso de R$ 1 mi empenhado em 2024.  ' })
    items[1] = validItem(items[1].id, { summary: '   ' })
    const research = normalizeDossierResearchInput(eraResearch('C', { items }))
    expect(research.items[0].summary).toBe('Recurso de R$ 1 mi empenhado em 2024.')
    expect(research.items[0].answer).toBe(`Resposta de ${items[0].id}`)
    expect(research.items[1].summary).toBeNull()
    expect(research.gaps).toEqual([])
  })

  it('normalizes the reformulated brief and drops it when it has no title', () => {
    const research = normalizeDossierResearchInput(
      eraResearch('C', {
        items: [
          validItem('era_c_emendas', { brief: { title: 'Manchete curta', note: 'Nota curta' } }),
          validItem('era_c_discursos', { brief: { note: 'sem título' } }),
        ],
      }),
    )
    const emendas = research.items.find((item) => item.id === 'era_c_emendas')
    const discursos = research.items.find((item) => item.id === 'era_c_discursos')
    expect(emendas?.brief).toEqual({ title: 'Manchete curta', note: 'Nota curta' })
    expect(discursos?.brief).toBeNull()
  })

  it('warns when a brief exceeds the print budget (kept, so the A4 guard catches it)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const research = normalizeDossierResearchInput(
        eraResearch('C', {
          items: [
            validItem('era_c_emendas', {
              brief: { title: 'x'.repeat(DOSSIER_BRIEF_TITLE_MAX + 1) },
            }),
          ],
        }),
      )
      expect(warn).toHaveBeenCalled()
      expect(research.items[0].brief?.title.length).toBe(DOSSIER_BRIEF_TITLE_MAX + 1)
      expect(DOSSIER_BRIEF_NOTE_MAX).toBeGreaterThan(0)
    } finally {
      warn.mockRestore()
    }
  })

  it('throws when the slug, the date or the era is missing', () => {
    expect(() => normalizeDossierResearchInput(eraResearch('A', { municipalitySlug: '' }))).toThrow(
      /municipalitySlug/,
    )
    expect(() => normalizeDossierResearchInput(eraResearch('A', { researchedAt: null }))).toThrow(
      /researchedAt/,
    )
    expect(() => normalizeDossierResearchInput(eraResearch('A', { era: 'Z' }))).toThrow(/era/)
  })

  it('degrades an unsourced item to an explicit gap', () => {
    const items = dossierChecklistForEra('A').map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, { sourceUrl: null })
    const research = normalizeDossierResearchInput(eraResearch('A', { items }))
    expect(research.gaps).toContainEqual(
      expect.objectContaining({ id: items[0].id, reason: expect.stringMatching(/Sem fonte/) }),
    )
    expect(research.items).toHaveLength(dossierChecklistForEra('A').length - 1)
  })

  it('rejects an item that belongs to another era', () => {
    const research = normalizeDossierResearchInput(
      eraResearch('A', { items: [...eraResearch('A').items, validItem('era_c_emendas')] }),
    )
    expect(research.gaps).toContainEqual(
      expect.objectContaining({ id: 'era_c_emendas', reason: expect.stringMatching(/Era C/) }),
    )
  })

  it('marks unreached checklist items as gaps', () => {
    const research = normalizeDossierResearchInput(eraResearch('B', { items: [] }))
    expect(research.gaps.filter((gap) => gap.reason === 'Não pesquisado.')).toHaveLength(
      dossierChecklistForEra('B').length,
    )
  })

  it('preserves numbers, defaulting an unknown phase to não informada', () => {
    const items = dossierChecklistForEra('C').map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, {
      numbers: [
        { label: 'Recurso', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' },
        { label: 'Sem fase', value: 'R$ 10 mil' },
      ],
    })
    const research = normalizeDossierResearchInput(eraResearch('C', { items }))
    const item = research.items.find((row) => row.id === items[0].id)
    expect(item?.numbers).toHaveLength(2)
    expect(item?.numbers[0]).toMatchObject({ label: 'Recurso', phase: 'empenhado' })
    expect(item?.numbers[1].phase).toBe('nao_informado')
  })

  it('flags an invalid sphere as a gap instead of silently summing it', () => {
    const items = dossierChecklistForEra('A').map((item) => validItem(item.id))
    items[0] = validItem(items[0].id, { sphere: 'estado' })
    const research = normalizeDossierResearchInput(eraResearch('A', { items }))
    expect(research.gaps).toContainEqual(
      expect.objectContaining({
        id: items[0].id,
        reason: expect.stringMatching(/Esfera inválida/),
      }),
    )
  })

  it('emits the short receipt with the era file path', () => {
    const receipt = dossierResearchReceipt(normalizeDossierResearchInput(eraResearch('B')))
    expect(receipt).toMatchObject({ slug: 'ilheus', era: 'B', status: 'ok' })
    expect(receipt.researchPath).toContain('ilheus.b.research.json')
  })
})

describe('mergeDossierResearch', () => {
  it('merges the three eras ordered A→B→C', () => {
    const merged = mergeDossierResearch(
      ['A', 'B', 'C'].map((era) =>
        normalizeDossierResearchInput(eraResearch(era as 'A' | 'B' | 'C')),
      ),
    )
    expect(merged.eras).toEqual(['A', 'B', 'C'])
    expect(merged.items[0].era).toBe('A')
    expect(merged.items.at(-1).era).toBe('C')
  })

  it('fails closed when the slugs disagree', () => {
    const a = normalizeDossierResearchInput(eraResearch('A'))
    const b = normalizeDossierResearchInput(eraResearch('B', { municipalitySlug: 'una' }))
    expect(() => mergeDossierResearch([a, b])).toThrow(/municípios diferentes/)
  })

  it('rejects an empty bundle', () => {
    expect(() => mergeDossierResearch([])).toThrow(/sem pesquisa/)
  })
})
