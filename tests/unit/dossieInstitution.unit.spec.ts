import { describe, expect, it } from 'vitest'

import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import { buildBulletin } from '../../scripts/lib/dossieBulletin.mjs'
import { renderBulletinHtml } from '../../scripts/lib/dossieBulletinRender.mjs'
import { renderDossierHtml, renderDossierMd } from '../../scripts/lib/dossieRender.mjs'
import {
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { INSTITUTION_UNIT } from '../../scripts/lib/dossieUnit.mjs'

// C187: institution content model + render. Grounds the institutional recorte:
// identity badges, `instituicao|setor|rede` never summed, per-row phase/source,
// empty-era state instead of silent omission, and a one-page boletim that
// inherits only sourced facts.

const generatedAt = new Date('2026-09-17T12:00:00.000Z')

const snapshot = {
  meta: { readAt: '2026-09-17T11:00:00.000Z' },
  institution: {
    slug: 'ufba',
    name: 'UFBA',
    kind: 'universidade',
    kindLabel: 'Universidade',
    sphere: 'federal',
    sphereLabel: 'Federal',
    scope: 'BA',
    scopeLabel: 'Abrangência BA',
    aliases: ['Universidade Federal da Bahia'],
    topics: ['educacao', 'ciencia-tecnologia'],
  },
  speeches: {
    topics: ['ciencia-tecnologia'],
    totalCount: 1,
    rows: [
      {
        id: 11,
        speechAt: '2024-05-10T00:00:00.000Z',
        summary: 'Defesa do financiamento das universidades federais.',
        officialTextUrl: 'https://camara.test/discurso-ufba',
        mentionExcerpt: 'a UFBA e as demais universidades federais',
      },
    ],
  },
}

const item = (id: string, _era: 'A' | 'B' | 'C', overrides: Record<string, unknown> = {}) => ({
  id,
  answer: `Ação ${id} documentada`,
  sphere: 'instituicao',
  sourceUrl: `https://ufba.test/${id}`,
  sourceDate: '2024-06-01',
  ...overrides,
})

const eraFile = (era: 'A' | 'B' | 'C', items: unknown[]) => ({
  institutionSlug: 'ufba',
  era,
  researchedAt: '2026-09-17T10:00:00.000Z',
  items,
  news: [
    {
      title: 'Notícia institucional',
      outlet: 'UFBA',
      publishedAt: '2024-05-01',
      url: 'https://ufba.test/noticia',
    },
  ],
})

const research = mergeDossierResearch(
  [
    normalizeDossierResearchInput(
      eraFile('A', [
        item('era_a_formacao', 'A'),
        item('era_a_vinculo', 'A', { sphere: 'setor' }),
        item('era_a_sesab', 'A', { sphere: 'rede' }),
      ]),
      { unit: INSTITUTION_UNIT },
    ),
    normalizeDossierResearchInput(
      eraFile('B', [
        item('era_b_sesab', 'B', {
          numbers: [{ label: 'Investimento', value: 'R$ 2,0 mi', year: '2012', phase: 'pago' }],
        }),
      ]),
      { unit: INSTITUTION_UNIT },
    ),
    normalizeDossierResearchInput(
      eraFile('C', [
        item('era_c_emendas', 'C', {
          numbers: [{ label: 'Emenda', value: 'R$ 5,0 mi', year: '2024', phase: 'empenhado' }],
        }),
        item('era_c_titulos', 'C', { answer: 'Título de cidadão honorário' }),
      ]),
      { unit: INSTITUTION_UNIT },
    ),
  ],
  { unit: INSTITUTION_UNIT },
)

const report = buildDossierReport({
  snapshot,
  research,
  generatedAt,
  unit: INSTITUTION_UNIT,
})

describe('institution era without evidence', () => {
  const emptyReport = buildDossierReport({
    snapshot,
    research: mergeDossierResearch(
      (['A', 'B', 'C'] as const).map((era) =>
        normalizeDossierResearchInput(eraFile(era, []), { unit: INSTITUTION_UNIT }),
      ),
      { unit: INSTITUTION_UNIT },
    ),
    generatedAt,
    unit: INSTITUTION_UNIT,
  })

  it('marks an evidence-less era as an explicit gap, never a silent blank', () => {
    expect(emptyReport.eras.every((era) => era.empty)).toBe(true)
    const html = renderDossierHtml(emptyReport)
    expect(html).toContain('Lacuna explícita · não é “zero”')
    expect(html).toContain('Nenhuma fonte suficiente foi localizada para esta era.')
    expect(html).toContain('empty-panel')
  })
})

describe('buildDossierReport (institution unit)', () => {
  it('carries the institution identity and badges', () => {
    expect(report.unit.id).toBe('institution')
    expect(report.meta.subjectName).toBe('UFBA')
    expect(report.meta.identityBadges).toEqual(['Universidade', 'Federal', 'Abrangência BA'])
  })

  it('keeps all three eras, marking evidence-less ones as explicit gaps', () => {
    expect(report.eras.map((era) => era.id)).toEqual(['A', 'B', 'C'])
    expect(report.eras.every((era) => typeof era.empty === 'boolean')).toBe(true)
  })

  it('never sums setor/rede into the instituicao list', () => {
    const listFor = (key: string) => report.reach.lists.find((list) => list.key === key)
    expect(listFor('institution')?.items.every((row) => row.sphere === 'instituicao')).toBe(true)
    expect(listFor('institution')?.items.some((row) => row.id === 'era_a_vinculo')).toBe(false)
    expect(listFor('sector')?.total).toBe(1)
    expect(listFor('network')?.total).toBe(1)
  })

  it('declares overflow instead of truncating silently (C188 rule)', () => {
    for (const list of report.reach.lists) {
      expect(list).toMatchObject({ total: expect.any(Number), omitted: expect.any(Number) })
    }
    expect(report.page1.deliveries.omitted).toBeGreaterThanOrEqual(0)
  })

  it('prints "e mais N" with the right singular when a list is capped', () => {
    const manyItems = [
      item('era_c_emendas', 'C', { sphere: 'setor' }),
      item('era_c_atuacao', 'C', { sphere: 'setor' }),
      item('era_c_discursos', 'C', { sphere: 'setor' }),
      item('era_c_proposicoes', 'C', { sphere: 'setor' }),
      item('era_c_titulos', 'C', { sphere: 'setor' }),
      item('era_c_parcerias', 'C', { sphere: 'setor' }),
    ]
    const cappedReport = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [normalizeDossierResearchInput(eraFile('C', manyItems), { unit: INSTITUTION_UNIT })],
        { unit: INSTITUTION_UNIT },
      ),
      generatedAt,
      unit: INSTITUTION_UNIT,
    })
    const list = cappedReport.reach.lists.find((row) => row.key === 'sector')
    expect(list?.omitted).toBeGreaterThan(0)
    const html = renderDossierHtml(cappedReport)
    expect(html).toContain(`${list?.omitted} item`)
    expect(html, 'the plural noun must not be chopped into "iten"').not.toContain('iten ')
  })

  it('derives bulletinFacts only from sourced items', () => {
    expect(report.bulletinFacts.length).toBeGreaterThan(0)
    expect(report.bulletinFacts.every((fact) => Boolean(fact.sourceUrl))).toBe(true)
  })

  it('consumes the read-only acervo rows as sourced evidence (never silent)', () => {
    expect(report.acervo.items.length).toBe(1)
    expect(report.acervo.items[0]).toMatchObject({ period: '2024', sourceUrl: expect.any(String) })
    expect(report.bulletinFacts.some((fact) => fact.id === 'fala-11')).toBe(true)
    expect(renderDossierMd(report)).toContain('## Acervo interno (read-only)')
  })
})

describe('renderDossierHtml/Md (institution unit)', () => {
  const html = renderDossierHtml(report)
  const md = renderDossierMd(report)

  it('anchors every institution page', () => {
    for (const anchor of [
      'capa',
      'resumo',
      'era-a',
      'era-b',
      'era-c',
      'abrangencia',
      'lacunas',
      'fontes',
    ]) {
      expect(html).toContain(`data-page="${anchor}"`)
    }
  })

  it('ports the institutional classes and identity badges', () => {
    expect(html).toContain('identity-badge')
    expect(html).toContain('scope-sector')
    expect(html).toContain('scope-network')
    expect(html).toContain('phase-paid')
    expect(html).toContain('phase-pending')
  })

  it('prints the non-summable rule and the defeso note', () => {
    expect(html).toContain('Setor/rede não é a instituição')
    expect(html).toContain('Nota de defeso eleitoral 2026')
  })

  it('renders the honors scene with date, nature and the reading panels', () => {
    expect(html).toContain('Data, natureza e fonte primária')
    expect(html).toContain('Como ler')
    expect(html).toContain('Vínculo documentado')
    expect(html).toContain('Honraria documentada')
  })

  it('escapes untrusted research text', () => {
    const hostile = buildDossierReport({
      snapshot,
      research: mergeDossierResearch(
        [
          normalizeDossierResearchInput(
            eraFile('C', [item('era_c_emendas', 'C', { answer: '<script>alert(1)</script>' })]),
            { unit: INSTITUTION_UNIT },
          ),
        ],
        { unit: INSTITUTION_UNIT },
      ),
      generatedAt,
      unit: INSTITUTION_UNIT,
    })
    const hostileHtml = renderDossierHtml(hostile)
    expect(hostileHtml).not.toContain('<script>alert(1)</script>')
    expect(hostileHtml).toContain('&lt;script&gt;')
  })

  it('mirrors the institution sections in markdown', () => {
    expect(md).toContain('# Dossiê Solla por instituição — UFBA')
    expect(md).toContain('## Abrangência: instituição × setor × rede')
    expect(md).toContain('## Lacunas explícitas')
    expect(md).toContain('[fonte](https://ufba.test/era_a_formacao)')
  })
})

describe('buildBulletin (institution unit)', () => {
  const bulletin = buildBulletin({
    facts: report.bulletinFacts,
    identity: {
      name: report.meta.subjectName,
      badges: report.meta.identityBadges,
    },
    unit: INSTITUTION_UNIT,
    generatedAt,
  })
  const html = renderBulletinHtml(bulletin)

  it('is a single A4 page with the model label and identity pills', () => {
    expect(html).toContain('data-page="boletim"')
    expect((html.match(/data-page="boletim"/g) ?? []).length).toBe(1)
    expect(html).toContain('Modelo — insumo interno')
    expect(html).toContain('identity-pill')
    expect(html).toContain('UFBA')
  })

  it('declares no sources and carries the defeso band', () => {
    expect(html).not.toContain('source-link')
    expect(html).not.toContain('Fonte:')
    expect(html).toContain('defeso-band')
    expect(html).toContain('sem CTA')
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
      identity: { name: 'UFBA', badges: ['Universidade'] },
      unit: INSTITUTION_UNIT,
      generatedAt,
    })
    const sparseHtml = renderBulletinHtml(sparse)
    expect(sparse.sparse).toBe(true)
    expect(sparseHtml).toContain('lacuna-panel')
    expect(sparseHtml).toContain('A página termina com espaço')
  })
})
