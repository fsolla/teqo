import { describe, expect, it } from 'vitest'

import {
  BRIEFING_LABEL,
  BRIEFING_MINIMUMS,
  BRIEFING_QA_SIDES,
  briefingAnchorFact,
  normalizeBriefingContent,
  trimBriefing,
} from '../../scripts/lib/briefingContent.mjs'
import { buildDossierReport } from '../../scripts/lib/dossieBlocks.mjs'
import {
  mergeDossierResearch,
  normalizeDossierResearchInput,
} from '../../scripts/lib/dossieResearch.mjs'
import { MUNICIPALITY_UNIT, THEME_UNIT } from '../../scripts/lib/dossieUnit.mjs'

// C210: the authored briefing may only anchor on the dossiê ledger (facts with
// source). These tests pin the fail-closed validation, the deny-list and the
// deterministic shed order that keeps the four-sheet PDF honest.

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
        brief: { title: 'Ambulância e atenção domiciliar', note: 'Registro de 2012.' },
        sourceUrl: 'https://saude.test/ambulancia',
        sourceDate: '2012-01-25',
      },
      {
        id: 'era_b_programas',
        answer: 'Saúde em Movimento com menção direta',
        sourceUrl: 'https://saude.test/programas',
        sourceDate: '2013-05-10',
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
        id: 'era_c_atuacao',
        answer: 'Articulação regional pela UFBA',
        sourceUrl: 'https://camara.test/ufba',
        sourceDate: '2023-09-22',
      },
    ],
    news: [],
    gaps: [],
  }),
])

const report = buildDossierReport({ snapshot, research, generatedAt })
const facts = report.bulletinFacts

const validRaw = (overrides: Record<string, unknown> = {}) => ({
  unitId: 'municipality',
  municipalitySlug: 'ilheus',
  generatedAt: generatedAt.toISOString(),
  subtitle: 'Litoral Sul · consulta antes e durante o contato',
  lede: 'Use um fato local de cada vez.',
  essential: [
    { factId: 'era_b_equipamentos', title: 'Ambulância', note: 'Registro local de 2012.' },
    { factId: 'era_b_programas', title: 'Saúde em Movimento', note: 'Menção direta.' },
    { gapReason: 'sem fala própria localizada', title: 'Sem fala local', note: 'Anote a lacuna.' },
  ],
  defenses: [{ factId: 'era_c_atuacao', title: 'Ensino superior', note: 'Defesa regional.' }],
  script: {
    steps: [
      { title: 'Comece pela relação', note: 'Escute antes de argumentar.' },
      { title: 'Use um fato do recorte', note: 'Diga o alcance.' },
      { title: 'Peça explicitamente', note: 'Nome e número.' },
    ],
  },
  qa: [
    {
      side: 'direita',
      question: 'Não voto no PT.',
      acknowledge: 'Entendo que a escolha pesa.',
      answer: 'Há registro nominal na saúde.',
      close: 'Posso contar com o 1313?',
      factId: 'era_b_equipamentos',
    },
    {
      side: 'esquerda',
      question: 'Por que ainda falta tanto?',
      acknowledge: 'A cobrança é legítima.',
      answer: 'O levantamento registra lacunas.',
      close: 'Posso contar com o 1313?',
      gapReason: 'sem registro localizado',
    },
    {
      side: 'entrega',
      question: 'Ele prometeu o quê?',
      acknowledge: 'Promessa precisa estar registrada.',
      answer: 'Não foi localizada promessa nominal.',
      close: 'Pelo trabalho comprovado, vota 1313?',
      gapReason: 'sem promessa nominal',
    },
    {
      side: 'direita',
      question: 'E o governo de Jerônimo?',
      acknowledge: 'É justo cobrar o que chegou.',
      answer: 'O briefing registra outros períodos.',
      close: 'Posso pedir seu voto 1313?',
      gapReason: 'sem entrega do governo atual',
    },
    {
      side: 'esquerda',
      question: 'Por que falar de Jacobina?',
      acknowledge: 'Você tem razão em separar cidade e região.',
      answer: 'As iniciativas aparecem como regionais.',
      close: 'Posso contar com o 1313?',
      factId: 'era_c_atuacao',
    },
  ],
  avoid: [
    { title: 'Confrontar para ganhar', note: 'Encerre com respeito.' },
    { title: 'Envergonhar o eleitor', note: 'Pressão pesada gera reação.' },
    { title: 'Prometer sem lastro', note: 'Indicação não é obra.' },
    { title: 'Repetir o ataque', note: 'Ofereça a explicação alternativa.' },
    { title: 'Broadcast impessoal', note: 'WhatsApp 1-a-1 vem antes.' },
  ],
  checklist: {
    beforeAnswer: ['Fonte e data', 'Alcance', 'Fase do valor'],
    unsure: ['Diga que não tem o dado', 'Anote a pergunta', 'Combine retorno'],
  },
  ...overrides,
})

const normalize = (raw: Record<string, unknown> = validRaw()) =>
  normalizeBriefingContent(raw, { unit: MUNICIPALITY_UNIT, slug: 'ilheus', facts })

describe('normalizeBriefingContent', () => {
  it('resolves every anchor against the sourced ledger and keeps the lacuna explicit', () => {
    const content = normalize()
    expect(content.essential).toHaveLength(3)
    expect(content.essential[0].fact?.sourceUrl).toBe('https://saude.test/ambulancia')
    expect(content.essential[2].gapReason).toBe('sem fala própria localizada')
    expect(content.qa).toHaveLength(5)
    expect(content.warnings).toEqual([])
  })

  it('rejects a unitId or slug from another recorte', () => {
    expect(() => normalize(validRaw({ unitId: 'theme' }))).toThrow(/unitId/)
    expect(() => normalize(validRaw({ municipalitySlug: 'itabuna' }))).toThrow(/não é "ilheus"/)
  })

  it('requires generatedAt and a lede', () => {
    expect(() => normalize(validRaw({ generatedAt: 'ontem' }))).toThrow(/generatedAt inválido/)
    expect(() => normalize(validRaw({ lede: '' }))).toThrow(/"lede" obrigatório/)
  })

  it('demands exactly one of factId | gapReason per item', () => {
    const both = validRaw()
    const essential = (both.essential as Record<string, unknown>[]).map((item, index) =>
      index === 0 ? { ...item, gapReason: 'também lacuna' } : item,
    )
    expect(() => normalize({ ...both, essential })).toThrow(
      /exatamente um de "factId" \| "gapReason"/,
    )
    const neither = (both.essential as Record<string, unknown>[]).map((item, index) =>
      index === 0 ? { title: 'x', note: 'y' } : item,
    )
    expect(() => normalize({ ...both, essential: neither })).toThrow(/exatamente um/)
  })

  it('fails closed when the factId does not resolve in a sourced fact', () => {
    const raw = validRaw()
    const essential = (raw.essential as Record<string, unknown>[]).map((item, index) =>
      index === 0 ? { ...item, factId: 'era_z_inexistente' } : item,
    )
    expect(() => normalize({ ...raw, essential })).toThrow(/não resolve em fato com fonte/)
    expect(() =>
      normalizeBriefingContent(validRaw(), {
        unit: MUNICIPALITY_UNIT,
        slug: 'ilheus',
        facts: [{ id: 'era_b_equipamentos' }],
      }),
    ).toThrow(/não resolve em fato com fonte/)
  })

  it('blocks staff-only/scenario keys recursively', () => {
    expect(() => normalize(validRaw({ scenario: { estimatedVotes: 1234 } }))).toThrow(
      /cenário\/estimativa é staff-only/,
    )
    expect(() =>
      normalize(
        validRaw({
          essential: [{ factId: 'era_b_equipamentos', title: 'x', note: 'y', estimatedVotes: 10 }],
        }),
      ),
    ).toThrow(/proibida/)
  })

  it('covers both sides and enforces the list minimums', () => {
    const raw = validRaw()
    expect(() =>
      normalize({
        ...raw,
        qa: (raw.qa as Record<string, unknown>[]).map((item) =>
          item.side === 'esquerda' ? { ...item, side: 'direita' } : item,
        ),
      }),
    ).toThrow(/dois lados/)
    expect(() => normalize({ ...raw, avoid: [] })).toThrow(/avoid: mínimo de 3/)
    expect(() =>
      normalize({ ...raw, checklist: { beforeAnswer: ['só um'], unsure: ['a', 'b'] } }),
    ).toThrow(/checklist.beforeAnswer: mínimo de 2/)
  })

  it('reports over-cap text as a warning, never as a hard failure', () => {
    const raw = validRaw()
    const content = normalize({ ...raw, lede: 'a'.repeat(500) })
    expect(content.warnings.join('\n')).toMatch(/lede: 500 chars/)
  })

  it('resolves anchors through the unit slugField (theme seam)', () => {
    const themeFacts = ['era_b_equipamentos', 'era_b_programas', 'era_c_atuacao'].map((id) => ({
      id,
      sourceUrl: `https://x.test/${id}`,
      sourceDate: '2011-08-30',
    }))
    const raw = validRaw({ unitId: 'theme' })
    expect(() =>
      normalizeBriefingContent(raw, { unit: THEME_UNIT, slug: 'educacao', facts: themeFacts }),
    ).toThrow(/themeSlug/)
    const content = normalizeBriefingContent(
      { ...raw, themeSlug: 'educacao' },
      { unit: THEME_UNIT, slug: 'educacao', facts: themeFacts },
    )
    expect(content.slug).toBe('educacao')
    expect(THEME_UNIT.briefingNoun).toBe('tema')
  })

  it('refuses the acervo sample (sourcePanel) as an anchor', () => {
    const panelFacts = [
      {
        id: 'fala-1',
        headline: 'Pronunciamento',
        sourceUrl: 'https://x.test/fala',
        sourcePanel: true,
      },
    ]
    expect(briefingAnchorFact(panelFacts, 'fala-1')).toBeNull()
    expect(() =>
      normalizeBriefingContent(validRaw(), {
        unit: MUNICIPALITY_UNIT,
        slug: 'ilheus',
        facts: panelFacts,
      }),
    ).toThrow(/não resolve em fato com fonte/)
  })

  it('reports qa caps with the real field names, once each', () => {
    const raw = validRaw()
    const qa = (raw.qa as Record<string, unknown>[]).map((item, index) =>
      index === 0 ? { ...item, question: 'q'.repeat(300), answer: 'a'.repeat(700) } : item,
    )
    const content = normalize({ ...raw, qa })
    expect(content.warnings.join('\n')).toContain('qa[0].question: 300 chars')
    expect(content.warnings.join('\n')).toContain('qa[0].answer: 700 chars')
    expect(content.warnings).toHaveLength(2)
  })

  it('keeps the label literal and the qa sides pinned for the renderer', () => {
    expect(BRIEFING_LABEL).toBe('Insumo interno de capacitação — não publicar')
    expect(BRIEFING_QA_SIDES).toEqual(['direita', 'esquerda', 'entrega'])
  })
})

describe('briefingAnchorFact', () => {
  it('returns the ledger fact or null', () => {
    expect(briefingAnchorFact(facts, 'era_b_programas')?.sourceUrl).toBe(
      'https://saude.test/programas',
    )
    expect(briefingAnchorFact(facts, 'não-existe')).toBeNull()
  })
})

describe('trimBriefing (deterministic shed order)', () => {
  const content = normalize()

  it('drops qa first, then defenses, then checklist, then avoid', () => {
    const first = trimBriefing(content)!
    expect(first.qa).toHaveLength(BRIEFING_MINIMUMS.qa)
    expect(first.shed).toEqual({ qa: 1, defenses: 0, checklist: 0, avoid: 0 })
    const second = trimBriefing(first)!
    expect(second.defenses).toHaveLength(0)
    expect(second.shed).toEqual({ qa: 1, defenses: 1, checklist: 0, avoid: 0 })
    const third = trimBriefing(second)!
    expect(third.shed.checklist).toBe(1)
    const fourth = trimBriefing(third)!
    expect(fourth.shed.checklist).toBe(2)
    expect(fourth.checklist.beforeAnswer.length + fourth.checklist.unsure.length).toBe(
      BRIEFING_MINIMUMS.beforeAnswer + BRIEFING_MINIMUMS.unsure,
    )
    const fifth = trimBriefing(fourth)!
    expect(fifth.avoid).toHaveLength(BRIEFING_MINIMUMS.avoid + 1)
    expect(fifth.shed.avoid).toBe(1)
  })

  it('never silences a required side when shedding qa', () => {
    const base = normalize()
    const qa = [
      { ...base.qa[1], side: 'esquerda' },
      { ...base.qa[2], side: 'esquerda' },
      { ...base.qa[3], side: 'entrega' },
      { ...base.qa[4], side: 'esquerda' },
      { ...base.qa[0], side: 'direita' },
    ]
    const trimmed = trimBriefing({ ...base, qa })!
    expect(trimmed.qa).toHaveLength(BRIEFING_MINIMUMS.qa)
    expect(trimmed.shed.qa).toBe(1)
    const sides = new Set(trimmed.qa.map((item: { side: string }) => item.side))
    expect(sides.has('direita')).toBe(true)
    expect(sides.has('esquerda')).toBe(true)
    // The unique "direita" (last item) survives — the shed picked an "esquerda".
    expect(trimmed.qa.at(-1)?.side).toBe('direita')
  })

  it('never touches essential or the script and stops at the minimums', () => {
    let current = content
    let next = trimBriefing(current)
    let guard = 0
    while (next && guard < 50) {
      current = next
      next = trimBriefing(current)
      guard += 1
    }
    expect(current.qa).toHaveLength(BRIEFING_MINIMUMS.qa)
    expect(current.defenses).toHaveLength(0)
    expect(current.checklist.beforeAnswer).toHaveLength(BRIEFING_MINIMUMS.beforeAnswer)
    expect(current.checklist.unsure).toHaveLength(BRIEFING_MINIMUMS.unsure)
    expect(current.avoid).toHaveLength(BRIEFING_MINIMUMS.avoid)
    expect(current.essential).toEqual(content.essential)
    expect(current.script).toEqual(content.script)
    expect(next).toBeNull()
  })
})
