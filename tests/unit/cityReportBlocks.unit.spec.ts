import { describe, expect, it } from 'vitest'

import { buildCityReport } from '../../scripts/lib/cityReportBlocks.mjs'
import {
  normalizeResearchInput,
  RESEARCH_CHECKLIST_IDS,
} from '../../scripts/lib/cityReportResearch.mjs'

const generatedAt = new Date('2026-09-15T12:00:00.000Z')

const validItem = (id: string) => ({
  id,
  answer: `Resposta de ${id}`,
  sourceUrl: `https://exemplo.test/${id}`,
  sourceDate: '2026-09-10',
})

const research = normalizeResearchInput(
  {
    municipalitySlug: 'feira-de-santana',
    researchedAt: '2026-09-14T10:00:00.000Z',
    items: RESEARCH_CHECKLIST_IDS.map(validItem),
    news: [
      {
        title: 'Matéria local',
        url: 'https://jornal.test/materia',
        publishedAt: '2026-09-01T00:00:00.000Z',
        outlet: 'Jornal Local',
      },
    ],
    gaps: [],
  },
  { now: generatedAt },
)

const emendas = {
  status: 'ok',
  reason: null,
  detail: null,
  sourceUrl: 'https://api.portaldatransparencia.gov.br/api-de-dados/emendas?nomeAutor=JORGE+SOLLA',
  consultedAt: '2026-09-15T11:00:00.000Z',
  requestCount: 4,
  years: [2023, 2024, 2025, 2026],
  authorName: 'JORGE SOLLA',
  authorCode: '1234',
  rows: [
    {
      code: '202312340001',
      year: 2023,
      type: 'Individual',
      authorCode: '1234',
      empenhado: 1_000_000,
      liquidado: 500_000,
      pago: 250_000,
      restoPago: 10_000,
    },
  ],
  totals: { empenhado: 1_000_000, liquidado: 500_000, pago: 250_000, restoPago: 10_000 },
}

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
    tseCityCode: '31270',
    zoneNumber: null,
    tseZones: [12, 13],
    lastUpdateAt: '2026-09-01T10:00:00.000Z',
  },
  electoral: {
    candidateName: 'Jorge Solla',
    candidateParty: 'PT',
    series: [
      { year: 2014, votes: 30_000 },
      { year: 2018, votes: 40_000 },
      { year: 2022, votes: 50_000 },
    ],
    tally2022: { aptos: 400_000, comparecimento: 300_000, votosValidos: 280_000 },
    ticket2022: { president: 100_000, governor: 90_000 },
    rank2022: { rank: 3, votes: 50_000, share: 0.05, totalUnits: 435 },
  },
  goal: {
    suggestedGoal: 60_000,
    goalCoverage: { goal: 60_000, committed: 15_000, coverageRatio: 0.25, deficit: 45_000 },
    territorialClass: {
      class: 'expansao',
      factors: [],
      lq: 1.2,
      ownShare: 0.05,
      inCoreBlock: true,
    },
    potential: {},
    territoryCaptureBenchmark: {},
  },
  pledges: {
    declaredTotal: 15_000,
    effectiveByScenario: { pessimistic: 10_000, central: 15_000, optimistic: 20_000 },
    pledgeCount: 7,
    missingEstimateCount: 1,
    lastPledgeAt: '2026-08-30T10:00:00.000Z',
  },
  leaderships: {
    totalCount: 9,
    rows: [
      {
        id: 1,
        name: 'Liderança Um',
        supportStatus: 'engajado',
        exclusive: true,
        organizationNames: ['Associação X'],
        stateDeputies: [{ name: 'Deputada Estadual' }],
        hasAppAccess: true,
        updatedAt: '2026-09-10T10:00:00.000Z',
      },
    ],
  },
  advisors: [{ id: 2, name: 'Seed Assessor' }],
  signals: {
    totalCount: 1,
    rows: [
      {
        id: 10,
        createdAt: '2026-09-12T10:00:00.000Z',
        body: 'Sinal recente sobre a cidade',
        polarity: 'boa',
        urgent: false,
        adversarySignal: false,
        responsibleName: 'Seed Assessor',
        activeVolunteers: 10,
        newSupports: 2,
        resolvedAt: null,
      },
    ],
  },
  activities: {
    upcoming: [
      {
        id: 20,
        title: 'Visita ao centro',
        status: 'confirmado',
        startAt: '2026-09-20T13:00:00.000Z',
        endAt: null,
        locality: 'Centro',
        deputyPresent: true,
        taskProgress: { done: 1, total: 2 },
      },
    ],
    recent: [],
  },
  conjuncture: {
    priority: 'alta',
    expectedVotes: { pessimistic: 40_000, central: 50_000, optimistic: 70_000 },
    politicalTrend: {
      status: 'favoravel',
      note: 'Prefeito sinaliza apoio',
      recordedByName: 'Seed Coordenador',
      recordedAt: '2026-08-20T10:00:00.000Z',
    },
    engagementLevel: 'n3',
    levelNote: 'Rede ativa',
    levelChangedAt: '2026-08-01T10:00:00.000Z',
    strengths: ['Rede de saúde forte'],
    risks: ['Oposição com rádio local'],
    dobradinhaNotes: 'Dobradinha com a deputada estadual',
    nextSteps: 'Agendar reunião com o prefeito',
    budgetNotes: 'Emenda de custeio aportada em 2025',
    stateDeputies: [{ id: 5, name: 'Deputada Estadual', party: 'PT' }],
  },
  speeches: {
    totalCount: 1,
    rows: [
      {
        id: 30,
        speechAt: '2026-07-01T10:00:00.000Z',
        year: 2026,
        phase: 'Discurso em plenário',
        summary: 'Resumo da fala',
        officialTextUrl: 'https://camara.test/discurso',
        watchHref: '/campanha/comunicacao/acervo/30?t=120',
        excerpt: 'Trecho da fala sobre Feira de Santana',
      },
    ],
  },
  demands: {
    totalCount: 1,
    rows: [
      {
        id: 40,
        title: 'Demanda de saúde',
        kind: 'saude',
        status: 'recebida',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
      },
    ],
  },
  demographics: {
    population: 600_000,
    ageBands: { '0-17': 150_000, '18-29': 120_000, '30-59': 250_000, '60+': 80_000 },
    sexShareFemale: 0.52,
    medianAge: 34,
  },
}

type ReportItem = { label?: string; text?: string; value?: string; hint?: string | null }
type ReportRow = { label: string; value: string; source?: { url?: string } }
type ReportBlock = {
  kind: string
  title?: string
  items?: ReportItem[]
  rows?: ReportRow[]
  cells?: Array<{ title: string; blocks: ReportBlock[] }>
  body?: string[]
  sources?: Array<{ kind: string; url?: string | null }>
  left?: { title: string; items: ReportItem[] }
  right?: { title: string; items: ReportItem[] }
}
type ReportShape = {
  page1: { blocks: ReportBlock[] }
  sections: Array<{ id: string; title: string; blocks: ReportBlock[] }>
}

const asReport = (value: unknown) => value as ReportShape

describe('buildCityReport', () => {
  const report = asReport(buildCityReport({ snapshot, research, emendas, generatedAt }))

  it('builds the 10 deepening sections in the product order', () => {
    expect(report.sections).toHaveLength(10)
    expect(report.sections[0].title).toMatch(/Conta eleitoral completa/)
    expect(report.sections[9].title).toMatch(/Fontes e limites/)
  })

  it('keeps page 1 in the contract order (six blocks + footer)', () => {
    const kinds = report.page1.blocks
      .map((block) => block.kind)
      .filter((kind) => kind !== 'callout')
    expect(kinds).toEqual(['strip', 'grid', 'kpis', 'pair', 'cards', 'footerNote'])
    const titles = report.page1.blocks.map((block) => block.title).filter(Boolean)
    expect(titles).toEqual(
      expect.arrayContaining(['O que Solla entregou', 'Riscos — oposição/disputa local']),
    )
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    expect(grid.cells!.map((cell) => cell.title)).toEqual(['Conta eleitoral 2022', 'Quem é quem'])
    const pair = report.page1.blocks.find((block) => block.kind === 'pair')!
    expect(pair.left!.title).toBe('O que anunciar agora')
    expect(pair.right!.items.some((item) => item.text?.includes('Empenho'))).toBe(true)
  })

  it('reads the relative lens (share/rank), never the statewide absolute', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const kpis = grid.cells![0].blocks.find((block) => block.kind === 'kpis')!
    expect(kpis.items![0].value).toBe('50.000')
    expect(kpis.items![0].hint).toContain('5,0%')
    expect(kpis.items![1].value).toBe('3º de 435')
  })

  it('shows emendas with phase and the official source', () => {
    const delivered = report.page1.blocks.find(
      (block) => block.kind === 'kpis' && block.title === 'O que Solla entregou',
    )!
    expect(delivered.items![0].value).toBe('R$ 1,0 mi')
    expect(delivered.items![0].hint).toContain('Pago: R$ 250 mil')
    expect(delivered.sources![0]).toEqual(
      expect.objectContaining({
        kind: 'official',
        url: expect.stringContaining('portaldatransparencia'),
      }),
    )
  })

  it('degrades missing emendas into an explicit gap, never a zero', () => {
    const gapReport = asReport(
      buildCityReport({
        snapshot,
        research,
        emendas: {
          status: 'gap',
          reason: 'Chave ausente',
          detail: null,
          sourceUrl: null,
          consultedAt: null,
        },
        generatedAt,
      }),
    )
    const delivered = gapReport.page1.blocks.find(
      (block) => block.kind === 'kpis' && block.title === 'O que Solla entregou',
    )!
    expect(delivered.items![0].value).toBe('Sem fonte oficial')
    const gaps = gapReport.page1.blocks.find(
      (block) => block.kind === 'callout' && block.title === 'Pontos sem leitura',
    )!
    expect(gaps.body!.join(' ')).toMatch(/Emendas/)
  })

  it('puts research answers in Quem é quem with their source', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const who = grid.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe('Resposta de prefeito')
    expect(prefeito.source!.url).toBe('https://exemplo.test/prefeito')
  })

  it('builds the region panorama from the committed artifact', () => {
    const region = report.sections.find((section) => section.id === 'regiao')!.blocks[0]
    const rowByLabel = (label: string) => region.rows!.find((row) => row.label === label)!
    expect(rowByLabel('Território').value).toBe('Portal do Sertão')
    expect(rowByLabel('Municípios no TI').value).toBe('17')
    const position = Number(rowByLabel('Posição do município no TI').value.split('º')[0])
    expect(position).toBeGreaterThan(0)
  })
})
