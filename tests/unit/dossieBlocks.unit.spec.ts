import { describe, expect, it } from 'vitest'

import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import {
  dossierChecklistForEra,
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'

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
      item('era_c_defesas', {
        position: 'Ensino superior',
        answer: 'Defende a implantação de campus da UFBA na região',
        details: 'INC 1497/2023 · Câmara dos Deputados',
      }),
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
      report.eras.every((era) => (era?.numbers.length ?? 0) + (era?.actions.length ?? 0) > 0),
    ).toBe(true)
  })

  it('turns official emenda execution into phase-labelled rows (empenho ≠ pagamento)', () => {
    const eraC = build().eras.find((era) => era?.id === 'C')
    expect(eraC?.numbers).toContainEqual(
      expect.objectContaining({ object: 'Saúde', phase: 'empenhado', sphere: 'municipio' }),
    )
  })

  it('surfaces the IBGE baseline as municipal context, not as an era number', () => {
    const report = build()
    expect(report.region.context).toContainEqual(
      expect.objectContaining({ topic: 'População residente (Censo 2022)' }),
    )
    const eraB = report.eras.find((era) => era?.id === 'B')
    expect(eraB?.numbers.some((row: { object: string }) => row.object.includes('População'))).toBe(
      false,
    )
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

  it('marks the defense items on the bulletin ledger', () => {
    const report = build()
    const defense = report.bulletinFacts.find((fact) => fact.id === 'era_c_defesas')
    expect(defense).toMatchObject({ defense: true })
    expect(report.bulletinFacts.find((fact) => fact.id === 'era_c_emendas')?.defense).toBe(false)
  })

  it('keeps an era without evidence in the report, omitted as a section (C209)', () => {
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
    expect(report.eras).toHaveLength(3)
    expect(report.eras.every((era) => era.omitted)).toBe(true)
  })

  it('keeps the trajectory and the defeso limits', () => {
    const report = build()
    expect(report.trajectory.length).toBeGreaterThan(6)
    expect(report.limits.editorial).toContain('Sem fonte, não publica.')
    expect(report.limits.coverage.join(' ')).toContain('2011')
  })

  it('reads the sourced set into O essencial facts (never a new fact)', () => {
    const report = build()
    expect(report.essentials.facts.length).toBeGreaterThanOrEqual(3)
    const labels = report.essentials.facts.map((fact: { label: string }) => fact.label).join(' ')
    expect(labels).toContain('pontos com fonte')
    expect(labels).toContain('Abrangência sem soma')
    expect(labels).toContain('lacunas declaradas')
    expect(report.essentials.facts.map((fact: { text: string }) => fact.text).join(' ')).toContain(
      'Empenho não é pagamento.',
    )
  })

  it('derives the between-eras reading from the ledger', () => {
    const report = build()
    expect(
      report.betweenEras.bullets.map((bullet: { label: string | null }) => bullet.label),
    ).toContain('Concentração.')
    expect(report.betweenEras.table).toHaveLength(3)
    expect(report.betweenEras.table[0]).toMatchObject({
      where: expect.any(String),
      howToCite: expect.any(String),
      limit: expect.any(String),
    })
  })

  it('prefers the narrative betweenEras bullets when the writer provides them', () => {
    const report = build({
      narrative: { betweenEras: ['Leitura autoral do conjunto.', 'Segunda linha.'] },
    })
    expect(report.betweenEras.bullets).toEqual([
      { label: null, text: 'Leitura autoral do conjunto.' },
      { label: null, text: 'Segunda linha.' },
    ])
  })

  it('separates the positions with lastro from the defense gaps (fail-closed)', () => {
    const report = build()
    expect(report.defends.positions).toContainEqual(
      expect.objectContaining({
        id: 'era_c_defesas',
        label: 'Ensino superior',
        reading: 'Defende a implantação de campus da UFBA na região',
        sourceUrl: 'https://exemplo.test/era_c_defesas',
      }),
    )
    // Era A/B defenses were not researched: explicit gaps, never an inference.
    expect(report.defends.gaps.map((gap: { id: string }) => gap.id)).toEqual([
      'era_a_defesas',
      'era_b_defesas',
    ])
  })

  it('degrades a defense without a source to an explicit gap', () => {
    const unsourced = mergeDossierResearch([
      normalizeDossierResearchInput(eraFile('A', [item('era_a_conquista')])),
      normalizeDossierResearchInput(eraFile('B', [item('era_b_sesab')])),
      normalizeDossierResearchInput(
        eraFile('C', [
          item('era_c_defesas', {
            position: 'Saúde regional',
            answer: 'Defende o SAMU regional',
            sourceUrl: null,
          }),
        ]),
      ),
    ])
    const report = build({ research: unsourced })
    expect(report.defends.positions).toHaveLength(0)
    expect(report.defends.gaps).toContainEqual(
      expect.objectContaining({ id: 'era_c_defesas', reason: expect.stringMatching(/Sem fonte/) }),
    )
  })

  it('keeps the news summary and the era for the sources table', () => {
    const withNews = mergeDossierResearch([
      normalizeDossierResearchInput(eraFile('A', [item('era_a_conquista')])),
      normalizeDossierResearchInput(eraFile('B', [item('era_b_sesab')])),
      normalizeDossierResearchInput({
        ...eraFile('C', [item('era_c_emendas')]),
        news: [
          {
            title: 'Matéria local',
            url: 'https://jornal.test/materia',
            publishedAt: '2024-06-01',
            outlet: 'Jornal Local',
            summary: 'Resumo datado da matéria.',
          },
        ],
      }),
    ])
    const report = build({ research: withNews })
    expect(report.news[0]).toMatchObject({
      era: 'C',
      summary: 'Resumo datado da matéria.',
      outlet: 'Jornal Local',
    })
  })
})

describe('dossier checklist coverage', () => {
  it('every checklist item is bound to an era', () => {
    for (const era of ['A', 'B', 'C'] as const) {
      expect(dossierChecklistForEra(era).every((row) => row.era === era)).toBe(true)
    }
  })

  it('carries one defense item per era (kind: defense)', () => {
    for (const era of ['A', 'B', 'C'] as const) {
      const defenses = dossierChecklistForEra(era).filter((row) => row.kind === 'defense')
      expect(defenses).toHaveLength(1)
      expect(defenses[0].id).toBe(`era_${era.toLowerCase()}_defesas`)
    }
  })
})
