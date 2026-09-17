import { describe, expect, it } from 'vitest'

import { buildCityReport } from '../../scripts/lib/cityReportBlocks.mjs'
import { renderReportHtml, renderReportMd } from '../../scripts/lib/cityReportRender.mjs'
import {
  normalizeResearchInput,
  RESEARCH_CHECKLIST_IDS,
} from '../../scripts/lib/cityReportResearch.mjs'

const generatedAt = new Date('2026-09-15T12:00:00.000Z')

const research = normalizeResearchInput(
  {
    municipalitySlug: 'feira-de-santana',
    researchedAt: '2026-09-14T10:00:00.000Z',
    items: RESEARCH_CHECKLIST_IDS.map((id) => ({
      id,
      answer: id === 'prefeito' ? 'Prefeito <script>alert(1)</script>' : `Resposta de ${id}`,
      sourceUrl: `https://exemplo.test/${id}`,
      sourceDate: '2026-09-10',
    })),
    news: [],
    emendasIndicators: [
      {
        author: 'Zé Neto',
        sphere: 'municipio',
        value: 'R$ 1 mi',
        purpose: 'Ambulância do TFD',
        sourceUrl: 'https://exemplo.test/indicio-municipio',
        sourceDate: '2026-09-01',
      },
      {
        author: 'Deputado do Polo',
        sphere: 'polo',
        value: 'R$ 500 mil',
        sourceUrl: 'https://exemplo.test/indicio-polo',
        sourceDate: '2026-09-01',
      },
    ],
    gaps: [],
  },
  { now: generatedAt },
)

const report = buildCityReport({
  snapshot: {
    meta: {
      readAt: '2026-09-15T10:30:00.000Z',
      database: '127.0.0.1:5433/teqo_1313',
      codeSha: 'abc1234',
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
      lastUpdateAt: null,
    },
    electoral: {
      candidateName: 'Jorge Solla',
      candidateParty: 'PT',
      series: [],
      tally2022: null,
      ticket2022: { president: null, governor: null },
      rank2022: null,
    },
    goal: null,
    pledges: {
      declaredTotal: 0,
      effectiveByScenario: {},
      pledgeCount: 0,
      missingEstimateCount: 0,
      lastPledgeAt: null,
    },
    leaderships: { totalCount: 0, rows: [] },
    advisors: [],
    signals: { totalCount: 0, rows: [] },
    activities: { upcoming: [], recent: [] },
    conjuncture: null,
    speeches: { totalCount: 0, rows: [] },
    demands: { totalCount: 0, rows: [] },
    demographics: null,
  },
  research,
  emendas: {
    status: 'gap',
    reason: 'Chave ausente',
    detail: null,
    sourceUrl: null,
    consultedAt: null,
  },
  generatedAt,
})

describe('renderReportHtml', () => {
  const html = renderReportHtml(report)

  it('renders the summary page anchor and both headers', () => {
    expect(html).toContain('data-page="summary"')
    expect(html).toContain('pág. 1')
    expect(html).toContain('Índice')
  })

  it('escapes research text (no raw injection)', () => {
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('turns every URL into a clickable anchor', () => {
    expect(html).toContain(
      '<a href="https://exemplo.test/prefeito">https://exemplo.test/prefeito</a>',
    )
    expect(html).toContain('href="https://exemplo.test/emendas_web"')
  })

  it('prints the gaps as callouts and the limits list', () => {
    expect(html).toContain('Lacuna explícita')
    expect(html).toContain('Limites')
  })

  it('renders the emenda indications with the esfera badge and per-row source link', () => {
    expect(html).toContain('<ul class="indicators">')
    expect(html).toContain('sphere sphere-municipio')
    expect(html).toContain('sphere sphere-polo')
    expect(html).toContain('href="https://exemplo.test/indicio-municipio"')
    expect(html).toContain('Não somar região/polo')
  })

  it('renders the announce panel without the fixed "O que NÃO anunciar" copy', () => {
    expect(html).toContain('<div class="panel decision">')
    expect(html).toContain('O que anunciar agora')
    expect(html).not.toContain('O que NÃO anunciar')
  })
})

describe('renderReportMd', () => {
  const md = renderReportMd(report)

  it('carries the same sections as tables and headings', () => {
    expect(md).toContain('## 1. Conta eleitoral completa')
    expect(md).toContain('## 2. Concorrentes no município (federal e estadual)')
    expect(md).not.toContain('## 5. Sinais recentes')
    expect(md).not.toContain('Demandas e visitas')
    expect(md).toContain('## 6. Atividade econômica (pesquisa)')
    expect(md).toContain('## 7. Transporte e conexões (pesquisa)')
    expect(md).toContain('## 11. Abordagem sugerida (pesquisa)')
    expect(md).toContain('## 12. Fontes e limites')
    expect(md).toContain('| Ano | Votos |')
  })

  it('lists sources with URLs', () => {
    expect(md).toContain('https://exemplo.test/prefeito')
    expect(md).toContain('base Teqo')
  })

  it('states the base read date (dated snapshot)', () => {
    expect(md).toContain('Base Teqo (read-only) lida em')
  })

  it('renders the emenda indications in the companion with the (fonte) link', () => {
    expect(md).toContain('**Zé Neto** — Ambulância do TFD · R$ 1 mi · _município_')
    expect(md).toContain('[(fonte)](https://exemplo.test/indicio-municipio)')
    expect(md).not.toContain('O que NÃO anunciar')
  })
})
