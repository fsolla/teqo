import { describe, expect, it } from 'vitest'

import { SPEECH_TOPICS } from '@/lib/speechFacets'

import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import { buildBulletin } from '../../scripts/lib/dossieBulletin.mjs'
import { renderBulletinHtml } from '../../scripts/lib/dossieBulletinRender.mjs'
import { renderDossierHtml, renderDossierMd } from '../../scripts/lib/dossieRender.mjs'
import {
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { THEME_UNIT, themeSubjectPhrase } from '../../scripts/lib/dossieUnit.mjs'

// C190: theme/area content model + render. Grounds the third recorte: area
// identity (label + canonical value), `area|segmento|rede` never summed, per-row
// phase/source, empty-era state instead of silent omission, and a one-page
// boletim that inherits only sourced facts.

const generatedAt = new Date('2026-09-18T12:00:00.000Z')

const snapshot = {
  meta: { readAt: '2026-09-18T11:00:00.000Z' },
  theme: {
    slug: 'educacao',
    value: 'educacao',
    label: 'Educação',
    taxonomyNote: 'Taxonomia do acervo',
    topics: ['educacao'],
  },
  speeches: {
    topics: ['educacao'],
    totalCount: 1,
    rows: [
      {
        id: 21,
        speechAt: '2024-05-10T00:00:00.000Z',
        summary: 'Defesa do financiamento da educação básica.',
        officialTextUrl: 'https://camara.test/discurso-educacao',
      },
    ],
  },
}

const item = (id: string, era: 'A' | 'B' | 'C', overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Ação ${id} documentada`,
  sphere: 'area',
  sourceUrl: `https://educacao.test/${id}`,
  sourceDate: '2024-06-01',
  era,
  ...overrides,
})

const eraFile = (era: 'A' | 'B' | 'C', items: unknown[]) => ({
  themeSlug: 'educacao',
  era,
  researchedAt: '2026-09-18T10:00:00.000Z',
  items,
  news: [
    {
      title: 'Notícia sobre educação',
      outlet: 'Educação Hoje',
      publishedAt: '2024-05-01',
      url: 'https://educacao.test/noticia',
    },
  ],
})

const research = mergeDossierResearch(
  [
    normalizeDossierResearchInput(
      eraFile('A', [
        item('era_a_formacao', 'A'),
        item('era_a_vinculo', 'A', { sphere: 'segmento' }),
        item('era_a_sesab', 'A', { sphere: 'rede' }),
      ]),
      { unit: THEME_UNIT },
    ),
    normalizeDossierResearchInput(
      eraFile('B', [
        item('era_b_sesab', 'B', {
          numbers: [{ label: 'Investimento', value: 'R$ 2,0 mi', year: '2012', phase: 'pago' }],
        }),
      ]),
      { unit: THEME_UNIT },
    ),
    normalizeDossierResearchInput(
      eraFile('C', [
        item('era_c_emendas', 'C', {
          numbers: [{ label: 'Emenda', value: 'R$ 5,0 mi', year: '2024', phase: 'empenhado' }],
        }),
        item('era_c_titulos', 'C', { answer: 'Homenagem da área' }),
      ]),
      { unit: THEME_UNIT },
    ),
  ],
  { unit: THEME_UNIT },
)

const report = buildDossierReport({
  snapshot,
  research,
  generatedAt,
  unit: THEME_UNIT,
})

describe('theme era without evidence', () => {
  const emptyReport = buildDossierReport({
    snapshot,
    research: mergeDossierResearch(
      (['A', 'B', 'C'] as const).map((era) =>
        normalizeDossierResearchInput(eraFile(era, []), { unit: THEME_UNIT }),
      ),
      { unit: THEME_UNIT },
    ),
    generatedAt,
    unit: THEME_UNIT,
  })

  it('marks an evidence-less era as an explicit gap, never a silent blank', () => {
    expect(emptyReport.eras.every((era) => era.empty)).toBe(true)
    const html = renderDossierHtml(emptyReport)
    expect(html).toContain('Lacuna explícita · não é “zero”')
    expect(html).toContain('Nenhuma fonte suficiente foi localizada para esta era.')
    expect(html).toContain('evidência da área não localizada')
    expect(html).toContain('empty-panel')
  })
})

describe('buildDossierReport (theme unit)', () => {
  it('maps the canonical area labels to the right subject preposition', () => {
    expect(themeSubjectPhrase('Saúde')).toBe('pela Saúde')
    expect(themeSubjectPhrase('Esporte')).toBe('pelo Esporte')
    expect(themeSubjectPhrase('Direitos Humanos e Assistência Social')).toBe(
      'pelos Direitos Humanos e Assistência Social',
    )
    expect(themeSubjectPhrase('Mulheres e Gênero')).toBe('pelas Mulheres e Gênero')
    expect(themeSubjectPhrase('Fora da taxonomia')).toBe('pela área de Fora da taxonomia')
  })

  it('has a mapped phrase for every canonical topic label (no silent fallback)', () => {
    for (const { label } of SPEECH_TOPICS) {
      expect(themeSubjectPhrase(label), label).not.toBe(`pela área de ${label}`)
    }
  })

  it('carries the area identity and canonical value', () => {
    expect(report.unit.id).toBe('theme')
    expect(report.meta.subjectName).toBe('Educação')
    expect(report.meta.identity?.value).toBe('educacao')
    expect(report.meta.identityBadges).toEqual(['Educação'])
  })

  it('keeps all three eras, marking evidence-less ones as explicit gaps', () => {
    expect(report.eras.map((era) => era.id)).toEqual(['A', 'B', 'C'])
    expect(report.eras.every((era) => typeof era.empty === 'boolean')).toBe(true)
  })

  it('never sums segmento/rede into the area list', () => {
    const listFor = (key: string) => report.reach.lists.find((list) => list.key === key)
    expect(listFor('area')?.items.every((row) => row.sphere === 'area')).toBe(true)
    expect(listFor('area')?.items.some((row) => row.id === 'era_a_vinculo')).toBe(false)
    expect(listFor('segment')?.total).toBe(1)
    expect(listFor('network')?.total).toBe(1)
  })

  it('declares overflow instead of truncating silently (C188 rule)', () => {
    for (const list of report.reach.lists) {
      expect(list).toMatchObject({ total: expect.any(Number), omitted: expect.any(Number) })
    }
    expect(report.page1.deliveries.omitted).toBeGreaterThanOrEqual(0)
  })

  it('shows every sourced item — theme lists are never capped', () => {
    const manyItems = [
      item('era_c_emendas', 'C', { sphere: 'segmento' }),
      item('era_c_programas', 'C', { sphere: 'segmento' }),
      item('era_c_relatorias', 'C', { sphere: 'segmento' }),
    ]
    const fullReport = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [normalizeDossierResearchInput(eraFile('C', manyItems), { unit: THEME_UNIT })],
        { unit: THEME_UNIT },
      ),
      generatedAt,
      unit: THEME_UNIT,
    })
    const list = fullReport.reach.lists.find((row) => row.key === 'segment')
    expect(list).toMatchObject({ total: 3, omitted: 0 })
    expect(list?.items).toHaveLength(3)
    const fullHtml = renderDossierHtml(fullReport)
    expect(fullHtml).not.toContain('e mais')
    for (const row of manyItems) expect(fullHtml).toContain(row.answer)
  })

  it('consolidates money by phase and never counts non-money numbers as money', () => {
    const synthesis = report.synthesis
    expect(synthesis).toBeTruthy()
    if (!synthesis) return
    const moneyItem = item('era_b_investimentos', 'B', {
      numbers: [{ label: 'Convênio', value: 'R$ 1,2 mi', year: '2012', phase: 'pago' }],
    })
    const countItem = item('era_b_politicas', 'B', {
      numbers: [{ label: 'Escolas', value: '175', year: '2010', phase: 'nao_informado' }],
    })
    const moneyReport = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [normalizeDossierResearchInput(eraFile('B', [moneyItem, countItem]), { unit: THEME_UNIT })],
        { unit: THEME_UNIT },
      ),
      generatedAt,
      unit: THEME_UNIT,
    })
    const moneySynthesis = moneyReport.synthesis
    expect(moneySynthesis).toBeTruthy()
    if (!moneySynthesis) return
    expect(moneySynthesis.totals.money).toBe(1)
    expect(moneySynthesis.moneyTotals.executed).toBe(1_200_000)
    const paid = moneySynthesis.moneyByPhase.find((row: { key: string }) => row.key === 'pago')
    expect(paid).toMatchObject({ count: 1, amount: 1_200_000 })
    expect(moneySynthesis.lines.join(' ')).toContain('R$ 1,2 mi pago')
    const html = renderDossierHtml(moneyReport)
    expect(html).toContain('R$ 1,2 mi')
    expect(html).toContain('Recursos com execução por ano')
  })

  it('derives bulletinFacts only from sourced items', () => {
    expect(report.bulletinFacts.length).toBeGreaterThan(0)
    expect(report.bulletinFacts.every((fact) => Boolean(fact.sourceUrl))).toBe(true)
  })

  it('consumes the read-only acervo rows as sourced evidence (never silent)', () => {
    expect(report.acervo.items.length).toBe(1)
    expect(report.acervo.items[0]).toMatchObject({ period: '2024', sourceUrl: expect.any(String) })
    expect(report.bulletinFacts.some((fact) => fact.id === 'fala-21')).toBe(true)
    expect(renderDossierMd(report)).toContain('## Acervo interno (read-only)')
  })
})

describe('renderDossierHtml/Md (theme unit)', () => {
  const html = renderDossierHtml(report)
  const md = renderDossierMd(report)

  it('anchors every theme page', () => {
    for (const anchor of [
      'capa',
      'resumo',
      'sintese',
      'graficos',
      'era-a',
      'era-b',
      'era-c',
      'abrangencia',
      'abrangencia-area',
      'abrangencia-segmento',
      'abrangencia-rede',
      'lacunas',
      'fontes',
    ]) {
      expect(html).toContain(`data-page="${anchor}"`)
    }
    // Theme has no separate honors sheet: títulos render inline in the era.
    expect(html).not.toContain('data-page="titulos"')
    expect(html).toContain('Homenagem da área')
  })

  it('prints the theme acervo scene with stats, canonical columns and the scope alert', () => {
    expect(html).toContain('acervo-stat-grid')
    expect(html).toContain('Universo recuperado')
    expect(html).toContain('Amostra exibida')
    expect(html).toContain('Tema canônico')
    expect(html).toContain('Trecho/contexto')
    expect(html).toContain('<code>educacao</code>')
    expect(html).toContain(
      'O tema prova pertinência ao recorte do acervo; não prova por si só entrega',
    )
  })

  it('prints the theme reach scene with the five columns and the ledger year', () => {
    expect(html).toContain('document-table--reach')
    expect(html).toContain('Era / ano')
    expect(html).toContain('Valor / fase')
    expect(html).toContain('Evidência temática')
    expect(html).toContain('Era A')
  })

  it('prints the theme gap scene with era, status and the attribution alert', () => {
    expect(html).toContain('Já consultado')
    expect(html).toContain('Próxima busca')
    expect(html).toContain('prioridade')
    expect(html).toContain('<span class="phase">aberta</span>')
    expect(html).toContain(
      'Portais que não filtram por área não autorizam atribuição. Sem fonte temática, a linha permanece lacuna — nunca zero.',
    )
  })

  it('prints the theme source hierarchy above the limits', () => {
    expect(html).toContain('Hierarquia de fontes')
    expect(html).toContain('Fontes primárias')
    expect(html).toContain('Atos, diários oficiais e documentos contemporâneos')
    expect(html).toContain('Sem documento, não entra')
    expect(html).toContain('Não filtram por área')
  })

  it('uses the theme synthesis labels and the pela/pelo subject phrase', () => {
    expect(html).toContain('Tipos de atuação com mais registros')
    expect(html).toContain('Pontos com fonte por ano')
    expect(html).toContain('O que Jorge Solla fez pela Educação')
    expect(html).toContain('pela Educação ao longo da carreira')
  })

  it('prints the synthesis lines and the consolidated charts', () => {
    const synthesis = report.synthesis
    expect(synthesis).toBeTruthy()
    if (!synthesis) return
    expect(synthesis.totals.items).toBeGreaterThan(0)
    const eraTotal = synthesis.byEra.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    )
    expect(eraTotal).toBe(synthesis.totals.items)
    const sphereTotal = synthesis.bySphere.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    )
    expect(sphereTotal).toBe(synthesis.totals.items)
    expect(html).toContain('data-page="sintese"')
    expect(html).toContain('data-page="graficos"')
    expect(html).toContain('Síntese do que foi localizado')
    expect(html).toContain('Gráficos consolidados')
    expect(html).toContain('chart-grid')
    expect(md).toContain('## Síntese do que foi localizado')
  })

  it('flows across continuation sheets when the pack plan splits a section', () => {
    const bigReport = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [
          normalizeDossierResearchInput(
            {
              themeSlug: 'educacao',
              era: 'C',
              researchedAt: '2026-09-18T10:00:00.000Z',
              items: [
                'era_c_discursos',
                'era_c_proposicoes',
                'era_c_relatorias',
                'era_c_emendas',
                'era_c_programas',
                'era_c_audiencias',
              ].map((id) => item(id, 'C', { sphere: 'segmento' })),
              news: Array.from({ length: 12 }, (_, index) => ({
                title: `Notícia ${index + 1}`,
                outlet: 'Educação Hoje',
                publishedAt: '2024-05-01',
                url: `https://educacao.test/noticia-${index + 1}`,
              })),
            },
            { unit: THEME_UNIT },
          ),
        ],
        { unit: THEME_UNIT },
      ),
      generatedAt,
      unit: THEME_UNIT,
    })
    const bigHtml = renderDossierHtml(bigReport, {
      pack: { 'era:C': [1], 'scope:segmento': [1], news: [1] },
    })
    expect(bigHtml).toContain('data-page="era-c"')
    expect(bigHtml).toContain('data-page="era-c-2"')
    expect(bigHtml).toContain('data-page="abrangencia-segmento"')
    expect(bigHtml).toContain('data-page="abrangencia-segmento-2"')
    expect(bigHtml).toContain('data-page="noticias"')
    expect(bigHtml).toContain('data-page="noticias-2"')
    expect(bigHtml).toContain('continuação')
    const anchors = [...bigHtml.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(anchors).size, 'every sheet anchor must be unique').toBe(anchors.length)
    expect(anchors.length).toBe(bigReport.meta.pageTotal)
  })

  it('ports the theme vocabulary and identity badges', () => {
    expect(html).toContain('Dossiê temático')
    expect(html).toContain('identity-badge')
    expect(html).toContain('scope-sector')
    expect(html).toContain('scope-network')
    expect(html).toContain('phase-paid')
    expect(html).toContain('phase-pending')
    expect(html).toContain('Segmento/rede não é a área')
    expect(html).toContain('Segmento e rede não são somados à área')
  })

  it('prints the defeso note', () => {
    expect(html).toContain('Nota de defeso eleitoral 2026')
  })

  it('escapes untrusted research text', () => {
    const hostile = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [
          normalizeDossierResearchInput(
            eraFile('C', [item('era_c_emendas', 'C', { answer: '<script>alert(1)</script>' })]),
            { unit: THEME_UNIT },
          ),
        ],
        { unit: THEME_UNIT },
      ),
      generatedAt,
      unit: THEME_UNIT,
    })
    const hostileHtml = renderDossierHtml(hostile)
    expect(hostileHtml).not.toContain('<script>alert(1)</script>')
    expect(hostileHtml).toContain('&lt;script&gt;')
  })

  it('mirrors the theme sections in markdown', () => {
    expect(md).toContain('# Dossiê Solla por tema/área — Educação')
    expect(md).toContain('## Abrangência: área × segmento × rede')
    expect(md).toContain('## Lacunas explícitas')
    expect(md).toContain('[fonte](https://educacao.test/era_a_formacao)')
  })
})

describe('buildBulletin (theme unit)', () => {
  const identity = {
    name: report.meta.subjectName,
    badges: report.meta.identityBadges,
    value: report.meta.identity?.value ?? null,
    taxonomyNote: report.meta.identity?.taxonomyNote ?? null,
  }
  const bulletin = buildBulletin({
    facts: report.bulletinFacts,
    identity,
    unit: THEME_UNIT,
    generatedAt,
  })
  const html = renderBulletinHtml(bulletin)

  it('is a single A4 page with the model label and identity pills', () => {
    expect(html).toContain('data-page="boletim"')
    expect((html.match(/data-page="boletim"/g) ?? []).length).toBe(1)
    expect(html).toContain('aria-label="Modelo de boletim informativo temático de uma página"')
    expect(html).toContain('Modelo — insumo interno')
    expect(html).toContain('identity-pill')
    expect(html).toContain('Educação')
    expect(html).toContain('O que Jorge Solla fez pela <span class="accent">Educação</span>')
  })

  it('renders the theme pills with the canonical token in mono and the taxonomy note', () => {
    expect(html).toContain('<span class="identity-pill">Área</span>')
    expect(html).toContain('<span class="identity-pill identity-pill--code">educacao</span>')
    expect(html).toContain('<span class="identity-pill">Taxonomia do acervo</span>')
    expect(html).toContain('.identity-pill--code')
  })

  it('falls back to the year and then to a textual card (never a fake zero)', () => {
    const fact = (id: string, overrides: Record<string, unknown> = {}) => ({
      id,
      era: 'C',
      sphere: 'area',
      area: 'Educação',
      headline: `Fato ${id}`,
      detail: null,
      value: null,
      brief: null,
      year: null,
      phase: null,
      sourceUrl: `https://educacao.test/${id}`,
      sourceDate: '2024-06-01',
      ...overrides,
    })
    const fallback = buildBulletin({
      facts: [fact('a-ano', { year: '2019' }), fact('b-texto')],
      identity,
      unit: THEME_UNIT,
      generatedAt,
    })
    const fallbackHtml = renderBulletinHtml(fallback)
    expect(fallback.highlights[0]).toMatchObject({ number: '2019' })
    expect(fallback.highlights[1]).toMatchObject({ number: null, textual: true })
    expect(fallbackHtml).toContain('highlight-card--textual')
  })

  it('declares no sources and carries the defeso band', () => {
    expect(html).not.toContain('source-link')
    expect(html).not.toContain('Fonte:')
    expect(html).toContain('defeso-band')
    expect(html).toContain('sem CTA')
    expect(html).toContain('área, segmento e rede não são somados')
  })

  it('keeps the phase next to a valued number (empenho ≠ pagamento)', () => {
    expect(html).toContain('highlight-phase')
    expect(html).toContain('phase-pending')
    expect(html).toContain('empenhado')
    expect(html).toContain('phase-paid')
    expect(html).toContain('pago')
  })

  it('renders the sparse variant when there are fewer than three facts', () => {
    const sparse = buildBulletin({
      facts: [report.bulletinFacts[0]],
      identity,
      unit: THEME_UNIT,
      generatedAt,
    })
    const sparseHtml = renderBulletinHtml(sparse)
    expect(sparse.sparse).toBe(true)
    expect(sparseHtml).toContain('lacuna-panel')
    expect(sparseHtml).toContain('A página termina com espaço')
    expect(sparseHtml).toContain('entrega exclusiva da área')
  })
})
