/**
 * Content model of the city report (C163). Pure: takes the snapshot (base Teqo,
 * read-only), the validated research JSON and the emendas result, and returns
 * the block tree both the PDF and the companion `.md` render.
 *
 * The order of the blocks is the product contract (intention plan, "Estrutura
 * do relatório"): page 1 is the one-look summary; the numbered sections after it
 * are the deep dive. "Sem fonte, não publica": every claim carries its source;
 * what is missing becomes an explicit gap.
 */

import { getMunicipalityFederalBaseline } from '../../src/lib/bahiaElectionAggregates.ts'
import { formatEngagementLevelLabel } from '../../src/lib/engagementLevel.ts'
import { getMunicipalityVoteRank } from '../../src/lib/municipalityVoteRank.ts'
import { activityStatusLabels } from '../../src/lib/schemas/activity.ts'
import {
  campaignDemandKindLabels,
  campaignDemandStatusLabels,
} from '../../src/lib/schemas/campaignDemand.ts'
import { municipalityUpdatePolarityLabels } from '../../src/lib/schemas/municipalityUpdate.ts'
import { SPEECH_TOPICS } from '../../src/lib/speechFacets.ts'
import {
  formatVoteEstimateEndpointsLabel,
  voteEstimateScenarioLabels,
} from '../../src/lib/voteEstimate.ts'
import { supportStatusLabels } from '../../src/utilities/leadership/leadershipLabels.ts'
import {
  municipalityPriorityLabels,
  politicalTrendLabels,
  territorialClassLabels,
} from '../../src/utilities/municipality/municipalityLabels.ts'

import {
  formatDateBr,
  formatDateTimeBr,
  formatFreshness,
  formatInteger,
  formatMoneyCompact,
  formatPercent,
  formatRank,
} from './cityReportFormat.mjs'
import { researchItemById } from './cityReportResearch.mjs'
import { buildTerritoryPanorama } from './cityReportTerritory.mjs'

const REPORT_TITLE = 'Relatório de cidade — pré-viagem'

const GAP_COPY = 'Lacuna explícita — não preencher por inferência.'

const ADVERTENCIA_DEFESO =
  'Ano eleitoral: empenho não é pagamento. O bloco de emendas mostra a fase (empenhada, liquidada, paga, restos).'

const GAP_CALLOUT_LIMIT = 4
const SIGNAL_EXCERPT_MAX = 180
const SPEECH_SUMMARY_MAX = 220
const SPEECH_MENTION_MAX = 220

/**
 * Page-1 content budget (OPS120). The summary reuses the free text of the
 * research checklist; without a cap, long answers (pesquisa cheia) blow the
 * one-page guard. Page 1 is "uma olhada" — cap the excerpt and the joined
 * lists, and let the deepening sections carry the full text. Same spirit as
 * the dossier caps (E16): explicit ceiling, never squeeze the layout.
 */
const PAGE_ONE_ANSWER_MAX = 90
/** The "Quem é quem" values share a 2-column stat cell — tighter than the rest. */
const PAGE_ONE_WHO_MAX = 30
/** Oposição card: the source suffix ("fonte: pesquisa web · data") is appended after the cut. */
const PAGE_ONE_RISK_MAX = 70
const PAGE_ONE_LIST_LIMIT = 2
/** Joined name lists (Responsável, Dobradinhas) — one line in the strip/stat row. */
const PAGE_ONE_NAMES_MAX = 20

/** Truncates with an explicit ellipsis; short text passes through untouched. */
const excerpt = (text, max) => {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value
}

/**
 * First `limit` values joined, capped to `max` chars; the remainder is always
 * made explicit (`e mais N`) so the count survives the excerpt.
 */
const joinLimited = (values, limit, max) => {
  const items = values.filter(Boolean)
  const shown = items.slice(0, limit)
  const remaining = items.length - shown.length
  return `${excerpt(shown.join(', '), max)}${remaining > 0 ? ` e mais ${remaining}` : ''}`
}

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

/**
 * Página 1 = resumo de uma olhada: a fonte do item entra compacta (pesquisa web
 * + data). A URL completa de cada item é preservada em "Fontes e limites" —
 * imprimir a URL por linha estoura a página 1 com a pesquisa real (ver guarda
 * de overflow do builder). O texto também entra capado (`PAGE_ONE_ANSWER_MAX`):
 * a resposta integral é do aprofundamento, não do resumo de uma página.
 */
const researchAnswerItem = (research, id, max = PAGE_ONE_ANSWER_MAX) => {
  const item = researchItemById(research, id)
  if (!item) return null
  return {
    text: excerpt(item.answer, max),
    source: sourceWeb(null, null, item.sourceDate),
  }
}

const gapCallout = (gaps, title = 'Lacunas desta seção') => {
  if (!gaps.length) return null
  const shown = gaps.slice(0, GAP_CALLOUT_LIMIT)
  const remaining = gaps.length - shown.length
  return {
    kind: 'callout',
    tone: 'gap',
    title,
    body: [
      GAP_COPY,
      ...shown.map((gap) => `${gap.label ? `${gap.label}: ` : ''}${gap.reason}`),
      ...(remaining > 0 ? [`e mais ${remaining} ponto(s) sem leitura.`] : []),
    ],
  }
}

const buildIdentificationItems = ({ municipality, goal, conjuncture, advisors }) => [
  { label: 'Território', value: municipality.region },
  {
    label: 'Prioridade',
    value: conjuncture ? (municipalityPriorityLabels[conjuncture.priority] ?? '—') : '—',
  },
  {
    label: 'Classe',
    value: goal ? (territorialClassLabels[goal.territorialClass.class] ?? '—') : '—',
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
      ? joinLimited(
          advisors.map((advisor) => advisor.name),
          PAGE_ONE_LIST_LIMIT,
          PAGE_ONE_NAMES_MAX,
        )
      : 'Sem responsável',
  },
]

const buildElectoralKpis = ({ electoral, conjuncture }) => {
  const expectedVotes = conjuncture?.expectedVotes ?? null
  return [
    {
      label: 'Votos em 2022',
      value: formatInteger(electoral.rank2022?.votes ?? null),
      hint: electoral.rank2022
        ? `% do próprio voto: ${formatPercent(electoral.rank2022.share)}`
        : null,
    },
    { label: 'Rank no estado', value: formatRank(electoral.rank2022) },
    {
      label: 'Expectativa de votos',
      value: formatInteger(expectedVotes?.central ?? null),
      hint: expectedVotes
        ? (formatVoteEstimateEndpointsLabel(expectedVotes) ?? 'Cenários da base')
        : 'sem registro na base',
    },
  ]
}

const buildWhoRows = ({ leaderships, advisors, conjuncture }, research, prefeito) => {
  const rows = []
  const simpleAnswers = [
    { id: 'prefeito', label: 'Prefeito(a)', item: prefeito },
    { id: 'vice', label: 'Vice', item: researchAnswerItem(research, 'vice', PAGE_ONE_WHO_MAX) },
    {
      id: 'relacao_campo',
      label: 'Relação com o campo',
      item: researchAnswerItem(research, 'relacao_campo', PAGE_ONE_WHO_MAX),
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
    ? joinLimited(
        conjuncture.stateDeputies.map((deputy) => deputy.name),
        PAGE_ONE_LIST_LIMIT,
        PAGE_ONE_NAMES_MAX,
      )
    : null
  rows.push({ label: 'Dobradinhas', value: dobradinhas ?? 'sem registro na base' })
  const vereadores = researchAnswerItem(research, 'vereadores', PAGE_ONE_WHO_MAX)
  if (vereadores) {
    rows.push({ label: 'Vereadores/dobradas', value: vereadores.text, source: vereadores.source })
  }
  return rows
}

const buildDeliveredKpis = ({ speeches }, research, emendas) => {
  const emendasOk = emendas?.status === 'ok'
  return [
    {
      label: 'Emendas aportadas',
      value: emendasOk ? formatMoneyCompact(emendas.totals.empenhado) : 'Sem fonte oficial',
      hint: emendasOk
        ? `Pago: ${formatMoneyCompact(emendas.totals.pago)} · ${emendas.rows.length} emenda(s)`
        : emendas
          ? 'sem emenda atribuível ao município'
          : null,
    },
    {
      label: 'Falas no acervo',
      value: `${formatInteger(speeches.totalCount)} trecho(s)`,
      hint: 'Busca por município no acervo (C153/C155)',
    },
    {
      label: 'Notícias (≤90 dias)',
      value: `${formatInteger(research.news.length)} matéria(s)`,
      hint: 'Pesquisa web datada',
    },
  ]
}

const buildAnnouncePair = (research) => {
  const relacao = researchAnswerItem(research, 'relacao_campo', PAGE_ONE_WHO_MAX)
  const items = []
  if (relacao) {
    items.push({ text: `Relação local confirmada: ${relacao.text}`, source: relacao.source })
  }
  items.push(
    { text: 'Pauta ou entrega com fonte e data ao lado da frase.' },
    { text: 'Agradecimento institucional com papel confirmado.' },
    { text: 'Compromisso novo com escopo que a campanha cumpre.' },
  )
  return {
    kind: 'pair',
    left: { title: 'O que anunciar agora', tone: 'decision', items },
    right: {
      title: 'O que NÃO anunciar',
      tone: 'risk',
      items: [
        { text: 'Empenho tratado como pagamento (defeso).' },
        { text: 'Nada sem fonte ("sem fonte, não publica").' },
        { text: 'Dado staff-only fora da coordenação.' },
        { text: 'PII além do necessário.' },
      ],
    },
    note: ADVERTENCIA_DEFESO,
  }
}

const buildRiskCards = ({ leaderships, advisors, conjuncture }, research) => {
  const opposition =
    researchAnswerItem(research, 'disputa_local', PAGE_ONE_RISK_MAX) ??
    researchAnswerItem(research, 'quem_investe', PAGE_ONE_RISK_MAX)
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
        ? joinLimited(conjuncture.risks, PAGE_ONE_LIST_LIMIT, PAGE_ONE_ANSWER_MAX)
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

/**
 * Page-1 gaps: the emendas gap is not repeated here — it is carried by the
 * "O que Solla entregou" KPI and, when the agent researched it, by the web
 * evidence block ("nunca zero silencioso" stays explicit on those surfaces).
 */
const collectPageOneGaps = ({ electoral, prefeito }) => {
  const gaps = []
  if (!prefeito) gaps.push({ id: 'prefeito', label: 'Prefeito(a)', reason: 'Não pesquisado.' })
  if (!electoral.rank2022) gaps.push({ id: 'rank', label: 'Rank', reason: 'Fora do artefato TSE.' })
  return gaps
}

const buildEmendasEvidenceBlock = (research, emendas) => {
  if (emendas?.status === 'ok') return null
  const evidence = researchAnswerItem(research, 'emendas_web')
  if (!evidence) return null
  return {
    kind: 'callout',
    tone: 'decision',
    title: 'Emendas — indícios web (sem atribuição oficial ao município)',
    body: [evidence.text, 'Não somar região/polo como emenda da cidade; URLs nas fontes.'],
  }
}

const buildPageOne = ({ snapshot, research, emendas, generatedAt }) => {
  const prefeito = researchAnswerItem(research, 'prefeito', PAGE_ONE_WHO_MAX)
  const gapCalloutBlock = gapCallout(
    collectPageOneGaps({ electoral: snapshot.electoral, prefeito }),
    'Pontos sem leitura',
  )

  return {
    blocks: [
      { kind: 'strip', items: buildIdentificationItems(snapshot) },
      {
        kind: 'grid',
        columns: 2,
        cells: [
          {
            title: 'Conta eleitoral 2022',
            blocks: [{ kind: 'kpis', items: buildElectoralKpis(snapshot) }],
          },
          {
            title: 'Quem é quem',
            blocks: [{ kind: 'stats', rows: buildWhoRows(snapshot, research, prefeito) }],
          },
        ],
        sources: [
          sourceTeqo(
            'base Teqo — TSE 2022, expectativa de votos e lideranças',
            snapshot.meta?.readAt,
          ),
        ],
      },
      {
        kind: 'kpis',
        title: 'O que Solla entregou',
        items: buildDeliveredKpis(snapshot, research, emendas),
        sources: [
          sourceOfficial(
            'Portal da Transparência — emendas',
            emendas?.sourceUrl,
            emendas?.consultedAt,
          ),
          sourceTeqo('base Teqo — acervo de falas', snapshot.meta?.readAt),
          sourceWeb('pesquisa web — imprensa', null, research.researchedAt),
        ],
      },
      buildEmendasEvidenceBlock(research, emendas),
      buildAnnouncePair(research),
      {
        kind: 'cards',
        title: 'Riscos — oposição/disputa local',
        items: buildRiskCards(snapshot, research),
      },
      gapCalloutBlock,
      {
        kind: 'footerNote',
        text: `Gerado em ${formatDateBr(generatedAt)} · snapshot do momento · fontes item a item nas seções de aprofundamento.`,
      },
    ].filter(Boolean),
  }
}

const buildElectoralSection = ({ snapshot }) => {
  const { municipality, electoral } = snapshot
  const years = [2014, 2018, 2022]
  const rows = years.map((year) => {
    const votes = electoral.series.find((point) => point.year === year)?.votes ?? null
    const rank = getMunicipalityVoteRank(municipality.slug, year)
    const validVotes = getMunicipalityFederalBaseline(municipality.slug).validVotesByYear[
      String(year)
    ]
    return {
      year: String(year),
      votes: votes === null ? '—' : formatInteger(votes),
      share: rank ? formatPercent(rank.share) : '—',
      rankLabel: formatRank(rank),
      validVotes: validVotes ? formatInteger(validVotes) : '—',
    }
  })

  const gap = electoral.series.length
    ? null
    : {
        id: 'serie',
        label: 'Série 2014/2018/2022',
        reason: 'Sem série na base para este município.',
      }

  return [
    {
      kind: 'table',
      title: 'Conta eleitoral completa',
      columns: [
        { key: 'year', label: 'Ano' },
        { key: 'votes', label: 'Votos', numeric: true },
        { key: 'share', label: '% do próprio voto', numeric: true },
        { key: 'rankLabel', label: 'Rank', numeric: true },
        { key: 'validVotes', label: 'Válidos do cargo', numeric: true },
      ],
      rows,
      sources: [sourceTeqo('base Teqo — artefato TSE 2014/2018/2022', snapshot.meta?.readAt)],
    },
    gap ? gapCallout([gap], 'Lacunas desta seção') : null,
  ].filter(Boolean)
}

const COMPETITOR_SERIES_YEARS = ['2014', '2018', '2022']

const buildCompetitorsTable = ({ title, rows, referenceYear, readAt }) => ({
  kind: 'table',
  title,
  columns: [
    { key: 'name', label: 'Candidato' },
    { key: 'party', label: 'Partido' },
    ...COMPETITOR_SERIES_YEARS.map((year) => ({ key: `y${year}`, label: year, numeric: true })),
  ],
  rows: rows.map((row) => ({
    name: row.name,
    party: row.party ?? '—',
    ...Object.fromEntries(
      COMPETITOR_SERIES_YEARS.map((year) => [
        `y${year}`,
        year in (row.votesByYear ?? {}) ? formatInteger(row.votesByYear[year]) : '—',
      ]),
    ),
  })),
  note: `Top 5 por votos de ${referenceYear} no município (TSE, 1º turno, votos nominais); “—” = sem votos na série.`,
  sources: [sourceTeqo('base Teqo — TSE 2014/2018/2022', readAt)],
})

const buildOppositionBlock = (research) => {
  const entries = research.opposition ?? []
  if (!entries.length) return null
  return {
    kind: 'table',
    title: 'Oposição — o que usar com fonte (pesquisa)',
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

const buildCompetitorsSection = ({ snapshot, research }) => {
  const competitors = snapshot.competitors ?? { referenceYear: 2022, federal: [], state: [] }
  const offices = [
    { key: 'federal', label: 'Deputado federal' },
    { key: 'state', label: 'Deputado estadual' },
  ]
  const blocks = offices.map((office) => {
    const rows = competitors[office.key] ?? []
    return rows.length
      ? buildCompetitorsTable({
          title: `Concorrentes — ${office.label}`,
          rows,
          referenceYear: competitors.referenceYear ?? 2022,
          readAt: snapshot.meta?.readAt,
        })
      : {
          kind: 'callout',
          tone: 'gap',
          title: `Concorrentes — ${office.label}`,
          body: ['Sem série de concorrentes na base para este município.', GAP_COPY],
        }
  })

  const preCandidates = research.preCandidates ?? []
  blocks.push(
    preCandidates.length
      ? {
          kind: 'table',
          title: 'Prováveis candidatos do campo do prefeito em 2026 (pesquisa)',
          columns: [
            { key: 'name', label: 'Nome' },
            { key: 'office', label: 'Cargo' },
            { key: 'party', label: 'Partido' },
            { key: 'support', label: 'Apoio' },
            { key: 'source', label: 'Fonte' },
          ],
          rows: preCandidates.map((item) => {
            const sources = sourcesOf(item)
            return {
              name: item.name,
              office: item.office,
              party: item.party ?? '—',
              support: withInlineSources(item.support ?? '—', sources),
              source: formatDateBr(item.sourceDate),
              sources,
            }
          }),
          note: 'Nomes declarados em fontes datadas; o histórico de votos vem das tabelas acima quando o nome aparece na base.',
          sources: preCandidates.map((item) => ({
            kind: 'web',
            label: `${item.name} — ${item.office}`,
            url: item.sourceUrl,
            date: item.sourceDate,
          })),
        }
      : {
          kind: 'callout',
          tone: 'gap',
          title: 'Prováveis candidatos do campo do prefeito em 2026',
          body: ['Nenhum pré-candidato pesquisado com fonte.', GAP_COPY],
        },
  )

  const opposition = buildOppositionBlock(research)
  if (opposition) blocks.push(opposition)

  return blocks
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
      sources: [sourceTeqo('base Teqo — lideranças e pledges', snapshot.meta?.readAt)],
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
    sources: [sourceTeqo('base Teqo — pledges', snapshot.meta?.readAt)],
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
      note: 'Com quem Solla soma na cidade em 2026 (estadual/federal, chapa e lideranças que transferem voto) — insumo direto da abordagem sugerida; cada item com URL.',
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
    {
      label: 'Expectativa de votos',
      value: conjuncture?.expectedVotes
        ? ['pessimistic', 'central', 'optimistic']
            .map(
              (scenario) =>
                `${voteEstimateScenarioLabels[scenario]} ${formatInteger(conjuncture.expectedVotes[scenario])}`,
            )
            .join(' · ')
        : '—',
      hint: 'Cenários da base',
    },
  ]

  const blocks = [
    {
      kind: 'stats',
      title: 'Conjuntura',
      rows,
      sources: [sourceTeqo('base Teqo — estratégia do município', snapshot.meta?.readAt)],
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
  if (conjuncture?.budgetNotes) {
    blocks.push({
      kind: 'prose',
      title: 'Emendas aportadas (nota da base)',
      text: conjuncture.budgetNotes,
      sources: [sourceTeqo('base Teqo — nota manual', snapshot.meta?.readAt)],
    })
  }

  blocks.push(
    ...buildSourcedListBlocks({
      title: 'Investimentos e obras (pesquisa)',
      note: 'O que Solla, o governo do estado e o federal entregaram, anunciaram ou têm em obra no município e na região — com fase/valor quando a fonte informar; cada item com URL. Empenho ≠ pagamento.',
      items: research?.investments ?? [],
    }),
  )

  return blocks
}

const buildSignalsSection = ({ snapshot }) => {
  const { signals } = snapshot
  if (!signals.rows.length) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title: 'Sinais recentes',
        body: ['Nenhum sinal registrado para o município na base.', GAP_COPY],
      },
    ]
  }
  return [
    {
      kind: 'table',
      title: 'Sinais recentes',
      columns: [
        { key: 'date', label: 'Data' },
        { key: 'polarity', label: 'Polaridade' },
        { key: 'flags', label: 'Sinal' },
        { key: 'responsible', label: 'Responsável' },
        { key: 'excerpt', label: 'Resumo' },
      ],
      rows: signals.rows.map((row) => ({
        date: formatDateBr(row.createdAt),
        polarity: municipalityUpdatePolarityLabels[row.polarity] ?? '—',
        flags: [row.urgent ? 'Urgente' : null, row.adversarySignal ? 'Adversário' : null]
          .filter(Boolean)
          .join(' · '),
        responsible: row.responsibleName ?? '—',
        excerpt: row.body ? row.body.slice(0, SIGNAL_EXCERPT_MAX) : '—',
      })),
      note:
        signals.totalCount > signals.rows.length
          ? `Mostrando ${signals.rows.length} de ${signals.totalCount} sinais (mesmo corte do dossiê).`
          : null,
      sources: [sourceTeqo('base Teqo — sinais do município', snapshot.meta?.readAt)],
    },
  ]
}

const buildDemandsVisitsSection = ({ snapshot }) => {
  const { demands, activities } = snapshot
  const blocks = []

  if (demands.rows.length) {
    blocks.push({
      kind: 'table',
      title: 'Demandas',
      columns: [
        { key: 'title', label: 'Demanda' },
        { key: 'kind', label: 'Tipo' },
        { key: 'status', label: 'Status' },
        { key: 'updatedAt', label: 'Última atualização' },
      ],
      rows: demands.rows.map((row) => ({
        title: row.title,
        kind: campaignDemandKindLabels[row.kind] ?? row.kind,
        status: campaignDemandStatusLabels[row.status] ?? row.status,
        updatedAt: formatDateBr(row.updatedAt),
      })),
      note:
        demands.totalCount > demands.rows.length
          ? `Mostrando ${demands.rows.length} de ${demands.totalCount} demandas.`
          : null,
      sources: [sourceTeqo('base Teqo — demandas', snapshot.meta?.readAt)],
    })
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'gap',
      title: 'Demandas',
      body: ['Nenhuma demanda vinculada ao município na base.', GAP_COPY],
    })
  }

  const activityRows = [
    ...activities.upcoming.map((activity) => ({ ...activity, bucket: 'Agendada' })),
    ...activities.recent.map((activity) => ({ ...activity, bucket: 'Realizada' })),
  ]
  if (activityRows.length) {
    blocks.push({
      kind: 'table',
      title: 'Visitas e agenda',
      columns: [
        { key: 'bucket', label: 'Situação' },
        { key: 'date', label: 'Data' },
        { key: 'title', label: 'Atividade' },
        { key: 'locality', label: 'Local' },
        { key: 'status', label: 'Status' },
      ],
      rows: activityRows.map((activity) => ({
        bucket: activity.bucket,
        date: activity.startAt ? formatDateTimeBr(activity.startAt) : '—',
        title: activity.title,
        locality: activity.locality ?? '—',
        status: activityStatusLabels[activity.status] ?? activity.status,
      })),
      sources: [sourceTeqo('base Teqo — atividades', snapshot.meta?.readAt)],
    })
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'gap',
      title: 'Visitas e agenda',
      body: ['Nenhuma atividade vinculada ao município na base.', GAP_COPY],
    })
  }

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

/**
 * YouTube link starts at the Câmara excerpt of the speech (`excerptTMs` −
 * session start), calibrated by the live video: the 2018-03-13 session video
 * starts ~37s after `eventStartAt`, so the excerpt at 645s plays at 608s
 * (`youtube.com/live/2cX_gKkJH7Q?t=608`, checked in the browser). `speechAt` is
 * the API slot clock, not when the deputy speaks.
 */
const YOUTUBE_VIDEO_OFFSET_SECONDS = 37

const withYoutubeTimestamp = (url, offsetSeconds) => {
  if (!url) return null
  if (!Number.isFinite(offsetSeconds) || offsetSeconds <= 0) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Math.floor(offsetSeconds)}s`
}

const youtubeStartSeconds = (row) =>
  Number.isFinite(row.youtubeExcerptStartSeconds)
    ? Math.max(0, Math.floor(row.youtubeExcerptStartSeconds) - YOUTUBE_VIDEO_OFFSET_SECONDS)
    : null

const speechTopicLabel = (value) =>
  SPEECH_TOPICS.find((topic) => topic.value === value)?.label ?? value

/**
 * Why the row is in the table decides the "mention" text: a city row is tagged
 * with the município in the acervo; a region row is tagged with another
 * município of the same Território; a theme row is selected by topic and was
 * NOT necessarily tagged with any of them — so it shows the theme, never a
 * false "menção ao município".
 */
const speechMention = (row, variant) => {
  if (row.mentionExcerpt) return row.mentionExcerpt.slice(0, SPEECH_MENTION_MAX)
  const count = row.mentionedMunicipalityCount
  if (variant === 'region') {
    return count
      ? `Marcada no acervo com município da região — o nome não aparece nos trechos (a fala cita ${formatInteger(count)} municípios).`
      : 'Marcada no acervo com município da região — trecho não localizado.'
  }
  return count
    ? `Marcada no acervo — nome não localizado nos trechos (a fala cita ${formatInteger(count)} municípios).`
    : 'Marcada no acervo — trecho não localizado.'
}

const projectSpeechTableRow = (row, variant) => {
  const base = {
    date: formatDateBr(row.speechAt),
    phase: row.phase ?? '—',
    description: row.summary ? row.summary.slice(0, SPEECH_SUMMARY_MAX) : '—',
    video: row.youtubeUrl
      ? withYoutubeTimestamp(row.youtubeUrl, youtubeStartSeconds(row))
      : (row.vodPlaybackUrl ?? '—'),
    transcript: row.officialTextUrl ?? '—',
  }
  if (variant === 'theme') {
    const labels = (row.topics ?? []).map(speechTopicLabel).join(' · ')
    return { ...base, topics: labels || '—' }
  }
  return { ...base, mention: speechMention(row, variant) }
}

const buildSpeechTable = ({ title, rows, variant = 'city', cityLabel, note, readAt }) => {
  const middle =
    variant === 'theme'
      ? { key: 'topics', label: 'Tema', width: 27 }
      : {
          key: 'mention',
          label: variant === 'region' ? 'Município da região citado' : `Menção a ${cityLabel}`,
          width: 27,
        }
  return {
    kind: 'table',
    title,
    columns: [
      { key: 'date', label: 'Data', width: 9 },
      { key: 'phase', label: 'Fase', width: 10 },
      { key: 'description', label: 'O que é', width: 32 },
      middle,
      { key: 'video', label: 'Vídeo', width: 11 },
      { key: 'transcript', label: 'Transcrição', width: 11 },
    ],
    rows: rows.map((row) => projectSpeechTableRow(row, variant)),
    note,
    sources: [sourceTeqo('base Teqo — acervo C153/C155', readAt)],
  }
}

const buildSpeechesSection = ({ snapshot }) => {
  const { speeches, municipality } = snapshot
  const cityLabel = municipality?.name ?? 'o município'
  const cityRows = speeches.rows ?? []
  const region = speeches.region ?? { label: null, rows: [] }
  const topics = speeches.topics ?? { themes: [], rows: [] }
  const regionRows = region.rows ?? []
  const themeRows = topics.rows ?? []

  if (!cityRows.length && !regionRows.length && !themeRows.length) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title: 'Acervo de falas',
        body: [
          `Busca por município no acervo: nenhum trecho encontrado (${formatInteger(speeches.totalCount)} no total) e nenhum recorte regional/temático.`,
          GAP_COPY,
        ],
      },
    ]
  }

  const blocks = []
  if (cityRows.length) {
    blocks.push(
      buildSpeechTable({
        title: 'Acervo de falas',
        rows: cityRows,
        variant: 'city',
        cityLabel,
        note: [
          '“O que é” = sumário oficial da Câmara; “Menção” = passagem que cita o município ou, quando o nome não aparece nos trechos, a marcação do acervo (C153/C155) com o nº de municípios da fala; “Vídeo” e “Transcrição” = links oficiais da Câmara quando existem.',
          speeches.totalCount > cityRows.length
            ? `Mostrando ${cityRows.length} de ${speeches.totalCount} falas.`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
        readAt: snapshot.meta?.readAt,
      }),
    )
  } else {
    blocks.push({
      kind: 'callout',
      tone: 'info',
      title: 'Acervo de falas',
      body: [
        `Nenhuma fala cita ${cityLabel} diretamente; abaixo vão o recorte da região e os temas do mandato (não somar região/polo como fala da cidade).`,
      ],
    })
  }

  if (regionRows.length) {
    blocks.push(
      buildSpeechTable({
        title: `Acervo — menções à região (${region.label ?? 'Território de Identidade'})`,
        rows: regionRows,
        variant: 'region',
        note: `Falas marcadas no acervo com municípios do mesmo Território de Identidade (${region.label ?? 'região'}) — a região NÃO é a cidade; use como contexto, nunca some à conta do município.`,
        readAt: snapshot.meta?.readAt,
      }),
    )
  }

  if (themeRows.length) {
    blocks.push(
      buildSpeechTable({
        title: 'Acervo — falas por tema regional',
        rows: themeRows,
        variant: 'theme',
        note: `Falas do mandato **selecionadas por tema** (${(topics.themes ?? [])
          .map(speechTopicLabel)
          .join(
            ', ',
          )}) — o critério é o tema, não uma menção ao município ou à região; use como repertório do tema, sem somar à conta da cidade.`,
        readAt: snapshot.meta?.readAt,
      }),
    )
  }

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

const buildNewsSection = ({ research }) => {
  const blocks = []
  if (research.news.length) {
    blocks.push({
      kind: 'table',
      title: 'Notícias internas e imprensa local',
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
      title: 'Notícias internas e imprensa local',
      body: [
        'Nenhuma matéria com fonte e data dentro da janela de 90 dias.',
        'Nenhum post interno relacionado ao município (a base não liga Post a município).',
        GAP_COPY,
      ],
    })
  }

  const newsGaps = research.gaps.filter((gap) => gap.id.startsWith('noticia_'))
  const callout = gapCallout(newsGaps, 'Notícias descartadas')
  if (callout) blocks.push(callout)
  return blocks
}

const buildRegionSection = ({ snapshot }) => {
  const panorama = buildTerritoryPanorama(snapshot.municipality.slug)
  if (!panorama) {
    return [
      {
        kind: 'callout',
        tone: 'gap',
        title: 'Panorama regional',
        body: ['Município fora do catálogo/artefato TSE.', GAP_COPY],
      },
    ]
  }
  return [
    {
      kind: 'stats',
      title: 'Panorama regional (Território de Identidade)',
      rows: [
        { label: 'Território', value: panorama.region },
        { label: 'Municípios no TI', value: formatInteger(panorama.municipalityCount) },
        { label: `Votos do TI em ${panorama.year}`, value: formatInteger(panorama.regionVotes) },
        {
          label: '% do voto do candidato no estado',
          value: formatPercent(panorama.regionShare),
        },
        {
          label: 'Posição do município no TI',
          value: `${formatInteger(panorama.municipalityRank)}º de ${formatInteger(panorama.municipalityTotalUnits)}`,
        },
        {
          label: 'Votos do município no TI',
          value: formatInteger(panorama.municipalityVotes),
        },
      ],
      sources: [sourceTeqo('artefato TSE commitado — leitura relativa', null)],
    },
  ]
}

/**
 * Page 1 caps the checklist answers; the full text of each item lives here, so
 * the cut never loses a sourced fact (OPS120).
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
        note: 'A página 1 resume e capa; o texto integral de cada item da pesquisa fica nesta tabela.',
      }
    : null

const buildSourcesSection = ({ snapshot, research, emendas }) => {
  const items = []
  items.push({
    kind: 'teqo',
    label: `Base Teqo — leitura read-only em ${formatDateTimeBr(snapshot.meta?.readAt)} (${snapshot.meta?.database ?? 'produção'})`,
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
  if (emendas?.status === 'ok') {
    items.push({
      kind: 'official',
      label: `Portal da Transparência — emendas de ${emendas.authorName ?? 'autor'} (${emendas.rows.length} registro(s))`,
      url: emendas.sourceUrl,
      date: emendas.consultedAt,
    })
  } else if (emendas) {
    items.push({
      kind: 'official',
      label: `Portal da Transparência — sem resultado utilizável (${emendas.reason})`,
      url: emendas.sourceUrl,
      date: emendas.consultedAt,
    })
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
    investments: 'Investimentos e obras',
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
        'Não existe voto por bairro/seção — o relatório não inventa granularidade.',
        'Efeito eleitoral de emenda é condicional ao crédito local — o PDF não promete voto.',
        'Emendas são lidas da fonte oficial em tempo de geração e não são persistidas na base.',
        'Quando a fonte oficial não atribui emenda ao município, indícios web (município, região ou polo) entram como evidência datada — nunca somados como emenda da cidade.',
        'Abordagem sugerida é análise das personas ancorada nas fontes listadas item a item, não fato verificado além delas.',
        'Oposição: cada linha é fato publicado com URL + data; o PDF não afirma culpa nem orienta ataque pessoal — use como contraste ancorado.',
      ],
    },
  ].filter(Boolean)
}

const SNAPSHOT_REQUIRED_GROUPS = [
  'electoral',
  'pledges',
  'leaderships',
  'advisors',
  'signals',
  'activities',
  'speeches',
  'demands',
]

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
  if (!Array.isArray(snapshot.electoral?.series)) {
    throw new Error('Snapshot inválido: electoral.series ausente — extraia de novo.')
  }
}

/**
 * Sections whose only content would be an empty-state callout are omitted
 * (sinais/demandas) so the report does not spend a page saying "nothing here".
 * Research sections keep their explicit gap callout — a missing source is a
 * product lacuna, not noise.
 */
const hasSectionData = (id, snapshot) => {
  if (id === 'sinais') return (snapshot.signals?.rows?.length ?? 0) > 0
  if (id === 'demandas') {
    return (
      (snapshot.demands?.rows?.length ?? 0) > 0 ||
      (snapshot.activities?.upcoming?.length ?? 0) + (snapshot.activities?.recent?.length ?? 0) > 0
    )
  }
  return true
}

export const buildCityReport = ({ snapshot, research, emendas, generatedAt = new Date() }) => {
  assertSnapshotShape(snapshot)
  const generatedAtIso = generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt

  const sections = [
    {
      id: 'conta-eleitoral',
      title: 'Conta eleitoral completa (2014/2018/2022)',
      blocks: buildElectoralSection({ snapshot }),
    },
    {
      id: 'concorrentes',
      title: 'Concorrentes no município (federal e estadual)',
      blocks: buildCompetitorsSection({ snapshot, research }),
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
    { id: 'sinais', title: 'Sinais recentes', blocks: buildSignalsSection({ snapshot }) },
    {
      id: 'demandas',
      title: 'Demandas e visitas',
      blocks: buildDemandsVisitsSection({ snapshot }),
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
    { id: 'falas', title: 'Acervo de falas', blocks: buildSpeechesSection({ snapshot }) },
    {
      id: 'noticias',
      title: 'Notícias internas e imprensa local',
      blocks: buildNewsSection({ research }),
    },
    {
      id: 'regiao',
      title: 'Panorama regional (Território de Identidade)',
      blocks: buildRegionSection({ snapshot }),
    },
    {
      id: 'abordagem',
      title: 'Abordagem sugerida (pesquisa)',
      blocks: buildApproachSection({ research }),
    },
    {
      id: 'fontes',
      title: 'Fontes e limites',
      blocks: buildSourcesSection({ snapshot, research, emendas }),
    },
  ]
    .filter((section) => hasSectionData(section.id, snapshot))
    .map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` }))

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
    page1: buildPageOne({ snapshot, research, emendas, generatedAt: generatedAtIso }),
    sections,
  }
}
