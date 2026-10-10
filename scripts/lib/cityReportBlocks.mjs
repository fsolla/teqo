/**
 * Content model of the city report (C163).
 *
 * Since the 2026-10-10 refocus the report serves the 2º turno (Lula × Flávio):
 * page 1 is the mobilization summary (role of the unit, official numbers, who
 * mobilizes, local movement, the ask) and the numbered sections are the deep
 * dive (2º turno, network, conjuncture, demography, economy, transport, news,
 * approach, sources). The mandate-era blocks of the pre-travel report (Solla's
 * own electoral account and chair math, competitors, delivered emendas, Câmara
 * speeches, region panorama, signals/demands) were retired; demography, economy
 * and transport stay as visit context. Numbering is positional over the blocks
 * actually built.
 *
 * "Sem fonte, não publica": every claim carries its source; what is missing
 * becomes an explicit gap.
 */

import {
  BAHIA_SECOND_ROUND_GENERATED_AT,
  getBahiaSecondRoundUnit,
  secondRoundAdversaryCapturePct,
  secondRoundLulaShares,
  secondRoundPotentialOf,
  secondRoundSollaShareOfLula,
} from '../../src/lib/bahiaSecondRound.ts'
import { formatEngagementLevelLabel } from '../../src/lib/engagementLevel.ts'
import { secondRoundRoleGuidance, secondRoundRoleLabels } from '../../src/lib/secondRoundRole.ts'
import { supportStatusLabels } from '../../src/utilities/leadership/leadershipLabels.ts'
import {
  municipalityPriorityLabels,
  politicalTrendLabels,
} from '../../src/utilities/municipality/municipalityLabels.ts'

import {
  formatDateBr,
  formatDateTimeBr,
  formatFreshness,
  formatInteger,
  formatPercent,
} from './cityReportFormat.mjs'
import { researchItemById } from './cityReportResearch.mjs'
import { capList, moreItemsLabel, summaryListText, summarySurfaceText } from './reportText.mjs'

const REPORT_TITLE = 'Relatório de cidade — 2º turno (Lula × Flávio)'

const GAP_COPY = 'Lacuna explícita — não preencher por inferência.'

const SECOND_ROUND_GUARDRAIL =
  'X₁/X₂ são votos em jogo, não transferência garantida — o cenário de 2º turno é hipotético; persuasão em eleição geral tem efeito médio ~0.'

const GAP_CALLOUT_LIMIT = 4

/**
 * Page-1 text budget (C188). Page 1 is a summary surface: it never cuts
 * mid-sentence with "…". It prints the researcher's `summary` when present,
 * else the full `answer`; when the full text does not fit the one-page guard,
 * the builder re-renders with `textFallback='pointer'` and the line points to
 * the deep dive (which always keeps the integral). Only the list caps below
 * still apply — each one with a visible counter.
 */
const PAGE_ONE_LIST_LIMIT = 2
/** Joined name lists (Responsável, Dobradinhas) — one line in the strip/stat row. */
const PAGE_ONE_NAMES_MAX = 20
/**
 * Character ceiling for a joined list of free text (conjuncture risks) — the
 * joined `answer`s have no deep-dive copy, so a long line degrades to the
 * pointer when the page does not fit, instead of blowing the guard.
 */
const PAGE_ONE_JOINED_MAX = 90

const sourceTeqo = (label, date) => ({ kind: 'teqo', label, date: date ?? null })
const sourceWeb = (label, url, date) => ({
  kind: 'web',
  label,
  url: url ?? null,
  date: date ?? null,
})
const sourceOfficial = (label, url, date) => ({
  kind: 'official',
  label,
  url: url ?? null,
  date: date ?? null,
})

/**
 * Inline-source tokens: a free-text field (detail/hook/suggestion/value/support)
 * can carry `{{fonte}}` for the item's primary URL and `{{fonte:2}}`,
 * `{{fonte:3}}`… for its `extraSources`. The renderers turn them into a
 * `(fonte)` link exactly where the text cites the verified fact, so one excerpt
 * can point to more than one outlet. When the text has no token, the primary
 * (and any extra) URL is appended at the end — "inline com o trecho", never a
 * bare column.
 */
const INLINE_SOURCE_TOKEN = /\{\{fonte(?::\d+)?\}\}/
const inlineSourceTokens = (count) =>
  Array.from({ length: count }, (_, index) =>
    index === 0 ? '{{fonte}}' : `{{fonte:${index + 1}}}`,
  ).join(' ')

const sourcesOf = (item) =>
  [item?.sourceUrl, ...((item?.extraSources ?? []).map((extra) => extra?.url) ?? [])].filter(
    (url) => typeof url === 'string' && url.trim() !== '',
  )

const withInlineSources = (text, sources) => {
  if (!text || !sources.length) return text
  if (INLINE_SOURCE_TOKEN.test(text)) return text
  return `${text} ${inlineSourceTokens(sources.length)}`
}

/** "+1.234" / "−208.310" — the 2º-turno deltas never lose the sign. */
const signedInteger = (value) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatInteger(Math.abs(value))}`

/** "+3,2 p.p." / "−4,0 p.p." — pt-BR decimal, explicit sign. */
const signedPoints = (value) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1).replace('.', ',')} p.p.`

/**
 * Página 1 = resumo de uma olhada: a fonte do item entra compacta (pesquisa web
 * + data). O texto é o `summary` do researcher quando existe; sem ele, a
 * resposta integral — e, quando a página 1 não cabe (`fallback: 'pointer'`), uma
 * linha aponta o aprofundamento **sem reticências**. A resposta integral é
 * sempre preservada em "Pesquisa — respostas integrais" (C188).
 */
const researchAnswerItem = (research, id, fallback = 'full') => {
  const item = researchItemById(research, id)
  if (!item) return null
  return {
    text: summarySurfaceText(item, fallback).text,
    source: sourceWeb(null, null, item.sourceDate),
  }
}

const gapCallout = (gaps, title = 'Lacunas desta seção') => {
  if (!gaps.length) return null
  const { items: shown, remaining } = capList(gaps, GAP_CALLOUT_LIMIT)
  return {
    kind: 'callout',
    tone: 'gap',
    title,
    body: [
      GAP_COPY,
      ...shown.map((gap) => `${gap.label ? `${gap.label}: ` : ''}${gap.reason}`),
      ...(remaining > 0
        ? [`${moreItemsLabel(remaining, 'ponto sem leitura', 'pontos sem leitura')}.`]
        : []),
    ],
  }
}

const buildIdentificationItems = ({ municipality, conjuncture, advisors }) => [
  { label: 'Território', value: municipality.region },
  {
    label: 'Prioridade',
    value: conjuncture ? (municipalityPriorityLabels[conjuncture.priority] ?? '—') : '—',
  },
  {
    label: 'Nível',
    value: conjuncture?.engagementLevel
      ? formatEngagementLevelLabel(conjuncture.engagementLevel)
      : 'Sem nível',
  },
  {
    label: 'Responsável',
    value: advisors.length
      ? summaryListText(
          advisors.map((advisor) => advisor.name),
          { limit: PAGE_ONE_LIST_LIMIT, max: PAGE_ONE_NAMES_MAX },
        )
      : 'Sem responsável',
  },
]

/** The three official numbers of the unit — shared by page 1 and the section. */
const secondRoundKpiItems = (unit, potential, shares, sollaRatio) => [
  {
    label: 'Lula em 2026',
    value: formatPercent(shares.share26 / 100),
    hint: `dos válidos · Δ ${signedPoints(shares.deltaPp)} vs 2022`,
  },
  {
    label: 'Votos fora do 2º turno',
    value: potential ? `X₂ = ${formatInteger(potential.x2)}` : '—',
    hint: potential
      ? `X₁ = ${formatInteger(potential.x1)} já no comparecimento; X₂ soma os ausentes`
      : 'sem cenário para os números do recorte',
  },
  {
    label: 'Solla 2026',
    value: formatInteger(unit.solla26),
    hint: `Δ ${signedInteger(unit.dSolla)} vs 2022${
      sollaRatio !== null ? ` · ${formatPercent(sollaRatio / 100)} dos votos de Lula` : ''
    }`,
  },
]

/**
 * Page-1 cell of the 2º turno: the official numbers plus the deterministic role
 * of the unit. A unit outside the artifact degrades to an explicit gap instead
 * of an empty cell.
 */
const buildSecondRoundPageBlocks = ({ snapshot }) => {
  const unit = getBahiaSecondRoundUnit(snapshot.municipality.slug)
  if (!unit) {
    return [
      gapCallout(
        [
          {
            id: 'segundo_turno',
            label: 'Artefato do 2º turno',
            reason: 'Unidade fora do artefato TSE 2026 — regenere com `pnpm build:second-round`.',
          },
        ],
        'Lacunas desta seção',
      ),
    ]
  }
  const potential = secondRoundPotentialOf(unit)
  const shares = secondRoundLulaShares(unit)
  const sollaRatio = secondRoundSollaShareOfLula(unit)
  return [
    {
      kind: 'kpis',
      items: secondRoundKpiItems(unit, potential, shares, sollaRatio),
    },
    {
      kind: 'callout',
      tone: unit.role === 'defesa' ? 'risk' : 'decision',
      title: `Papel no 2º turno: ${secondRoundRoleLabels[unit.role]}`,
      body: [secondRoundRoleGuidance[unit.role]],
    },
  ]
}

const buildWhoRows = ({ leaderships, advisors, conjuncture }, research, prefeito, fallback) => {
  const rows = []
  const simpleAnswers = [
    { id: 'prefeito', label: 'Prefeito(a)', item: prefeito },
    { id: 'vice', label: 'Vice', item: researchAnswerItem(research, 'vice', fallback) },
    {
      id: 'relacao_campo',
      label: 'Relação com o campo',
      item: researchAnswerItem(research, 'relacao_campo', fallback),
    },
  ]
  for (const { label, item } of simpleAnswers) {
    if (item) rows.push({ label, value: item.text, source: item.source })
  }
  rows.push({
    label: 'Lideranças',
    value: `${formatInteger(leaderships.totalCount)} na base`,
    hint: advisors.length ? null : 'sem responsável vinculado',
  })
  const dobradinhas = conjuncture?.stateDeputies?.length
    ? summaryListText(
        conjuncture.stateDeputies.map((deputy) => deputy.name),
        { limit: PAGE_ONE_LIST_LIMIT, max: PAGE_ONE_NAMES_MAX, fallback },
      )
    : null
  rows.push({ label: 'Dobradinhas', value: dobradinhas ?? 'sem registro na base' })
  const vereadores = researchAnswerItem(research, 'vereadores', fallback)
  if (vereadores) {
    rows.push({ label: 'Vereadores/dobradas', value: vereadores.text, source: vereadores.source })
  }
  return rows
}

/**
 * Local movement of the 2º turno (web): acts, palanques and positioning of
 * local leaders in the Lula × Flávio race — what the source says, dated. A
 * missing item is the explicit gap (page 1 and the section).
 */
const buildSecondRoundMovementBlock = (research, fallback) => {
  const movement = researchAnswerItem(research, 'segundo_turno', fallback)
  if (!movement) {
    return gapCallout(
      [
        {
          id: 'segundo_turno',
          label: 'Movimento local do 2º turno',
          reason: 'Não pesquisado.',
        },
      ],
      'Movimento local do 2º turno (pesquisa)',
    )
  }
  return {
    kind: 'callout',
    tone: 'info',
    title: 'Movimento local do 2º turno (pesquisa)',
    body: [`${movement.text} (fonte: pesquisa web · ${formatDateBr(movement.source.date)})`],
  }
}

/** The ask on the palanque: Lula 13, anchored in the confirmed local relation. */
const buildAskPanel = (research, fallback) => {
  const relacao = researchAnswerItem(research, 'relacao_campo', fallback)
  const items = [
    {
      text: 'Pedido no palanque: Lula 13 — mobilizar, proteger e dar voz; sem prometer transferência de voto.',
    },
  ]
  if (relacao) {
    items.push({ text: `Relação local confirmada: ${relacao.text}` })
  }
  return {
    kind: 'panel',
    tone: 'decision',
    title: 'O que pedir e falar',
    items,
    note: SECOND_ROUND_GUARDRAIL,
  }
}

const buildRiskCards = ({ leaderships, advisors, conjuncture }, research, fallback) => {
  const opposition = researchAnswerItem(research, 'disputa_local', fallback)
  return [
    {
      title: 'Oposição local',
      body: opposition
        ? `${opposition.text} (fonte: pesquisa web · ${formatDateBr(opposition.source.date)})`
        : 'Sem leitura suficiente — lacuna',
    },
    {
      title: 'Riscos na base',
      body: conjuncture?.risks?.length
        ? summaryListText(conjuncture.risks, {
            limit: PAGE_ONE_LIST_LIMIT,
            max: PAGE_ONE_JOINED_MAX,
            fallback,
          })
        : 'Nenhum risco registrado',
    },
    {
      title: 'Rede',
      body: leaderships.totalCount
        ? `${formatInteger(leaderships.totalCount)} liderança(s)${advisors.length ? '' : ' · sem responsável'}`
        : 'Nenhuma liderança na base',
    },
  ]
}

/** Page-1 gaps: a missing prefeito is the only research hole summarized here. */
const collectPageOneGaps = ({ prefeito }) => {
  const gaps = []
  if (!prefeito) gaps.push({ id: 'prefeito', label: 'Prefeito(a)', reason: 'Não pesquisado.' })
  return gaps
}

const buildPageOne = ({ snapshot, research, generatedAt, textFallback }) => {
  const prefeito = researchAnswerItem(research, 'prefeito', textFallback)
  const gapCalloutBlock = gapCallout(collectPageOneGaps({ prefeito }), 'Pontos sem leitura')

  return {
    blocks: [
      { kind: 'strip', items: buildIdentificationItems(snapshot) },
      {
        kind: 'grid',
        columns: 2,
        cells: [
          {
            title: '2º turno — Lula × Flávio',
            blocks: buildSecondRoundPageBlocks({ snapshot }),
          },
          {
            title: 'Quem mobiliza',
            blocks: [
              { kind: 'stats', rows: buildWhoRows(snapshot, research, prefeito, textFallback) },
            ],
          },
        ],
        sources: [
          sourceTeqo('lideranças, responsáveis e prioridade', snapshot.meta?.readAt),
          sourceOfficial('TSE — 1º turno 2026 (presidente, por seção) e 2022', null, null),
          sourceTeqo(
            'artefato do 2º turno (pnpm build:second-round)',
            BAHIA_SECOND_ROUND_GENERATED_AT,
          ),
        ],
      },
      buildSecondRoundMovementBlock(research, textFallback),
      {
        kind: 'cards',
        title: 'Riscos — oposição/disputa local',
        items: buildRiskCards(snapshot, research, textFallback),
      },
      buildAskPanel(research, textFallback),
      gapCalloutBlock,
      {
        kind: 'footerNote',
        text: `Gerado em ${formatDateBr(generatedAt)} · snapshot do momento · fontes item a item nas seções de aprofundamento.`,
      },
    ].filter(Boolean),
  }
}

/**
 * 2º turno section (Lula × Flávio): deterministic numbers from the committed
 * artifact (official TSE 2026 president T1 per section, aggregated to the
 * campaign unit) + the local web movement. The role copy directs the visit
 * (mobilize/defend); it never promises vote transfer.
 */
const buildSecondRoundSection = ({ snapshot, research }) => {
  const unit = getBahiaSecondRoundUnit(snapshot.municipality.slug)
  if (!unit) {
    return [
      gapCallout(
        [
          {
            id: 'segundo_turno',
            label: 'Artefato do 2º turno',
            reason: 'Unidade fora do artefato TSE 2026 — regenere com `pnpm build:second-round`.',
          },
        ],
        'Lacunas desta seção',
      ),
      buildSecondRoundMovementTable(research),
    ].filter(Boolean)
  }

  const potential = secondRoundPotentialOf(unit)
  const shares = secondRoundLulaShares(unit)
  const capture = secondRoundAdversaryCapturePct(unit)
  const sollaRatio = secondRoundSollaShareOfLula(unit)
  const sources = [
    sourceOfficial(
      'TSE — 1º turno 2026 (presidente, por seção) e 2022; deputado federal 2026',
      null,
      null,
    ),
    sourceTeqo(
      'base Teqo — artefato do 2º turno (pnpm build:second-round)',
      BAHIA_SECOND_ROUND_GENERATED_AT,
    ),
  ]

  const rows = [
    {
      label: 'Lula (PT)',
      y22: formatInteger(unit.lula22),
      y26: formatInteger(unit.lula26),
      delta: signedInteger(unit.dLula),
    },
    {
      label: 'Adversário (Bolsonaro→Flávio)',
      y22: formatInteger(unit.adversary22),
      y26: formatInteger(unit.adversary26),
      delta: signedInteger(unit.dAdversary),
    },
    {
      label: 'Solla — dep. federal 1313',
      y22: formatInteger(unit.solla22),
      y26: formatInteger(unit.solla26),
      delta: signedInteger(unit.dSolla),
    },
    {
      label: 'Comparecimento',
      y22: formatInteger(unit.comparecimento22),
      y26: formatInteger(unit.comparecimento26),
      delta: signedInteger(unit.comparecimento26 - unit.comparecimento22),
    },
    {
      label: 'Abstenção',
      y22: formatInteger(unit.abstencao22),
      y26: formatInteger(unit.abstencao26),
      delta: signedInteger(unit.abstencao26 - unit.abstencao22),
    },
    {
      label: 'Brancos + nulos',
      y22: formatInteger(unit.brancosNulos22),
      y26: formatInteger(unit.brancosNulos26),
      delta: signedInteger(unit.brancosNulos26 - unit.brancosNulos22),
    },
  ]

  const calloutBody = [secondRoundRoleGuidance[unit.role]]
  if (capture !== null) {
    calloutBody.push(
      `Captura do adversário: ${formatPercent(capture / 100)} da perda de Lula em votos (pode passar de 100% quando o comparecimento cresce).`,
    )
  }
  if (sollaRatio !== null) {
    calloutBody.push(
      `Solla 2026 = ${formatPercent(sollaRatio / 100)} dos votos de Lula no recorte — a base local disponível para organizar a mobilização.`,
    )
  }

  return [
    {
      kind: 'callout',
      tone: unit.role === 'defesa' ? 'risk' : 'decision',
      title: `Papel no 2º turno: ${secondRoundRoleLabels[unit.role]}`,
      body: calloutBody,
      sources,
    },
    {
      kind: 'kpis',
      items: secondRoundKpiItems(unit, potential, shares, sollaRatio),
      sources: [sources[0]],
    },
    {
      kind: 'table',
      title: 'A conta 2022 → 1º turno 2026 (presidente e Solla 1313)',
      columns: [
        { key: 'label', label: 'Indicador', width: 34 },
        { key: 'y22', label: '2022', numeric: true, width: 22 },
        { key: 'y26', label: '2026', numeric: true, width: 22 },
        { key: 'delta', label: 'Δ', numeric: true, width: 22 },
      ],
      rows,
      note:
        unit.dLula < 0
          ? `Captura do adversário = ΔFlávio ÷ |ΔLula| = ${
              capture === null ? '—' : formatPercent(capture / 100)
            }; pode passar de 100% porque a perda de Lula não é a única fonte do ganho (comparecimento e terceira via também mudam).`
          : `Lula não perdeu votos no recorte (Δ ${signedInteger(unit.dLula)}).`,
      sources,
    },
    {
      kind: 'prose',
      text: 'X₁ = votos já dentro do comparecimento de 2026 que não foram de Lula nem de Flávio (nulos, brancos e terceira via); X₂ = X₁ + ausentes. São votos em jogo, não transferência garantida: o cenário de 2º turno é hipotético. Persuasão em eleição geral tem efeito médio próximo de zero — o papel de Solla é mobilizar, proteger e dar voz, com contato na última semana.',
      sources,
    },
    buildSecondRoundMovementTable(research),
  ].filter(Boolean)
}

/**
 * The movement table of the deep dive: what the source says (with inline
 * sources) + the date. The page-1 block prints the researched summary instead.
 */
const buildSecondRoundMovementTable = (research) => {
  const item = researchItemById(research, 'segundo_turno')
  if (!item) {
    return gapCallout(
      [
        {
          id: 'segundo_turno',
          label: 'Movimento local do 2º turno',
          reason: 'Não pesquisado.',
        },
      ],
      'Lacuna desta seção',
    )
  }
  const sources = sourcesOf(item)
  return {
    kind: 'table',
    title: '2º turno — movimento local e palanque (pesquisa)',
    columns: [
      { key: 'detail', label: 'O que a fonte diz', width: 72 },
      { key: 'source', label: 'Fonte', width: 28 },
    ],
    rows: [
      {
        detail: withInlineSources(item.details ?? item.answer, sources),
        source: formatDateBr(item.sourceDate),
        sources,
      },
    ],
    note: 'Atos, palanques e posicionamentos locais na disputa Lula × Flávio — fato publicado com fonte datada.',
    sources: sources.map((url) => ({
      kind: 'web',
      label: 'Movimento local do 2º turno',
      url,
      date: item.sourceDate,
    })),
  }
}

const buildOppositionBlock = (research) => {
  const entries = research.opposition ?? []
  if (!entries.length) return null
  return {
    kind: 'table',
    title: 'Frente de oposição — o que usar com fonte (pesquisa)',
    columns: [
      { key: 'topic', label: 'Tema', width: 22 },
      { key: 'detail', label: 'O que a fonte diz', width: 62 },
      { key: 'source', label: 'Fonte', width: 16 },
    ],
    rows: entries.map((item) => {
      const sources = sourcesOf(item)
      return {
        topic: item.topic,
        detail: withInlineSources(item.detail, sources),
        source: formatDateBr(item.sourceDate),
        sources,
      }
    }),
    note: 'Fato publicado com fonte datada — não é condenação. Atribua à fonte e não infira culpa; tema nacional pode ser de mão dupla.',
    sources: entries.map((item) => ({
      kind: 'web',
      label: `Oposição — ${item.topic}`,
      url: item.sourceUrl,
      date: item.sourceDate,
    })),
  }
}

const buildNetworkSection = ({ snapshot, research }) => {
  const { leaderships, advisors } = snapshot
  const rows = leaderships.rows.map((row) => ({
    name: row.name,
    support: row.supportStatus ? supportStatusLabels[row.supportStatus] : '—',
    organizations: row.organizationNames.length ? row.organizationNames.join(', ') : '—',
    access: row.hasAppAccess ? 'Com acesso ao app' : 'Sem acesso ao app',
    freshness: formatFreshness(row.updatedAt),
  }))

  const blocks = []
  if (rows.length) {
    blocks.push({
      kind: 'table',
      title: 'Rede e lideranças',
      columns: [
        { key: 'name', label: 'Liderança' },
        { key: 'support', label: 'Apoio' },
        { key: 'organizations', label: 'Organizações' },
        { key: 'access', label: 'Acesso' },
        { key: 'freshness', label: 'Frescor' },
      ],
      rows,
      note:
        leaderships.totalCount > rows.length
          ? `Mostrando ${rows.length} de ${leaderships.totalCount} lideranças (mesmo corte do dossiê).`
          : null,
      sources: [sourceTeqo('lideranças e pledges', snapshot.meta?.readAt)],
    })
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'gap',
      title: 'Rede e lideranças',
      body: ['Nenhuma liderança vinculada a este município na base.', GAP_COPY],
    })
  }

  blocks.push({
    kind: 'stats',
    title: 'Responsáveis',
    rows: [
      {
        label: 'Assessores do município',
        value: advisors.length
          ? advisors.map((advisor) => advisor.name).join(', ')
          : 'Sem responsável',
      },
      { label: 'Pledges declarados', value: formatInteger(snapshot.pledges.declaredTotal) },
      {
        label: 'Última movimentação de pledge',
        value: snapshot.pledges.lastPledgeAt
          ? formatFreshness(snapshot.pledges.lastPledgeAt)
          : 'sem registro',
      },
    ],
    sources: [sourceTeqo('pledges', snapshot.meta?.readAt)],
  })

  const cityLeaders = research?.leaders ?? []
  if (cityLeaders.length) {
    blocks.push({
      kind: 'table',
      title: 'Lideranças da cidade (pesquisa)',
      columns: [
        { key: 'name', label: 'Nome' },
        { key: 'role', label: 'Papel' },
        { key: 'party', label: 'Partido' },
        { key: 'period', label: 'Período' },
        { key: 'source', label: 'Fonte' },
      ],
      rows: cityLeaders.map((leader) => ({
        name: leader.name,
        role: leader.role,
        party: leader.party ?? '—',
        period: leader.period ?? '—',
        source: formatDateBr(leader.sourceDate),
      })),
      note: 'Últimos prefeitos/vices, vereadores mais votados e lideranças locais — pesquisa web com URL por item.',
      sources: cityLeaders.map((leader) => ({
        kind: 'web',
        label: `${leader.name} — ${leader.role}`,
        url: leader.sourceUrl,
        date: leader.sourceDate,
      })),
    })
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'gap',
      title: 'Lideranças da cidade (pesquisa)',
      body: ['Nenhuma liderança local pesquisada com fonte.', GAP_COPY],
    })
  }

  const leaderAgenda = buildLeaderAgendaBlock(research)
  if (leaderAgenda) blocks.push(leaderAgenda)

  blocks.push(
    ...buildSourcedListBlocks({
      title: 'Dobradinhas (pesquisa)',
      note: 'Com quem Solla soma na cidade (estadual/federal, chapa e lideranças que transferem voto) — insumo direto da abordagem sugerida; cada item com URL.',
      items: research?.alliances ?? [],
    }),
  )

  return blocks
}

/**
 * Pauta provável de cada liderança do mesmo campo / da rede: hipótese ancorada
 * em fonte pública, NÃO um fato — a nota do bloco deixa isso explícito para
 * ninguém tratar a leitura como compromisso do líder.
 */
const buildLeaderAgendaBlock = (research) => {
  const entries = research?.leaderAgenda ?? []
  if (!entries.length) return null
  return {
    kind: 'table',
    title: 'Pauta das lideranças (pesquisa)',
    columns: [
      { key: 'name', label: 'Líder', width: 18 },
      { key: 'field', label: 'Campo', width: 13 },
      { key: 'topics', label: 'Pauta provável', width: 22 },
      { key: 'hook', label: 'Gancho recente', width: 33 },
      { key: 'source', label: 'Fonte', width: 14 },
    ],
    rows: entries.map((item) => {
      const sources = sourcesOf(item)
      return {
        name: item.name,
        field: item.field ?? '—',
        topics: item.topics ?? '—',
        hook: withInlineSources(item.hook ?? '—', sources),
        source: formatDateBr(item.sourceDate),
        sources,
      }
    }),
    note: '“Pauta provável” é hipótese ancorada em fonte pública — validar na conversa; não é declaração do líder. Prioriza rede da campanha e mesmo campo.',
    sources: entries.map((item) => ({
      kind: 'web',
      label: `${item.name} — pauta provável`,
      url: item.sourceUrl,
      date: item.sourceDate,
    })),
  }
}

const buildConjunctureSection = ({ snapshot, research }) => {
  const conjuncture = snapshot.conjuncture
  const trend = conjuncture?.politicalTrend
  const rows = [
    {
      label: 'Tendência política',
      value: trend?.status ? (politicalTrendLabels[trend.status] ?? 'Sem leitura') : 'Sem leitura',
      hint: trend?.note ?? null,
    },
    {
      label: 'Registrada por',
      value: trend?.recordedByName ?? '—',
      hint: trend?.recordedAt ? formatDateBr(trend.recordedAt) : null,
    },
    {
      label: 'Nível de envolvimento',
      value: conjuncture?.engagementLevel
        ? formatEngagementLevelLabel(conjuncture.engagementLevel)
        : 'Sem nível',
      hint: conjuncture?.levelNote ?? null,
    },
  ]

  const blocks = [
    {
      kind: 'stats',
      title: 'Conjuntura',
      rows,
      sources: [sourceTeqo('estratégia do município', snapshot.meta?.readAt)],
    },
  ]

  if (conjuncture?.strengths?.length) {
    blocks.push({
      kind: 'bullets',
      title: 'Forças',
      items: conjuncture.strengths.map((text) => ({ text })),
    })
  }
  if (conjuncture?.risks?.length) {
    blocks.push({
      kind: 'bullets',
      title: 'Riscos',
      items: conjuncture.risks.map((text) => ({ text })),
    })
  }
  if (conjuncture?.dobradinhaNotes) {
    blocks.push({ kind: 'prose', title: 'Dobradinhas', text: conjuncture.dobradinhaNotes })
  }
  if (conjuncture?.nextSteps) {
    blocks.push({ kind: 'prose', title: 'Próximos passos', text: conjuncture.nextSteps })
  }

  const opposition = buildOppositionBlock(research)
  if (opposition) blocks.push(opposition)

  return blocks
}

const buildSourcedListBlocks = ({ title, note, items }) => {
  if (!items.length) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title,
        body: ['Nenhum item pesquisado com fonte para este município.', GAP_COPY],
      },
    ]
  }
  return [
    {
      kind: 'table',
      title,
      columns: [
        { key: 'topic', label: 'Tema', width: 22 },
        { key: 'detail', label: 'Dado', width: 62 },
        { key: 'source', label: 'Fonte', width: 16 },
      ],
      rows: items.map((item) => {
        const sources = sourcesOf(item)
        return {
          topic: item.topic,
          detail: withInlineSources(item.detail, sources),
          source: formatDateBr(item.sourceDate),
          sources,
        }
      }),
      note,
      sources: items.map((item) => ({
        kind: 'web',
        label: item.topic,
        url: item.sourceUrl,
        date: item.sourceDate,
      })),
    },
  ]
}

const buildDemographicsSection = ({ snapshot, research }) => {
  const demographics = snapshot.demographics
  if (!demographics) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title: 'Demografia',
        body: ['Sem demografia para o código IBGE deste município.', GAP_COPY],
      },
    ]
  }
  const baseRows = [
    { indicator: 'População', value: formatInteger(demographics.population) },
    { indicator: '0–17 anos', value: formatInteger(demographics.ageBands['0-17']) },
    { indicator: '18–29 anos', value: formatInteger(demographics.ageBands['18-29']) },
    { indicator: '30–59 anos', value: formatInteger(demographics.ageBands['30-59']) },
    { indicator: '60+ anos', value: formatInteger(demographics.ageBands['60+']) },
    { indicator: 'Mulheres', value: formatPercent(demographics.sexShareFemale) },
    {
      indicator: 'Idade mediana',
      value:
        demographics.medianAge === null ? '—' : `${formatInteger(demographics.medianAge)} anos`,
    },
  ].map((row) => ({ ...row, source: 'base Teqo' }))
  const researchRows = (research.demography ?? []).map((item) => {
    const sources = sourcesOf(item)
    return {
      indicator: item.topic,
      value: withInlineSources(item.detail, sources),
      source: formatDateBr(item.sourceDate),
      sources,
    }
  })

  return [
    {
      kind: 'table',
      title: 'Demografia (IBGE Censo 2022)',
      columns: [
        { key: 'indicator', label: 'Indicador', width: 22 },
        { key: 'value', label: 'Dado', width: 61 },
        { key: 'source', label: 'Fonte', width: 17 },
      ],
      rows: [...baseRows, ...researchRows],
      note: '“base Teqo” = artefato IBGE Censo 2022 commitado; datas = pesquisa web datada, com URL na seção de fontes.',
      sources: [
        sourceTeqo('IBGE Censo 2022 (artefato commitado)', null),
        ...(research.demography ?? []).map((item) => ({
          kind: 'web',
          label: item.topic,
          url: item.sourceUrl,
          date: item.sourceDate,
        })),
      ],
    },
  ]
}

const buildEconomySection = ({ research }) =>
  buildSourcedListBlocks({
    title: 'Atividade econômica (pesquisa)',
    note: 'PIB, emprego e principais atividades (IBGE/CAGED e imprensa local) — onde a cidade gera renda e onde depende de fora; cada item com URL.',
    items: research.economy ?? [],
  })

const buildTransportSection = ({ research }) =>
  buildSourcedListBlocks({
    title: 'Transporte e conexões (pesquisa)',
    note: 'Rodovias (novas/reformadas), aeroporto mais próximo, portos e ferrovia: como a cidade se conecta à Bahia e o que está em obra/planejado — cada item com URL.',
    items: research.transport ?? [],
  })

const buildNewsSection = ({ research }) => {
  const blocks = []
  if (research.news.length) {
    blocks.push({
      kind: 'table',
      title: 'Notícias e imprensa local',
      // Título é o texto mais longo: larguras explícitas tornam a tabela
      // `table-fixed` (URL quebra em vez de empurrar a coluna) e dão a ela a
      // maior fatia — sem largura, a URL sem espaços infla a coluna Link.
      columns: [
        { key: 'date', label: 'Data', width: 9 },
        { key: 'outlet', label: 'Veículo', width: 14 },
        { key: 'title', label: 'Título', width: 49 },
        { key: 'link', label: 'Link', width: 28 },
      ],
      rows: research.news.map((item) => ({
        date: formatDateBr(item.publishedAt),
        outlet: item.outlet ?? '—',
        title: item.title,
        link: item.url,
      })),
      note: 'Janela de 90 dias; cada item com URL.',
      sources: [sourceWeb('pesquisa web datada', null, research.researchedAt)],
    })
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'gap',
      title: 'Notícias e imprensa local',
      body: ['Nenhuma matéria com fonte e data dentro da janela de 90 dias.', GAP_COPY],
    })
  }

  const newsGaps = research.gaps.filter((gap) => gap.id.startsWith('noticia_'))
  const callout = gapCallout(newsGaps, 'Notícias descartadas')
  if (callout) blocks.push(callout)
  return blocks
}

const buildApproachSection = ({ research }) => {
  const approach = research.approach ?? []
  if (!approach.length) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title: 'Abordagem sugerida (pesquisa)',
        body: ['Nenhuma sugestão pesquisada para este município.', GAP_COPY],
      },
    ]
  }
  return [
    {
      kind: 'table',
      title: 'Abordagem sugerida (pesquisa)',
      columns: [
        { key: 'topic', label: 'Frente' },
        { key: 'suggestion', label: 'Sugestão' },
        { key: 'source', label: 'Fonte' },
      ],
      rows: approach.map((item) => {
        const sources = sourcesOf(item)
        return {
          topic: item.persona ? `${item.persona} · ${item.topic}` : item.topic,
          suggestion: withInlineSources(item.suggestion, sources),
          source: formatDateBr(item.sourceDate),
          sources,
        }
      }),
      note: 'Sugestões das personas de ciência política e coordenação de campanha, ancoradas nas fontes listadas (URL por item); sem fonte, não entra.',
      sources: approach.map((item) => ({
        kind: 'web',
        label: `${item.topic}${item.persona ? ` — ${item.persona}` : ''}`,
        url: item.sourceUrl,
        date: item.sourceDate,
      })),
    },
  ]
}

/**
 * Page 1 never cuts text (C188): it prints the item's `summary` or the full
 * `answer`, degrading to a pointer when the page does not fit. This table keeps
 * the full text of every checklist item, so the pointer always has a target.
 */
const buildResearchAnswersTable = (research) =>
  research.items.length
    ? {
        kind: 'table',
        title: 'Pesquisa — respostas integrais (texto completo)',
        columns: [
          { key: 'item', label: 'Item', width: 22 },
          { key: 'answer', label: 'Resposta (texto integral)', width: 62 },
          { key: 'date', label: 'Data', width: 16 },
        ],
        rows: research.items.map((item) => {
          const sources = sourcesOf(item)
          return {
            item: item.label,
            answer: withInlineSources(item.answer, sources),
            date: formatDateBr(item.sourceDate),
            sources,
          }
        }),
        note: 'A página 1 imprime o resumo (ou o texto integral) e, quando não cabe, aponta para cá; o texto integral de cada item da pesquisa fica nesta tabela.',
      }
    : null

const buildSourcesSection = ({ snapshot, research }) => {
  const items = []
  items.push({
    kind: 'teqo',
    label: `Leitura read-only em ${formatDateTimeBr(snapshot.meta?.readAt)} (${snapshot.meta?.database ?? 'produção'})`,
    date: snapshot.meta?.readAt,
  })
  for (const item of research.items) {
    items.push({
      kind: 'web',
      label: item.label,
      url: item.sourceUrl,
      date: item.sourceDate,
    })
    for (const extra of item.extraSources ?? []) {
      items.push({
        kind: 'web',
        label: extra.label ?? `${item.label} — fonte adicional`,
        url: extra.url,
        date: extra.date,
      })
    }
  }
  for (const item of research.news) {
    items.push({ kind: 'web', label: item.title, url: item.url, date: item.publishedAt })
  }
  for (const item of research.approach ?? []) {
    items.push({
      kind: 'web',
      label: `Abordagem — ${item.topic}${item.persona ? ` (${item.persona})` : ''}`,
      url: item.sourceUrl,
      date: item.sourceDate,
    })
  }
  const listLabels = {
    demography: 'Demografia',
    economy: 'Economia',
    transport: 'Transporte',
    opposition: 'Oposição',
    alliances: 'Dobradinhas',
  }
  for (const listKey of Object.keys(listLabels)) {
    for (const item of research[listKey] ?? []) {
      items.push({
        kind: 'web',
        label: `${listLabels[listKey]} — ${item.topic}`,
        url: item.sourceUrl,
        date: item.sourceDate,
      })
    }
  }

  return [
    buildResearchAnswersTable(research),
    {
      kind: 'sources',
      title: 'Fontes e limites',
      items,
      limits: [
        `Base Teqo: leitura read-only em ${formatDateTimeBr(snapshot.meta?.readAt)} — o PDF é datado e o dado envelhece (snapshot do momento).`,
        'Web: cada item carrega data + URL; o que não veio com fonte virou lacuna.',
        '2º turno: números oficiais do artefato TSE 2026 (presidente por seção, agregado à unidade); X₁/X₂ são votos em jogo, não transferência garantida — cenário hipotético.',
        'Não existe voto por bairro/seção — o relatório não inventa granularidade.',
        'Abordagem sugerida é análise das personas ancorada nas fontes listadas item a item, não fato verificado além delas.',
        'Oposição: cada linha é fato publicado com URL + data; o PDF não afirma culpa nem orienta ataque pessoal — use como contraste ancorado.',
      ],
    },
  ].filter(Boolean)
}

const SNAPSHOT_REQUIRED_GROUPS = ['pledges', 'leaderships', 'advisors']

const assertSnapshotShape = (snapshot) => {
  if (!snapshot?.municipality?.slug || !snapshot?.municipality?.name) {
    throw new Error('Snapshot inválido: falta municipality.slug/name — regenere com o extrator.')
  }
  for (const group of SNAPSHOT_REQUIRED_GROUPS) {
    if (!(group in snapshot)) {
      throw new Error(
        `Snapshot inválido: falta "${group}" — extraia de novo com o mesmo SHA do builder.`,
      )
    }
  }
}

export const buildCityReport = ({
  snapshot,
  research,
  generatedAt = new Date(),
  textFallback = 'full',
}) => {
  assertSnapshotShape(snapshot)
  const generatedAtIso = generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt

  const sections = [
    {
      id: 'segundo-turno',
      title: '2º turno no município (Lula × Flávio)',
      blocks: buildSecondRoundSection({ snapshot, research }),
    },
    {
      id: 'rede',
      title: 'Rede e lideranças',
      blocks: buildNetworkSection({ snapshot, research }),
    },
    {
      id: 'conjuntura',
      title: 'Conjuntura',
      blocks: buildConjunctureSection({ snapshot, research }),
    },
    {
      id: 'demografia',
      title: 'Demografia',
      blocks: buildDemographicsSection({ snapshot, research }),
    },
    {
      id: 'economia',
      title: 'Atividade econômica (pesquisa)',
      blocks: buildEconomySection({ research }),
    },
    {
      id: 'transporte',
      title: 'Transporte e conexões (pesquisa)',
      blocks: buildTransportSection({ research }),
    },
    { id: 'noticias', title: 'Notícias e imprensa local', blocks: buildNewsSection({ research }) },
    {
      id: 'abordagem',
      title: 'Abordagem sugerida (pesquisa)',
      blocks: buildApproachSection({ research }),
    },
    {
      id: 'fontes',
      title: 'Fontes e limites',
      blocks: buildSourcesSection({ snapshot, research }),
    },
  ].map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` }))

  return {
    meta: {
      title: REPORT_TITLE,
      municipalityName: snapshot.municipality.name,
      municipalitySlug: snapshot.municipality.slug,
      region: snapshot.municipality.region,
      generatedAt: generatedAtIso,
      generatedAtLabel: formatDateBr(generatedAtIso),
      readAt: snapshot.meta?.readAt ?? null,
      readAtLabel: formatDateTimeBr(snapshot.meta?.readAt),
      database: snapshot.meta?.database ?? null,
      codeSha: snapshot.meta?.codeSha ?? null,
      actorRole: snapshot.meta?.actorRole ?? null,
      researchedAt: research.researchedAt,
    },
    page1: buildPageOne({ snapshot, research, generatedAt: generatedAtIso, textFallback }),
    sections,
  }
}
