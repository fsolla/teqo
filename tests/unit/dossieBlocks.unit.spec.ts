import { describe, expect, it } from 'vitest'

import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import {
  dossierChecklistForEra,
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { SUMMARY_POINTER_COPY } from '../../scripts/lib/reportText.mjs'

const generatedAt = new Date('2026-09-17T12:00:00.000Z')

const snapshot = {
  meta: { readAt: '2026-09-16T10:00:00.000Z', codeSha: 'abc1234', database: 'teqo_test' },
  municipality: { slug: 'ilheus', name: 'Ilhéus', region: 'Litoral Sul', ibgeCode: '2913606' },
}

const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Resposta de ${id}`,
  sourceUrl: `https://exemplo.test/${id}`,
  sourceDate: '2026-09-10',
  ...overrides,
})

const eraFile = (era: 'A' | 'B' | 'C', items: unknown[]) => ({
  municipalitySlug: 'ilheus',
  era,
  researchedAt: '2026-09-16T10:00:00.000Z',
  items,
  news: [],
  gaps: [],
})

const research = mergeDossierResearch([
  normalizeDossierResearchInput(eraFile('A', [item('era_a_conquista')])),
  normalizeDossierResearchInput(
    eraFile('B', [
      item('era_b_sesab', {
        numbers: [{ label: 'Recurso estadual', value: 'R$ 2 mi', year: '2012', phase: 'pago' }],
      }),
      item('era_b_obras', { sphere: 'regiao', answer: 'Hospital de referência regional' }),
    ]),
  ),
  normalizeDossierResearchInput(
    eraFile('C', [
      item('era_c_emendas', {
        numbers: [{ label: 'Recurso', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' }],
      }),
      item('era_c_titulos', { answer: 'Cidadão Ilheense' }),
    ]),
  ),
])

const emendas = {
  status: 'ok',
  sourceUrl: 'https://portaldatransparencia.test/emendas',
  consultedAt: '2026-09-17T11:00:00.000Z',
  rows: [
    {
      functionName: 'Saúde',
      year: 2024,
      empenhado: 1_200_000,
      liquidado: 0,
      pago: 0,
      restoPago: 0,
    },
  ],
}

const camara = {
  status: 'ok',
  items: [
    {
      title: 'PL 1/2023',
      detail: 'Ementa de exemplo',
      year: '2023',
      sourceUrl: 'https://camara.test/proposicao/1',
    },
  ],
}

const health = {
  status: 'ok',
  items: [
    {
      topic: 'População residente (Censo 2022)',
      detail: '100.000 habitantes',
      value: 100_000,
      year: '2022',
      sourceUrl: 'https://sidra.test/9514',
      sourceDate: '2026-09-16',
    },
  ],
}

const build = (overrides: Record<string, unknown> = {}) =>
  buildDossierReport({ snapshot, research, emendas, camara, health, generatedAt, ...overrides })

describe('buildDossierReport', () => {
  it('builds one section per era with sourced actions', () => {
    const report = build()
    expect(report.eras.map((era) => era?.id)).toEqual(['A', 'B', 'C'])
    expect(
      report.eras.every((era) => (era?.numbers.items.length ?? 0) + (era?.actions.length ?? 0) > 0),
    ).toBe(true)
  })

  it('turns official emenda execution into phase-labelled rows (empenho ≠ pagamento)', () => {
    const eraC = build().eras.find((era) => era?.id === 'C')
    expect(eraC?.numbers.items).toContainEqual(
      expect.objectContaining({ object: 'Saúde', phase: 'empenhado', sphere: 'municipio' }),
    )
  })

  it('surfaces the IBGE baseline as municipal context, not as an era number', () => {
    const report = build()
    expect(report.region.context).toContainEqual(
      expect.objectContaining({ topic: 'População residente (Censo 2022)' }),
    )
    const eraB = report.eras.find((era) => era?.id === 'B')
    expect(eraB?.numbers.items.some((row) => row.object.includes('População'))).toBe(false)
  })

  it('never sums região/polo into the município list', () => {
    const report = build()
    expect(report.region.municipal.items.every((row) => row.sphere === 'municipio')).toBe(true)
    expect(report.region.regional.items.some((row) => row.sphere === 'regiao')).toBe(true)
    expect(report.region.municipal.items.some((row) => row.id === 'era_b_obras')).toBe(false)
  })

  it('derives bulletinFacts only from sourced items and official rows', () => {
    const report = build()
    expect(report.bulletinFacts.length).toBeGreaterThan(0)
    expect(report.bulletinFacts.every((fact) => Boolean(fact.sourceUrl))).toBe(true)
    expect(report.bulletinFacts.some((fact) => fact.area === 'Emendas')).toBe(true)
  })

  it('omits an era that has no number and no action', () => {
    const empty = mergeDossierResearch([
      normalizeDossierResearchInput(eraFile('A', [])),
      normalizeDossierResearchInput(eraFile('B', [])),
      normalizeDossierResearchInput(eraFile('C', [])),
    ])
    const report = buildDossierReport({
      snapshot,
      research: empty,
      emendas: { status: 'gap', rows: [], reason: 'sem chave' },
      camara: { status: 'gap', items: [] },
      health: { status: 'gap', items: [] },
      generatedAt,
    })
    expect(report.eras).toHaveLength(0)
  })

  it('caps the page-1 deliveries and keeps the full timeline on its own page', () => {
    const report = build()
    expect(report.page1.deliveries.items.length).toBeLessThanOrEqual(3)
    expect(report.page1.deliveries.total).toBeGreaterThanOrEqual(
      report.page1.deliveries.items.length,
    )
    expect(report.page1.timeline.length).toBe(6)
    expect(report.trajectory.length).toBeGreaterThan(report.page1.timeline.length)
  })

  it('prefers the researcher summary on the resumo and keeps the integral in the era (C188)', () => {
    const summarized = mergeDossierResearch([
      normalizeDossierResearchInput(eraFile('A', [item('era_a_conquista')])),
      normalizeDossierResearchInput(eraFile('B', [item('era_b_sesab')])),
      normalizeDossierResearchInput(
        eraFile('C', [
          item('era_c_emendas', {
            summary: 'Emenda de R$ 1,2 mi empenhada em 2024.',
            numbers: [{ label: 'Recurso', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' }],
          }),
        ]),
      ),
    ])
    const report = build({ research: summarized })
    const delivery = report.page1.deliveries.items.find((row: { era: string }) => row.era === 'C')!
    expect(delivery.title).toBe('Emenda de R$ 1,2 mi empenhada em 2024.')
    const eraC = report.eras.find((era) => era?.id === 'C')!
    expect(
      eraC.actions.some(
        (action: { title: string }) => action.title === 'Resposta de era_c_emendas',
      ),
    ).toBe(true)
  })

  it('falls back to a pointer line (never "…") without losing the era integral (C188)', () => {
    const report = build({ textFallback: 'pointer' })
    const delivery = report.page1.deliveries.items[0]
    expect(delivery.title).toBe(SUMMARY_POINTER_COPY)
    expect(delivery.detail).toBeNull()
    expect(delivery.title.includes('…')).toBe(false)
    const eraC = report.eras.find((era) => era?.id === 'C')!
    expect(
      eraC.actions.some(
        (action: { title: string }) => action.title === 'Resposta de era_c_emendas',
      ),
    ).toBe(true)
  })

  it('keeps the researcher summary even on the pointer pass (C188)', () => {
    const summarized = mergeDossierResearch([
      normalizeDossierResearchInput(eraFile('A', [item('era_a_conquista')])),
      normalizeDossierResearchInput(eraFile('B', [item('era_b_sesab')])),
      normalizeDossierResearchInput(
        eraFile('C', [
          item('era_c_emendas', {
            summary: 'Emenda de R$ 1,2 mi empenhada em 2024.',
            numbers: [{ label: 'Recurso', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' }],
          }),
        ]),
      ),
    ])
    const report = build({ research: summarized, textFallback: 'pointer' })
    const summaryDelivery = report.page1.deliveries.items.find(
      (row: { era: string }) => row.era === 'C',
    )!
    expect(summaryDelivery.title).toBe('Emenda de R$ 1,2 mi empenhada em 2024.')
    const hook = report.page1.hooks.items.find(
      (row: { angle: string }) => row.angle === SUMMARY_POINTER_COPY,
    )
    expect(Boolean(hook)).toBe(true)
  })

  it('counts every capped list so nothing disappears in silence (C188)', () => {
    const manyRegional = mergeDossierResearch([
      normalizeDossierResearchInput(
        eraFile(
          'A',
          [
            'era_a_formacao',
            'era_a_sesab',
            'era_a_consultor_ms',
            'era_a_conquista',
            'era_a_sas_ms',
          ].map((id) => item(id, { sphere: 'regiao' })),
        ),
      ),
      normalizeDossierResearchInput(eraFile('B', [])),
      normalizeDossierResearchInput(eraFile('C', [])),
    ])
    const report = build({ research: manyRegional })
    const eraA = report.eras.find((era) => era?.id === 'A')!
    expect(eraA.actions).toHaveLength(5)
    expect(eraA.camaraActionsRemaining).toBe(0)
    expect(report.region.evidence.items).toHaveLength(3)
    expect(report.region.evidence.total).toBe(5)
    expect(report.region.evidence.remaining).toBe(2)
    expect(report.region.regional.total).toBe(5)
    expect(report.region.regional.items.length + report.region.regional.remaining).toBe(5)
  })

  it('carries the defeso limits and the editorial rules', () => {
    const report = build()
    expect(report.limits.editorial).toContain('Sem fonte, não publica.')
    expect(report.limits.coverage.join(' ')).toContain('2011')
  })
})

describe('dossier checklist coverage', () => {
  it('every checklist item is bound to an era', () => {
    for (const era of ['A', 'B', 'C'] as const) {
      expect(dossierChecklistForEra(era).every((row) => row.era === era)).toBe(true)
    }
  })
})
