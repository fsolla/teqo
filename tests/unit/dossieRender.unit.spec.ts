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
    ],
    news: [
      {
        title: 'Matéria local',
        url: 'https://jornal.test/materia',
        publishedAt: '2024-06-01',
        outlet: 'Jornal Local',
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

  it('anchors every page for the overflow guard and navigability', () => {
    for (const anchor of [
      'capa',
      'trajetoria',
      'resumo',
      'era-a',
      'era-b',
      'era-c',
      'regiao',
      'lacunas',
      'fontes',
    ]) {
      expect(html).toContain(`data-page="${anchor}"`)
    }
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

  it('keeps the region rule and the region/polo badge', () => {
    expect(html).toContain('Região não é cidade')
    expect(html).toContain('scope-region')
  })

  it('prints the defeso note', () => {
    expect(html).toContain('Nota de defeso eleitoral 2026')
  })
})

describe('renderDossierMd', () => {
  const md = renderDossierMd(report)

  it('mirrors the sections and keeps the sources clickable', () => {
    expect(md).toContain('# Dossiê Solla por cidade — Ilhéus')
    expect(md).toContain('## Linha do tempo da carreira')
    expect(md).toContain('## Região / polo')
    expect(md).toContain('## Lacunas explícitas')
    expect(md).toContain('[fonte](https://exemplo.test/conquista)')
  })

  it('carries the defeso note', () => {
    expect(md).toContain('defeso eleitoral')
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

  it('prints the trajectory and the defeso note', () => {
    expect(html).toContain('Desde 1999')
    expect(html).toContain('Defeso eleitoral')
  })
})
