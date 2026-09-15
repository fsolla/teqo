import { describe, expect, it } from 'vitest'

import { buildCityReport } from '../../scripts/lib/cityReportBlocks.mjs'
import {
  normalizeResearchInput,
  RESEARCH_CHECKLIST_IDS,
} from '../../scripts/lib/cityReportResearch.mjs'

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
      id === 'emendas_web'
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
    preCandidates: [
      {
        name: 'Deputado do Prefeito',
        office: 'Deputado federal',
        party: 'PSDB',
        support: 'Prefeito Jorge Almeida',
        sourceUrl: 'https://exemplo.test/pre-candidato',
        sourceDate: '2026-04-18',
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
  competitors: {
    referenceYear: 2022,
    federal: [
      {
        candidateNumber: 1313,
        name: 'Solla',
        party: 'PT',
        votesByYear: { '2018': 40_000, '2022': 50_000 },
      },
      {
        candidateNumber: 4545,
        name: 'Concorrente A',
        party: 'PSDB',
        votesByYear: { '2018': 20_000, '2022': 30_000 },
      },
    ],
    state: [],
  },
  speeches: {
    totalCount: 2,
    rows: [
      {
        id: 30,
        speechAt: '2026-07-01T10:00:00.000Z',
        year: 2026,
        phase: 'Discurso em plenário',
        summary: 'Resumo da fala',
        officialTextUrl: 'https://camara.test/discurso',
        youtubeUrl: 'https://youtube.test/video',
        vodPlaybackUrl: 'https://vod.test/video.mp4',
        youtubeExcerptStartSeconds: 645,
        mentionExcerpt: 'Trecho da fala que cita Feira de Santana',
        mentionedMunicipalityCount: 3,
      },
      {
        id: 31,
        speechAt: '2026-06-01T10:00:00.000Z',
        year: 2026,
        phase: 'Pequeno Expediente',
        summary: 'Saúde indígena na Bahia',
        officialTextUrl: 'https://camara.test/discurso-2',
        youtubeUrl: null,
        vodPlaybackUrl: null,
        mentionExcerpt: null,
        mentionedMunicipalityCount: 25,
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

type ReportItem = {
  label?: string
  text?: string
  value?: string
  hint?: string | null
  url?: string | null
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
  items?: ReportItem[]
  rows?: ReportRow[]
  columns?: Array<{ key: string; label: string; width?: number }>
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

  it('builds the 14 deepening sections in the product order', () => {
    expect(report.sections).toHaveLength(14)
    expect(report.sections[0].title).toMatch(/Conta eleitoral completa/)
    expect(report.sections[1].title).toMatch(/Concorrentes no município/)
    expect(report.sections[7].title).toMatch(/Atividade econômica/)
    expect(report.sections[8].title).toMatch(/Transporte e conexões/)
    expect(report.sections[12].title).toMatch(/Abordagem sugerida/)
    expect(report.sections[13].title).toMatch(/Fontes e limites/)
  })

  it('adds the researched demography, economy and transport data', () => {
    const demografia = report.sections.find((section) => section.id === 'demografia')!.blocks[0]
    const rows = demografia.rows as unknown as TableRow[]
    expect(rows[0].indicator).toBe('População')
    expect(rows[0].source).toBe('base Teqo')
    expect(rows.some((row) => row.indicator === 'Cor/raça' && row.source === '10/09/2026')).toBe(
      true,
    )
    expect(
      demografia.sources!.some((source) => source.url === 'https://exemplo.test/cor-raca'),
    ).toBe(true)
    const economia = report.sections.find((section) => section.id === 'economia')!.blocks[0]
    expect((economia.rows as unknown as TableRow[])[0].detail).toContain('Serviços')
    const transporte = report.sections.find((section) => section.id === 'transporte')!.blocks[0]
    expect((transporte.rows as unknown as TableRow[])[0].detail).toContain('BR-101')
    expect(transporte.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/br101' }),
    )
  })

  it('lists the main competitors with their vote series and the pre-candidates', () => {
    const concorrentes = report.sections.find((section) => section.id === 'concorrentes')!
    const federal = concorrentes.blocks[0]
    const rows = federal.rows as unknown as TableRow[]
    expect(federal.title).toContain('Deputado federal')
    expect(rows.map((row) => row.name)).toEqual(['Solla', 'Concorrente A'])
    expect(rows[1].y2022).toBe('30.000')
    expect(rows[1].y2014).toBe('—')
    const preCandidates = concorrentes.blocks[2]
    const preRows = preCandidates.rows as unknown as TableRow[]
    expect(preRows[0].name).toBe('Deputado do Prefeito')
    expect(preCandidates.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/pre-candidato' }),
    )
  })

  it('lists the researched city leaders in the network section', () => {
    const rede = report.sections.find((section) => section.id === 'rede')!
    const leadersBlock = rede.blocks.find(
      (block) => block.title === 'Lideranças da cidade (pesquisa)',
    )!
    const rows = leadersBlock.rows as unknown as TableRow[]
    expect(rows[0].name).toBe('Ex-Prefeito')
    expect(rows[0].party).toBe('PSDB')
    expect(rows[0].period).toBe('2017–2024')
    expect(leadersBlock.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/lideranca' }),
    )
  })

  it('shows expected votes on page 1 instead of the goal/pledge coverage', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const kpis = grid.cells![0].blocks.find((block) => block.kind === 'kpis')!
    expect(kpis.items!.map((item) => item.label)).toEqual([
      'Votos em 2022',
      'Rank no estado',
      'Expectativa de votos',
    ])
    expect(kpis.items![2].value).toBe('50.000')
    expect(kpis.items![2].hint).toContain('Pessimista 40.000')
    expect(kpis.items![2].hint).toContain('Otimista 70.000')
    const leftLabels = grid.cells![0].blocks.flatMap((block) =>
      (block.rows ?? []).map((row) => row.label),
    )
    expect(leftLabels).not.toContain('Cobertura de pledges')
    expect(JSON.stringify(report.page1)).not.toContain('Meta 2026')
  })

  it('describes what each speech is and how the município is mentioned', () => {
    const falas = report.sections.find((section) => section.id === 'falas')!.blocks[0]
    const rows = falas.rows as unknown as TableRow[]
    expect(falas.columns!.map((column) => column.label)).toEqual([
      'Data',
      'Fase',
      'O que é',
      `Menção a ${snapshot.municipality.name}`,
      'Vídeo',
      'Transcrição',
    ])
    expect(falas.columns!.find((column) => column.key === 'description')!.width).toBe(32)
    expect(falas.columns!.find((column) => column.key === 'mention')!.width).toBe(27)
    expect(rows[0].description).toBe('Resumo da fala')
    expect(rows[0].mention).toContain('cita Feira de Santana')
    expect(rows[0].video).toBe('https://youtube.test/video?t=625s')
    expect(rows[0].transcript).toBe('https://camara.test/discurso')
    expect(rows[1].description).toBe('Saúde indígena na Bahia')
    expect(rows[1].mention).toContain('nome não localizado nos trechos')
    expect(rows[1].mention).toContain('25 municípios')
    expect(rows[1].video).toBe('—')
  })

  it('renders the persona approach section and its sources', () => {
    const abordagem = report.sections.find((section) => section.id === 'abordagem')!.blocks[0]
    const rows = abordagem.rows as unknown as TableRow[]
    expect(rows[0].topic).toContain('Ciência política')
    expect(rows[0].suggestion).toContain('SAMU')
    expect(abordagem.sources![0]).toEqual(
      expect.objectContaining({ url: 'https://exemplo.test/abordagem' }),
    )
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
    expect(delivered.items![0].hint).toContain('sem emenda atribuível')
  })

  it('shows the web evidence for emendas when the official source is a gap', () => {
    const gapReport = asReport(
      buildCityReport({
        snapshot,
        research,
        emendas: {
          status: 'gap',
          reason: 'Sem emenda do autor com localidade Feira de Santana na janela.',
          detail: 'API não expõe o município da emenda.',
          sourceUrl: 'https://api.portaldatransparencia.gov.br/api-de-dados/emendas',
          consultedAt: '2026-09-15T11:00:00.000Z',
        },
        generatedAt,
      }),
    )
    const evidence = gapReport.page1.blocks.find(
      (block) =>
        block.kind === 'callout' &&
        block.title === 'Emendas — indícios web (sem atribuição oficial ao município)',
    )
    expect(evidence).toBeTruthy()
    expect(evidence!.body!.join(' ')).toContain('Resposta de emendas_web')
    const evidenceOk = asReport(buildCityReport({ snapshot, research, emendas, generatedAt }))
    expect(
      evidenceOk.page1.blocks.some(
        (block) => block.title === 'Emendas — indícios web (sem atribuição oficial ao município)',
      ),
    ).toBe(false)
  })

  it('puts research answers in Quem é quem with compact sources and URLs in section 10', () => {
    const grid = report.page1.blocks.find((block) => block.kind === 'grid')!
    const who = grid.cells![1].blocks[0]
    const prefeito = who.rows!.find((row) => row.label === 'Prefeito(a)')!
    expect(prefeito.value).toBe('Resposta de prefeito')
    expect(prefeito.source!.url).toBeNull()
    expect(prefeito.source!.date).toBe('2026-09-10')
    const fontes = report.sections.find((section) => section.id === 'fontes')!.blocks[0]
    expect(fontes.items!.some((item) => item.url === 'https://exemplo.test/prefeito')).toBe(true)
    expect(fontes.items!.some((item) => item.url === 'https://exemplo.test/polo')).toBe(true)
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
