import { describe, expect, it } from 'vitest'

import { buildCityReport } from '../../scripts/lib/cityReportBlocks.mjs'
import {
  normalizeResearchInput,
  RESEARCH_CHECKLIST_IDS,
} from '../../scripts/lib/cityReportResearch.mjs'
import { SUMMARY_POINTER_COPY } from '../../scripts/lib/reportText.mjs'

const generatedAt = new Date('2026-09-15T12:00:00.000Z')

const validItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Resposta de ${id}`,
  sourceUrl: `https://exemplo.test/${id}`,
  sourceDate: '2026-09-10',
  ...overrides,
})

const research = normalizeResearchInput(
  {
    municipalitySlug: 'feira-de-santana',
    researchedAt: '2026-09-14T10:00:00.000Z',
    items: RESEARCH_CHECKLIST_IDS.map((id) =>
      id === 'prefeito'
        ? validItem(id, {
            extraSources: [
              {
                label: 'Polo regional — Teixeira de Freitas',
                url: 'https://exemplo.test/polo',
                date: '2026-09-01',
              },
            ],
          })
        : validItem(id),
    ),
    news: [
      {
        title: 'Matéria local',
        url: 'https://jornal.test/materia',
        publishedAt: '2026-09-01T00:00:00.000Z',
        outlet: 'Jornal Local',
      },
    ],
    approach: [
      {
        persona: 'Ciência política',
        topic: 'Saúde',
        suggestion: 'Ancorar a agenda na defesa do SUS e no SAMU.',
        sourceUrl: 'https://exemplo.test/abordagem',
        sourceDate: '2026-09-10',
      },
    ],
    leaders: [
      {
        name: 'Ex-Prefeito',
        role: 'Prefeito',
        party: 'PSDB',
        period: '2017–2024',
        sourceUrl: 'https://exemplo.test/lideranca',
        sourceDate: '2026-03-05',
      },
    ],
    leaderAgenda: [
      {
        name: 'Ex-Prefeito',
        field: 'Mesmo campo',
        topics: 'Saúde (hospital municipal)',
        sourceUrl: 'https://exemplo.test/pauta',
        sourceDate: '2026-09-01',
      },
    ],
    demography: [
      {
        topic: 'Cor/raça',
        detail: 'Parda 62%, branca 25%.',
        sourceUrl: 'https://exemplo.test/cor-raca',
        sourceDate: '2026-09-10',
      },
    ],
    economy: [
      {
        topic: 'PIB',
        detail: 'Serviços e agropecuária lideram.',
        sourceUrl: 'https://exemplo.test/pib',
        sourceDate: '2026-09-10',
      },
    ],
    transport: [
      {
        topic: 'Rodovias',
        detail: 'BR-101 corta o município; trecho em obra.',
        sourceUrl: 'https://exemplo.test/br101',
        sourceDate: '2026-09-10',
      },
    ],
    opposition: [
      {
        topic: 'Obra parada no campo adversário',
        detail: 'Anúncio sem entrega na região.',
        sourceUrl: 'https://exemplo.test/oposicao',
        sourceDate: '2026-09-10',
      },
    ],
    alliances: [
      {
        topic: 'Deputada Estadual (PT)',
        detail: 'Dobradinha estadual indicada com Solla na cidade.',
        sourceUrl: 'https://exemplo.test/dobradinha',
        sourceDate: '2026-09-10',
      },
    ],
    gaps: [],
  },
  { now: generatedAt },
)

const snapshot = {
  meta: {
    source: 'Base Teqo (produção, leitura read-only)',
    readAt: '2026-09-15T10:30:00.000Z',
    readOnly: true,
    database: '127.0.0.1:5433/teqo_1313',
    codeSha: 'abc1234',
    actorId: 3,
    actorName: 'Seed Candidato',
    actorRole: 'candidate',
    actorRoleLabel: 'Candidato',
  },
  municipality: {
    id: 42,
    slug: 'feira-de-santana',
    name: 'Feira de Santana',
    kind: 'municipio',
    city: 'Feira de Santana',
    region: 'Portal do Sertão',
    ibgeCode: '2910800',
  },
  pledges: {
    declaredTotal: 15_000,
    lastPledgeAt: '2026-08-30T10:00:00.000Z',
  },
  leaderships: {
    totalCount: 9,
    rows: [
      {
        id: 1,
        name: 'Liderança Um',
        supportStatus: 'engajado',
        organizationNames: ['Associação X'],
        hasAppAccess: true,
        updatedAt: '2026-09-10T10:00:00.000Z',
      },
    ],
  },
  advisors: [{ id: 2, name: 'Seed Assessor' }],
  conjuncture: {
    priority: 'alta',
    politicalTrend: {
      status: 'favoravel',
      note: 'Prefeito sinaliza apoio',
      recordedByName: 'Seed Coordenador',
      recordedAt: '2026-08-20T10:00:00.000Z',
    },
    engagementLevel: 'n3',
    levelNote: 'Rede ativa',
    strengths: ['Rede de saúde forte'],
    risks: ['Oposição com rádio local'],
    dobradinhaNotes: 'Dobradinha com a deputada estadual',
    nextSteps: 'Agendar reunião com o prefeito',
    stateDeputies: [{ id: 5, name: 'Deputada Estadual', party: 'PT' }],
  },
  demographics: {
    population: 600_000,
    ageBands: { '0-17': 150_000, '18-29': 120_000, '30-59': 250_000, '60+': 80_000 },
    sexShareFemale: 0.52,
    medianAge: 34,
  },
}

type ReportItem = {
  label?: string
  text?: string
  value?: string
  hint?: string | null
  url?: string | null
  title?: string
  body?: string
  source?: { url?: string | null; date?: string | null }
}
type ReportRow = {
  label: string
  value: string
  source?: { url?: string | null; date?: string | null }
}
type TableRow = Record<string, string>
type ReportBlock = {
  kind: string
  title?: string
  tone?: string
  items?: ReportItem[]
  rows?: ReportRow[]
  columns?: Array<{ key: string; label: string; width?: number }>
  cells?: Array<{ title: string; blocks: ReportBlock[] }>
  body?: string[]
  note?: string
  remaining?: number
  sources?: Array<{ kind: string; url?: string | null }>
}
type ReportShape = {
  page1: { blocks: ReportBlock[] }
  sections: Array<{ id: string; title: string; blocks: ReportBlock[] }>
}

const asReport = (value: unknown) => value as ReportShape

const byId = (report: ReportShape, id: string) =>
  report.sections.find((section) => section.id === id)!

describe('buildCityReport', () => {
  const report = asReport(buildCityReport({ snapshot, research, generatedAt }))

  it('builds the nine 2º-turno sections in the product order', () => {
    expect(report.sections).toHaveLength(9)
    expect(report.sections.map((section) => section.id)).toEqual([
      'segundo-turno',
      'rede',
      'conjuntura',
      'demografia',
      'economia',
      'transporte',
      'noticias',
      'abordagem',
      'fontes',
    ])
    expect(report.sections[0].title).toBe('1. 2º turno no município (Lula × Flávio)')
    expect(report.sections[1].title).toBe('2. Rede e lideranças')
    expect(report.sections[8].title).toBe('9. Fontes e limites')
  })

  it('retires the mandate-era sections from the report', () => {
    const ids = report.sections.map((section) => section.id)
    for (const retired of [
      'conta-eleitoral',
      'concorrentes',
      'falas',
      'regiao',
      'sinais',
      'demandas',
    ]) {
      expect(ids).not.toContain(retired)
    }
    const serialized = JSON.stringify(report)
    for (const copy of [
      'Concorrentes',
      'O que Solla entregou',
      'Acervo de falas',
      'Panorama regional',
      'Emendas',
    ]) {
      expect(serialized).not.toContain(copy)
    }
  })

  it('brings the 2º turno artifact to the dedicated section', () => {
    const section = byId(report, 'segundo-turno')
    const callout = section.blocks.find((block) => block.kind === 'callout')!
    expect(callout.title).toContain('Defesa e comparecimento')
    expect(callout.body!.join(' ')).toContain('Captura do adversário')
    const table = section.blocks.find((block) => block.kind === 'table')!
    const rows = table.rows as unknown as Array<Record<string, string>>
    expect(rows[0]).toEqual(
      expect.objectContaining({
        label: 'Lula (PT)',
        y22: '211.813',
        y26: '194.272',
        delta: '−17.541',
      }),
    )
    // The local movement of the research feeds the section; sem fonte não entra.
    expect(section.blocks.some((block) => block.title?.includes('movimento local'))).toBe(true)
  })

  it('gaps the 2º turno research when the researcher did not answer it', () => {
    const researchWithout = normalizeResearchInput(
      {
        municipalitySlug: 'feira-de-santana',
        researchedAt: '2026-09-14T10:00:00.000Z',
        items: RESEARCH_CHECKLIST_IDS.filter((id) => id !== 'segundo_turno').map((id) =>
          validItem(id),
        ),
        gaps: [],
      },
      { now: generatedAt },
    )
    const withoutReport = asReport(
      buildCityReport({ snapshot, research: researchWithout, generatedAt }),
    )
    const section = byId(withoutReport, 'segundo-turno')
    const gap = section.blocks.find((block) => block.kind === 'callout' && block.tone === 'gap')!
    expect(gap.body!.join(' ')).toContain('Não pesquisado.')
    const pageMovement = withoutReport.page1.blocks.find(
      (block) => block.title === 'Movimento local do 2º turno (pesquisa)',
    )!
    expect(pageMovement.tone).toBe('gap')
  })

  it('keeps page 1 in the contract order — mobilization only', () => {
    const kinds = report.page1.blocks.map((block) => block.kind)
    expect(kinds).toEqual(['strip', 'grid', 'callout', 'cards', 'panel', 'footerNote'])
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    expect(grid.cells!.map((cell) => cell.title)).toEqual([
      '2º turno — Lula × Flávio',
      'Quem mobiliza',
    ])
    const ask = report.page1.blocks.find((block) => block.kind === 'panel')!
    expect(ask.title).toBe('O que pedir e falar')
    expect(ask.tone).toBe('decision')
    expect(ask.note).toContain('votos em jogo')
    expect(ask.items!.some((item) => item.text!.includes('Lula 13'))).toBe(true)
  })

  it('shows the official 2º-turno KPIs and the deterministic role on page 1', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const cell = grid.cells![0]
    const kpis = cell.blocks.find((block) => block.kind === 'kpis')!
    expect(kpis.items!.map((item) => item.label)).toEqual([
      'Lula em 2026',
      'Votos fora do 2º turno',
      'Solla 2026',
    ])
    expect(kpis.items![0].hint).toContain('Δ')
    expect(kpis.items![1].value).toMatch(/^X₂ = /)
    expect(kpis.items![1].hint).toContain('X₁ = ')
    const role = cell.blocks.find((block) => block.kind === 'callout')!
    expect(role.title).toContain('Papel no 2º turno')
  })

  it('reads the relative lens (share and delta), never the statewide absolute', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const kpis = grid.cells![0].blocks.find((block) => block.kind === 'kpis')!
    expect(kpis.items![0].value).toMatch(/%$/)
    expect(kpis.items![0].hint).toContain('dos válidos')
  })

  it('puts research answers in Quem mobiliza with compact sources and URLs in the sources section', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const who = grid.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe('Resposta de prefeito')
    expect(prefeito.source!.url).toBeNull()
    expect(prefeito.source!.date).toBe('2026-09-10')
    const labels = who.rows!.map((row) => row.label)
    for (const label of [
      'Vice',
      'Relação com o campo',
      'Lideranças',
      'Dobradinhas',
      'Vereadores/dobradas',
    ]) {
      expect(labels).toContain(label)
    }
    const fontes = byId(report, 'fontes').blocks.find((block) => block.kind === 'sources')!
    expect(fontes.items!.some((item) => item.url === 'https://exemplo.test/prefeito')).toBe(true)
    expect(fontes.items!.some((item) => item.url === 'https://exemplo.test/polo')).toBe(true)
  })

  it('describes the local movement from the research with its date', () => {
    const movement = report.page1.blocks.find(
      (block) => block.title === 'Movimento local do 2º turno (pesquisa)',
    )!
    expect(movement.kind).toBe('callout')
    expect(movement.body!.join(' ')).toContain('Resposta de segundo_turno')
    expect(movement.body!.join(' ')).toContain('10/09/2026')
  })

  it('adds the researched demography, economy and transport data', () => {
    const demografia = byId(report, 'demografia').blocks[0]
    const rows = demografia.rows as unknown as TableRow[]
    expect(rows[0].indicator).toBe('População')
    expect(rows[0].source).toBe('base Teqo')
    expect(rows.some((row) => row.indicator === 'Cor/raça' && row.source === '10/09/2026')).toBe(
      true,
    )
    expect(
      demografia.sources!.some((source) => source.url === 'https://exemplo.test/cor-raca'),
    ).toBe(true)
    const economia = byId(report, 'economia').blocks[0]
    expect((economia.rows as unknown as TableRow[])[0].detail).toContain('Serviços')
    const transporte = byId(report, 'transporte').blocks[0]
    expect((transporte.rows as unknown as TableRow[])[0].detail).toContain('BR-101')
    expect(transporte.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/br101' }),
    )
  })

  it('renders the opposition front inside the conjuncture section, when researched', () => {
    const conjuntura = byId(report, 'conjuntura')
    const opposition = conjuntura.blocks.find(
      (block) => block.title === 'Frente de oposição — o que usar com fonte (pesquisa)',
    )!
    const rows = opposition.rows as unknown as TableRow[]
    expect(rows[0].topic).toBe('Obra parada no campo adversário')
    expect(rows[0].detail).toContain('Anúncio sem entrega')
    expect(opposition.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/oposicao' }),
    )
  })

  it('lists the researched city leaders, their agenda and the dobradinhas in the network section', () => {
    const rede = byId(report, 'rede')
    const leadersBlock = rede.blocks.find(
      (block) => block.title === 'Lideranças da cidade (pesquisa)',
    )!
    const rows = leadersBlock.rows as unknown as TableRow[]
    expect(rows[0].name).toBe('Ex-Prefeito')
    expect(rows[0].party).toBe('PSDB')
    expect(leadersBlock.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/lideranca' }),
    )
    const agenda = rede.blocks.find((block) => block.title === 'Pauta das lideranças (pesquisa)')!
    expect((agenda.rows as unknown as TableRow[])[0].topics).toContain('hospital')
    const dobradinhas = rede.blocks.find((block) => block.title === 'Dobradinhas (pesquisa)')!
    expect((dobradinhas.rows as unknown as TableRow[])[0].topic).toContain('Deputada Estadual')
  })

  it('renders the persona approach section and its sources', () => {
    const abordagem = byId(report, 'abordagem').blocks[0]
    const rows = abordagem.rows as unknown as TableRow[]
    expect(rows[0].topic).toContain('Ciência política')
    expect(rows[0].suggestion).toContain('SAMU')
    expect(abordagem.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/abordagem' }),
    )
  })

  it('keeps the full page-1 answer (no "…") and preserves the integral in the deep dive (C188)', () => {
    const longAnswer = 'palavra '.repeat(20).trim()
    const longResearch = normalizeResearchInput(
      {
        municipalitySlug: 'feira-de-santana',
        researchedAt: '2026-09-14T10:00:00.000Z',
        items: RESEARCH_CHECKLIST_IDS.map((id) => validItem(id, { answer: longAnswer })),
        gaps: [],
      },
      { now: generatedAt },
    )
    const capped = asReport(buildCityReport({ snapshot, research: longResearch, generatedAt }))

    const who = capped.page1.blocks.find((block) => block.kind === 'grid')!.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe(longAnswer)
    expect(prefeito.value!.includes('…')).toBe(false)

    const appendix = byId(capped, 'fontes').blocks.find(
      (block) => block.title === 'Pesquisa — respostas integrais (texto completo)',
    )!
    const rows = appendix.rows as unknown as TableRow[]
    expect(rows).toHaveLength(RESEARCH_CHECKLIST_IDS.length)
    expect(rows[0].answer).toContain(longAnswer)
  })

  it('prefers the researcher summary on page 1 when present (C188)', () => {
    const longAnswer = 'palavra '.repeat(20).trim()
    const summary = 'Resumo curto e completo do prefeito.'
    const summarized = normalizeResearchInput(
      {
        municipalitySlug: 'feira-de-santana',
        researchedAt: '2026-09-14T10:00:00.000Z',
        items: RESEARCH_CHECKLIST_IDS.map((id) => validItem(id, { answer: longAnswer, summary })),
        gaps: [],
      },
      { now: generatedAt },
    )
    const capped = asReport(buildCityReport({ snapshot, research: summarized, generatedAt }))

    const who = capped.page1.blocks.find((block) => block.kind === 'grid')!.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe(summary)
  })

  it('falls back to a pointer line (never "…") when the full text does not fit (C188)', () => {
    const longAnswer = 'palavra '.repeat(20).trim()
    const longResearch = normalizeResearchInput(
      {
        municipalitySlug: 'feira-de-santana',
        researchedAt: '2026-09-14T10:00:00.000Z',
        items: RESEARCH_CHECKLIST_IDS.map((id) => validItem(id, { answer: longAnswer })),
        gaps: [],
      },
      { now: generatedAt },
    )
    const pointer = asReport(
      buildCityReport({
        snapshot,
        research: longResearch,
        generatedAt,
        textFallback: 'pointer',
      }),
    )

    const who = pointer.page1.blocks.find((block) => block.kind === 'grid')!.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe(SUMMARY_POINTER_COPY)
    expect(prefeito.value!.includes('…')).toBe(false)
  })

  it('shows the dobradinhas remainder when the list is capped', () => {
    const manyDeputies = asReport(
      buildCityReport({
        snapshot: {
          ...snapshot,
          conjuncture: {
            ...snapshot.conjuncture,
            stateDeputies: [
              { id: 5, name: 'Deputada Estadual', party: 'PT' },
              { id: 6, name: 'Deputado Dois', party: 'PCdoB' },
              { id: 7, name: 'Deputado Três', party: 'PT' },
            ],
          },
        },
        research,
        generatedAt,
      }),
    )
    const many = manyDeputies.page1.blocks.find((block) => block.kind === 'grid')!.cells![1]
      .blocks[0]
    const dobradinhas = many.rows!.find((row) => row.label === 'Dobradinhas')!
    expect(dobradinhas.value).toContain('e mais 1')
    expect(dobradinhas.value).not.toContain('Deputado Três')
  })

  it('tolerates snapshots from the pre-refactor shape (extra groups ignored)', () => {
    const legacySnapshot = {
      ...snapshot,
      electoral: {
        series: [{ year: 2022, votes: 1 }],
        rank2022: { rank: 1, votes: 1, share: 1, totalUnits: 435 },
      },
      goal: { suggestedGoal: 1, goalCoverage: {}, territorialClass: { class: 'expansao' } },
      signals: { totalCount: 1, rows: [] },
      activities: { upcoming: [], recent: [] },
      speeches: { totalCount: 0, rows: [] },
      demands: { totalCount: 0, rows: [] },
      competitors: { referenceYear: 2022, federal: [], state: [] },
    }
    const legacy = asReport(buildCityReport({ snapshot: legacySnapshot, research, generatedAt }))
    expect(legacy.sections).toHaveLength(9)
    expect(legacy.page1.blocks.map((block) => block.kind)).toEqual([
      'strip',
      'grid',
      'callout',
      'cards',
      'panel',
      'footerNote',
    ])
  })

  it('shows a gap instead of an empty 2º-turno cell when the unit is outside the artifact', () => {
    const outside = asReport(
      buildCityReport({
        snapshot: {
          ...snapshot,
          municipality: { ...snapshot.municipality, slug: 'nao-existe-no-artefato' },
        },
        research,
        generatedAt,
      }),
    )
    const cell = outside.page1.blocks.find((block) => block.kind === 'grid')!.cells![0]
    const gap = cell.blocks.find((block) => block.kind === 'callout' && block.tone === 'gap')!
    expect(gap.body!.join(' ')).toContain('build:second-round')
    const section = byId(outside, 'segundo-turno')
    expect(section.blocks.some((block) => block.kind === 'callout' && block.tone === 'gap')).toBe(
      true,
    )
  })
})
