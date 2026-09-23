import { describe, expect, it } from 'vitest'

import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import { buildBulletin } from '../../scripts/lib/dossieBulletin.mjs'
import { renderBulletinHtml } from '../../scripts/lib/dossieBulletinRender.mjs'
import { renderDossierHtml, renderDossierMd } from '../../scripts/lib/dossieRender.mjs'
import {
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'

const generatedAt = new Date('2026-09-17T12:00:00.000Z')
const snapshot = {
  meta: { readAt: '2026-09-16T10:00:00.000Z', codeSha: 'abc1234', database: 'teqo_test' },
  municipality: { slug: 'ilheus', name: 'Ilhéus', region: 'Litoral Sul', ibgeCode: '2913606' },
  speeches: {
    topics: { themes: ['saude'] },
    totalCount: 1,
    rows: [
      {
        id: 31,
        speechAt: '2024-05-10T00:00:00.000Z',
        summary: 'Pronunciamento sobre saúde regional.',
        officialTextUrl: 'https://camara.test/discurso-ilheus',
        mentionExcerpt: 'a saúde da região',
      },
    ],
  },
}

const research = mergeDossierResearch([
  normalizeDossierResearchInput({
    municipalitySlug: 'ilheus',
    era: 'A',
    researchedAt: '2026-09-16T10:00:00.000Z',
    items: [
      {
        id: 'era_a_conquista',
        answer: 'Gestão da saúde em Vitória da Conquista',
        details: 'Detalhe <script>alert(1)</script> com {{fonte}}.',
        sourceUrl: 'https://exemplo.test/conquista',
        sourceDate: '2026-09-10',
      },
    ],
    news: [],
    gaps: [],
  }),
  normalizeDossierResearchInput({
    municipalitySlug: 'ilheus',
    era: 'B',
    researchedAt: '2026-09-16T10:00:00.000Z',
    items: [
      {
        id: 'era_b_equipamentos',
        answer: '1 hospital regional',
        sphere: 'polo',
        sourceUrl: 'https://saude.test/hospital',
        sourceDate: '2026-09-10',
      },
    ],
    news: [],
    gaps: [],
  }),
  normalizeDossierResearchInput({
    municipalitySlug: 'ilheus',
    era: 'C',
    researchedAt: '2026-09-16T10:00:00.000Z',
    items: [
      {
        id: 'era_c_emendas',
        answer: 'R$ 1,2 milhão para equipamentos',
        numbers: [{ label: 'Saúde', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' }],
        sourceUrl: 'https://portaldatransparencia.test/emendas',
        sourceDate: '2026-09-15',
      },
      {
        id: 'era_c_titulos',
        answer: 'Título de cidadão honorário',
        sourceUrl: 'https://camara.test/titulo',
        sourceDate: '2026-09-10',
      },
      {
        id: 'era_c_defesas',
        position: 'Ensino superior',
        answer: 'Defende campus da UFBA na região',
        details: 'INC 1497/2023',
        sourceUrl: 'https://camara.test/inc-1497',
        sourceDate: '2023-09-22',
      },
    ],
    news: [
      {
        title: 'Matéria local',
        url: 'https://jornal.test/materia',
        publishedAt: '2024-06-01',
        outlet: 'Jornal Local',
        summary: 'Resumo datado da matéria.',
      },
    ],
    gaps: [],
  }),
])

const report = buildDossierReport({
  snapshot,
  research,
  emendas: { status: 'gap', rows: [], reason: 'sem chave' },
  camara: { status: 'gap', items: [] },
  health: { status: 'gap', items: [] },
  generatedAt,
})

describe('renderDossierHtml', () => {
  const html = renderDossierHtml(report)

  it('anchors every sheet for the overflow guard and navigability', () => {
    for (const anchor of [
      'capa',
      'resumo',
      'sintese',
      'trajetoria',
      'era-a',
      'era-b',
      'era-c',
      'regiao',
      'defende',
      'lacunas',
      'noticias',
      'acervo',
      'fontes',
    ]) {
      expect(html).toContain(`data-page="${anchor}"`)
    }
  })

  it('opens the document with O essencial, the facts and the index with page numbers', () => {
    expect(html).toContain('O essencial')
    expect(html).toContain('Fatos-chave')
    expect(html).toContain('index-list')
    expect(html).toContain('index-page')
    expect(html).toContain('<span class="index-page tabular">2</span>')
  })

  it('reads the eras between themselves and prints the operational synthesis', () => {
    expect(html).toContain('Leitura entre eras')
    expect(html).toContain('Síntese operacional')
    expect(html).toContain('Concentração.')
  })

  it('prints the position list of O que Solla defende and the missing-register line', () => {
    expect(html).toContain('O que Solla defende')
    expect(html).toContain('position-list')
    expect(html).toContain('Ensino superior')
    expect(html).toContain('Sem registro localizado.')
  })

  it('is a sober document: no charts, cards, colored badges or image placeholders', () => {
    expect(html).not.toContain('chart-grid')
    expect(html).not.toContain('action-grid')
    expect(html).not.toContain('scope-cards')
    expect(html).not.toContain('asset-box')
    expect(html).not.toContain('NEEDS ASSET')
    expect(html).not.toContain('data-page="graficos"')
  })

  it('escapes untrusted research text', () => {
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('strips the inline {{fonte}} token — the row link carries the source', () => {
    expect(html).not.toContain('{{fonte}}')
    expect(html).not.toContain('class="inline-source"')
    expect(html).toContain('https://exemplo.test/conquista')
  })

  it('keeps the non-summable rule and the defeso note', () => {
    expect(html).toContain('Não somar.')
    expect(html).toContain('Nota de defeso eleitoral 2026')
  })

  it('renders the local honors once on the era-C sheet', () => {
    const eraC = html.slice(html.indexOf('data-page="era-c"'), html.indexOf('data-page="regiao"'))
    expect((eraC.match(/Título de cidadão honorário/g) ?? []).length).toBe(1)
  })

  it('prints the news with the summary and the era usage column', () => {
    expect(html).toContain('Resumo datado da matéria.')
    expect(html).toContain('Uso no dossiê')
    expect(html).toContain('Era C')
  })
})

describe('renderDossierHtml — reformulated brief (no ellipsis)', () => {
  const briefedResearch = mergeDossierResearch([
    normalizeDossierResearchInput({
      municipalitySlug: 'ilheus',
      era: 'C',
      researchedAt: '2026-09-16T10:00:00.000Z',
      items: [
        {
          id: 'era_c_emendas',
          answer: 'Resposta integral bem longa que não deve aparecer no cartão impresso do dossiê',
          details: 'Detalhe integral que também não deve aparecer no cartão impresso.',
          brief: { title: 'Manchete reformulada para caber', note: 'Nota reformulada curta.' },
          numbers: [{ label: 'Saúde', value: 'R$ 1,2 mi', year: '2024', phase: 'empenhado' }],
          sourceUrl: 'https://portaldatransparencia.test/brief',
          sourceDate: '2026-09-15',
        },
      ],
      news: Array.from({ length: 12 }, (_value, index) => ({
        title: `Notícia ${index}`,
        url: `https://jornal.test/${index}`,
        publishedAt: '2024-06-01',
        outlet: 'Jornal Local',
      })),
      gaps: [],
    }),
  ])
  const briefReport = buildDossierReport({ snapshot, research: briefedResearch, generatedAt })
  const html = renderDossierHtml(briefReport)
  const md = renderDossierMd(briefReport)

  it('prints the short brief instead of the full record', () => {
    expect(html).toContain('Manchete reformulada para caber')
    expect(html).toContain('Nota reformulada curta.')
    expect(html).not.toContain('Resposta integral bem longa')
  })

  it('never truncates with an ellipsis', () => {
    expect(html).not.toContain('…')
  })

  it('keeps the full record in the .md companion', () => {
    expect(md).toContain('Resposta integral bem longa')
  })

  it('paginates long news lists into continuation sheets', () => {
    const packed = renderDossierHtml(briefReport, { pack: { news: [1] } })
    expect(packed).toContain('data-page="noticias"')
    expect(packed).toContain('data-page="noticias-2"')
  })
})

describe('renderDossierHtml — era continuation sheets', () => {
  const manyActions = mergeDossierResearch([
    normalizeDossierResearchInput({
      municipalitySlug: 'ilheus',
      era: 'C',
      researchedAt: '2026-09-16T10:00:00.000Z',
      items: ['discursos', 'proposicoes', 'emendas', 'titulos', 'atuacao'].map((suffix, index) => ({
        id: `era_c_${suffix}`,
        answer: `Ação ${index}`,
        brief: { title: `Ação curta ${index}`, note: `Nota ${index}` },
        sourceUrl: `https://exemplo.test/acao-${index}`,
        sourceDate: '2026-09-10',
      })),
      news: [],
      gaps: [],
    }),
  ])
  const report = buildDossierReport({ snapshot, research: manyActions, generatedAt })
  const html = renderDossierHtml(report, { pack: { 'era:C': [1] } })

  it('paginates era list items into continuation sheets instead of dropping them', () => {
    expect(html).toContain('data-page="era-c"')
    expect(html).toContain('data-page="era-c-2"')
    for (let index = 0; index < 5; index += 1) {
      expect(html).toContain(`Ação curta ${index}`)
    }
  })
})

describe('renderDossierHtml — index fallback', () => {
  it('drops the page numbers when the resumo sheet overflows (indexMode labels)', () => {
    const html = renderDossierHtml(report, { indexMode: 'labels' })
    expect(html).toContain('index-list')
    expect(html).not.toContain('<span class="index-page tabular">2</span>')
    expect(html).toContain('<span class="index-page tabular">—</span>')
  })

  it('keeps an omitted era in the index without a number or a page', () => {
    const withoutEraA = mergeDossierResearch([
      normalizeDossierResearchInput({
        municipalitySlug: 'ilheus',
        era: 'A',
        researchedAt: '2026-09-16T10:00:00.000Z',
        items: [],
        news: [],
        gaps: [],
      }),
      normalizeDossierResearchInput({
        municipalitySlug: 'ilheus',
        era: 'B',
        researchedAt: '2026-09-16T10:00:00.000Z',
        items: [
          {
            id: 'era_b_equipamentos',
            answer: '1 hospital regional',
            sourceUrl: 'https://saude.test/hospital',
            sourceDate: '2026-09-10',
          },
        ],
        news: [],
        gaps: [],
      }),
    ])
    const omittedReport = buildDossierReport({ snapshot, research: withoutEraA, generatedAt })
    const omittedHtml = renderDossierHtml(omittedReport)
    expect(omittedHtml).toContain('sem evidência nominal suficiente; consulte as lacunas')
    expect(omittedHtml).not.toContain('data-page="era-a"')
    const index = omittedHtml.slice(omittedHtml.indexOf('index-list'), omittedHtml.indexOf('</ol>'))
    expect(index).toContain('<span class="index-number"></span>')
  })
})

describe('renderDossierMd', () => {
  const md = renderDossierMd(report)

  it('mirrors the sections and keeps the sources clickable', () => {
    expect(md).toContain('# Dossiê Solla por cidade — Ilhéus')
    expect(md).toContain('## Índice')
    expect(md).toContain('## O essencial')
    expect(md).toContain('## Leitura entre eras')
    expect(md).toContain('## Trajetória completa')
    expect(md).toContain('## O que Solla defende')
    expect(md).toContain('## Região / polo')
    expect(md).toContain('## Lacunas explícitas')
    expect(md).toContain('[fonte](https://exemplo.test/conquista)')
  })

  it('carries the defeso note', () => {
    expect(md).toContain('defeso eleitoral')
  })

  it('links every index entry to an anchor that exists in the companion', () => {
    const links = [...md.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1])
    expect(links.length).toBeGreaterThan(0)
    for (const anchor of links) expect(md).toContain(`<a id="${anchor}"></a>`)
  })
})

describe('renderBulletinHtml', () => {
  const bulletin = buildBulletin({
    facts: report.bulletinFacts,
    municipality: snapshot.municipality.name,
    region: snapshot.municipality.region,
    generatedAt,
  })
  const html = renderBulletinHtml(bulletin)

  it('is a single A4 page with the model label', () => {
    expect(html).toContain('data-page="boletim"')
    expect(html).toContain('Modelo — insumo interno')
    expect((html.match(/data-page="boletim"/g) ?? []).length).toBe(1)
  })

  it('declares no sources (they live in the dossiê)', () => {
    expect(html).not.toContain('source-link')
    expect(html).not.toContain('Fonte:')
    expect(html).not.toContain('portaldatransparencia.test')
  })

  it('prints the highlights as a list and the four-period trajectory', () => {
    expect(html).toContain('bulletin-list')
    expect(html).toContain('period-list')
    expect(html).toContain('Defeso eleitoral')
  })

  it('prints the defense block from the ledger', () => {
    expect(html).toContain('bulletin-defense-list')
    expect(html).toContain('Defende campus da UFBA na região')
  })
})
