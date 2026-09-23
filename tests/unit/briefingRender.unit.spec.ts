import { describe, expect, it } from 'vitest'

import { normalizeBriefingContent, trimBriefing } from '../../scripts/lib/briefingContent.mjs'
import { renderBriefingHtml, renderBriefingMd } from '../../scripts/lib/briefingRender.mjs'
import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import {
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { MUNICIPALITY_UNIT } from '../../scripts/lib/dossieUnit.mjs'

// C210 (replanejado 2026-09-23): the briefing is the approved gate design ported
// to inline print CSS — four fixed recorte sheets (defesas → essencial + pedido
// → qa 1/2 → qa 2/2), the internal label on each and the request literal. The
// tests pin the anchors the page guard reads, the guards that cannot regress
// (literal label, "vote 1313", source per anchor) and the `.md` superset.

const generatedAt = new Date('2026-09-22T12:00:00.000Z')
const snapshot = {
  meta: { readAt: '2026-09-16T10:00:00.000Z', database: 'teqo_test' },
  municipality: { slug: 'ilheus', name: 'Ilhéus', region: 'Litoral Sul', ibgeCode: '2913606' },
}

const research = mergeDossierResearch([
  normalizeDossierResearchInput({
    municipalitySlug: 'ilheus',
    era: 'B',
    researchedAt: '2026-09-16T10:00:00.000Z',
    items: [
      {
        id: 'era_b_equipamentos',
        answer: 'Ambulância e atenção domiciliar no município',
        sourceUrl: 'https://saude.test/ambulancia',
        sourceDate: '2012-01-25',
      },
      {
        id: 'era_b_programas',
        answer: 'Saúde em Movimento com menção direta <script>alert(1)</script>',
        sourceUrl: 'https://saude.test/programas',
        sourceDate: '2013-05-10',
      },
    ],
    news: [],
    gaps: [],
  }),
])

const report = buildDossierReport({ snapshot, research, generatedAt })
const facts = report.bulletinFacts

const rawContent = (qaCount = 5) => ({
  unitId: 'municipality',
  municipalitySlug: 'ilheus',
  generatedAt: generatedAt.toISOString(),
  subtitle: 'Litoral Sul · consulta antes e durante o contato',
  lede: 'Universidade pública não é gasto: é projeto de país.',
  defenses: [
    { factId: 'era_b_programas', title: 'Ensino superior', note: 'Defesa regional.' },
    { factId: 'era_b_equipamentos', title: 'Saúde perto de casa', note: 'Defesa local.' },
  ],
  essential: [
    {
      factId: 'era_b_equipamentos',
      title: 'Ambulância <script>alert(1)</script>',
      note: 'Registro local de 2012.',
    },
    { factId: 'era_b_programas', title: 'Saúde em Movimento', note: 'Menção direta.' },
    { gapReason: 'sem fala própria localizada', title: 'Sem fala local', note: 'Anote a lacuna.' },
  ],
  plan: 'Combine onde, quando e como votar e registre o compromisso nomeado.',
  qa: Array.from({ length: qaCount }, (_value, index) => ({
    side: index % 2 === 0 ? 'direita' : 'esquerda',
    question: `Pergunta ${index}`,
    acknowledge: 'Entendo a preocupação.',
    answer: 'Há registro nominal no recorte.',
    close: 'Posso contar com o 1313?',
    factId: 'era_b_equipamentos',
  })),
})

const content = normalizeBriefingContent(rawContent(), {
  unit: MUNICIPALITY_UNIT,
  slug: 'ilheus',
  facts,
})

describe('renderBriefingHtml', () => {
  const html = renderBriefingHtml(content, { unit: MUNICIPALITY_UNIT, report })

  it('renders exactly the four fixed recorte sheets the page guard counts', () => {
    for (const anchor of ['defesas', 'essencial', 'qa', 'qa-2']) {
      expect(html).toContain(`data-page="${anchor}"`)
    }
    expect((html.match(/class="sheet/g) ?? []).length).toBe(4)
  })

  it('prints the internal label on every sheet and the page count', () => {
    expect((html.match(/Insumo interno de capacitação — não publicar/g) ?? []).length).toBe(4)
    for (const page of ['folha 1/4', 'folha 2/4', 'folha 3/4', 'folha 4/4']) {
      expect(html).toContain(page)
    }
  })

  it('opens with the principles copy and the defenses, not a cover', () => {
    const firstSheet = html.split('data-page="essencial"')[0]
    expect(firstSheet).toContain('Princípios e crenças')
    expect(firstSheet).toContain('Universidade pública não é gasto: é projeto de país.')
    expect(firstSheet).toContain('O que Solla defende')
    expect(firstSheet).not.toContain('Como usar')
  })

  it('renders the literal request with the vote number and the one-line plan', () => {
    expect(html).toContain('vote 1313, Jorge Solla')
    expect(html).toContain('request-line')
    expect(html).toContain('request-block')
    expect(html).toContain('compromisso nomeado')
  })

  it('splits the qa list across the two last sheets', () => {
    const firstQa = html.split('data-page="qa"')[1].split('data-page="qa-2"')[0]
    const secondQa = html.split('data-page="qa-2"')[1]
    expect((html.match(/class="qa-item"/g) ?? []).length).toBe(5)
    expect(firstQa).toContain('Pergunta 0')
    expect(firstQa).toContain('Pergunta 2')
    expect(firstQa).not.toContain('Pergunta 4')
    expect(secondQa).toContain('Pergunta 3')
    expect(secondQa).toContain('Pergunta 4')
  })

  it('links every anchored item to its sourced fact and marks the lacuna', () => {
    expect(html).toContain('https://saude.test/ambulancia')
    expect(html).toContain('25/01/2012')
    expect(html).toContain('<span class="source">lacuna</span>')
  })

  it('escapes authored and research text', () => {
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('declares the shed remainder on the sheet instead of dropping it silently', () => {
    const trimmed = trimBriefing(trimBriefing(content)!)!
    const shedHtml = renderBriefingHtml(trimmed, { unit: MUNICIPALITY_UNIT, report })
    expect(shedHtml).toContain('no briefing completo (.md)')
    expect(trimmed.qa).toHaveLength(4)
  })

  it('prints the lacuna line only when the recorte never had a defense', () => {
    const noDefenses = normalizeBriefingContent(
      { ...rawContent(), defenses: [] },
      { unit: MUNICIPALITY_UNIT, slug: 'ilheus', facts },
    )
    expect(renderBriefingHtml(noDefenses, { unit: MUNICIPALITY_UNIT, report })).toContain(
      'Sem registro localizado no dossiê.',
    )
  })

  it('names the recorte in the kicker and the footer', () => {
    expect(html).toContain('Briefing de capacitação · Ilhéus')
    expect(html).toContain('Briefing de capacitação · cidade')
    expect(html).toContain('<strong>Recorte:</strong> cidade · Ilhéus')
  })
})

describe('renderBriefingMd (companion superset)', () => {
  it('carries every item of the full content, including what the PDF shed', () => {
    let trimmed = content
    while (trimBriefing(trimmed)) trimmed = trimBriefing(trimmed)!
    expect(trimmed.qa.length).toBeLessThan(content.qa.length)
    expect(trimmed.defenses.length).toBeLessThan(content.defenses.length)
    const droppedQuestion = content.qa.find(
      (item: { question: string }) =>
        !trimmed.qa.some((kept: { question: string }) => kept.question === item.question),
    )!
    const shedHtml = renderBriefingHtml(trimmed, { unit: MUNICIPALITY_UNIT, report })
    expect(shedHtml).not.toContain(droppedQuestion.question)
    const md = renderBriefingMd(content, { unit: MUNICIPALITY_UNIT, report })
    expect(md).toContain(droppedQuestion.question)
    expect(md).toContain('Insumo interno de capacitação — não publicar')
    expect(md).toContain('vote 1313, Jorge Solla')
    expect(md).toContain('**Plano:** Combine onde, quando e como votar')
    expect(md).toContain('[fonte](https://saude.test/ambulancia)')
    expect(md).toContain('## O que Solla defende')
    expect(md).toContain('## O essencial do recorte')
    expect(md).toContain('## O pedido')
    expect(md).toContain('## Perguntas prováveis × melhores respostas')
    expect(md).not.toContain('## O que evitar')
    expect(md).not.toContain('## Limites e defeso')
    expect((md.match(/^### /gm) ?? []).length).toBe(5)
  })
})
