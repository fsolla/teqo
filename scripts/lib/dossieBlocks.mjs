/**
 * Content model for the C186 dossiê (owner). Turns the read-only snapshot, the
 * per-era research and the official sources (emendas, Câmara, health data) into
 * the semantic report the renderer prints — and derives the `bulletinFacts`
 * ledger (facts that already carry a source) that the boletim may reuse.
 *
 * Invariants enforced here: every delivered fact has URL+date; região/polo are
 * labelled and never summed into the município; empty sections are omitted.
 */

import { formatDateTimeBr, formatMoneyCompact } from './cityReportFormat.mjs'
import { CAREER_TIMELINE, DOSSIER_ERAS, DOSSIER_ERA_IDS, DOSSIER_SCOPE } from './dossieCareer.mjs'
import { dossierChecklistForEra } from './dossieResearch.mjs'
import {
  INSTITUTION_UNIT,
  MUNICIPALITY_UNIT,
  isSubjectUnit,
  resolveDossierUnit,
} from './dossieUnit.mjs'
import { stripInlineSources } from './reportText.mjs'

const phaseLabels = {
  autorizado: 'autorizado',
  empenhado: 'empenhado',
  liquidado: 'liquidado',
  pago: 'pago',
  restos: 'restos',
  nao_informado: 'não informada',
}

const emendasPhaseKeys = [
  ['empenhado', 'empenhado'],
  ['liquidado', 'liquidado'],
  ['pago', 'pago'],
  ['restos', 'restoPago'],
]

const isPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0

/**
 * Emenda execution rows, one per non-zero phase — never consolidating phases as
 * if equivalent (empenho ≠ pagamento). Sourced from the official portal.
 */
const emendaNumberRows = (emendas) => {
  const rows = []
  if (!emendas || emendas.status !== 'ok') return rows
  for (const row of emendas.rows ?? []) {
    for (const [phase, key] of emendasPhaseKeys) {
      if (!isPositive(row[key])) continue
      rows.push({
        object: row.functionName ?? row.type ?? 'Emenda',
        value: formatMoneyCompact(row[key]),
        year: row.year ? String(row.year) : null,
        phase,
        sphere: 'municipio',
        sourceUrl: emendas.sourceUrl ?? null,
        sourceDate: emendas.consultedAt ?? null,
      })
    }
  }
  return rows
}

const itemNumberRows = (items) => {
  const rows = []
  for (const item of items) {
    for (const number of item.numbers ?? []) {
      rows.push({
        object: number.label,
        value: number.value,
        year: number.year,
        phase: number.phase,
        sphere: item.sphere,
        sourceUrl: item.sourceUrl,
        sourceDate: item.sourceDate,
      })
    }
  }
  return rows
}

/**
 * BRL amounts written in the research copy ("R$ 1,2 mi", "R$ 1.299.027,30",
 * "R$ 150 mil"). Returns null for non-money values ("175" vagas/leitos), so a
 * count never enters a money chart.
 */
const parseMoneyBrl = (value) => {
  if (typeof value !== 'string') return null
  const match = /^R\$\s*([\d.,]+)\s*(mil|milh\S*|mi)?/i.exec(value.trim())
  if (!match) return null
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(amount)) return null
  const suffix = (match[2] ?? '').toLowerCase()
  if (suffix === 'mil') return amount * 1e3
  if (suffix) return amount * 1e6
  return amount
}

const moneyRows = (numberRows) =>
  numberRows
    .map((row) => ({ ...row, amount: parseMoneyBrl(row.value) }))
    .filter((row) => row.amount !== null)
const eraRecovery = {
  A: 'Biografia Câmara · DOU/acervo do Ministério da Saúde · pesquisa web datada',
  B: 'DOE-BA (DOOL) · notícias SESAB · Transparência Bahia · SIOPS/DATASUS',
  C: 'API Câmara · Portal da Transparência · Siga Brasil · acervo interno read-only',
}

const eraMethod = {
  A: 'Itens ligados ao município foram conferidos em fonte oficial e separados por esfera. Cargos técnicos e de gestão têm datas e objetos distintos — sem atribuição local sem documento contemporâneo.',
  B: 'A gestão estadual é lida por equipamento, política e obra; cada linha informa esfera e fonte. Região e polo não somam ao município.',
  C: 'Mandato, relatorias e execução financeira têm datas e estágios distintos. Empenho não é pagamento; o valor sempre acompanha a fase. A coleta na API da Câmara é limitada às páginas consultadas (não é um total): o que não foi coletado não aparece.',
}

const healthContext = (health) =>
  health?.status === 'ok'
    ? (health.items ?? []).map((item) => ({
        topic: item.topic,
        detail: item.detail,
        sourceUrl: item.sourceUrl,
        sourceDate: item.sourceDate,
      }))
    : []

/**
 * Câmara activity is national mandate context, not municipal evidence: the rows
 * carry an explicit scope label and never claim a municipal sphere.
 */
const camaraItemsAsActions = (camara, era) =>
  (camara?.status === 'ok' ? (camara.items ?? []) : []).map((item) => ({
    sphere: null,
    scopeLabel: 'mandato federal',
    year: item.year ? String(item.year) : null,
    title: item.title,
    detail: item.detail,
    sourceUrl: item.sourceUrl,
    sourceDate: item.sourceDate,
    era,
  }))

/**
 * @typedef {Object} DossierReport
 * @property {any} meta
 * @property {any} cover
 * @property {any[]} trajectory
 * @property {Array<{ id: string, label: string, period: string, subtitle: string, empty?: boolean, omitted?: boolean, method: string, recovery: string, numbers: any, actions: any, honors: any }>} eras
 * @property {{ facts: Array<{ label: string, text: string }> }} essentials
 * @property {{ bullets: Array<{ label: string|null, text: string }>, table: any[] }} betweenEras
 * @property {{ positions: any[], gaps: any[] }} defends
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   municipal: { label: string, items: any[], total: number },
 *   regional: { label: string, items: any[], total: number },
 *   context: any[],
 * }} region
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   lists: Array<{ key: string, label: string, sphere: string, items: any[], total: number, omitted: number }>,
 * }} reach
 * @property {{ items: any[], total: number, omitted: number, recorte?: number, topics?: string[] }} acervo
 * @property {{
 *   byEra: any[],
 *   byEraSphere: any[],
 *   bySphere: any[],
 *   byPhase: any[],
 *   byArea: any[],
 *   byYear: any[],
 *   acervoByYear: any[],
 *   gapsByEra: any[],
 *   moneyByPhase: any[],
 *   moneyByYear: any[],
 *   moneyProposals: any[],
 *   moneyTotals: any,
 *   totals: any,
 *   lines: string[],
 * }} [synthesis]
 * @property {{ title: string, paragraphs: string[], authored: boolean }} [opening]
 * @property {any[]} gaps
 * @property {any[]} news
 * @property {any} limits
 * @property {any[]} bulletinFacts
 * @property {any} [unit]
 */

/**
 * Builds the dossiê report model. Dispatches on the unit descriptor: the
 * municipality (C186) branch remains the default and byte-identical; the
 * institution branch (C187) shares helpers but has its own sections.
 *
 * @param {{
 *   snapshot: any,
 *   research: any,
 *   emendas?: any,
 *   camara?: any,
 *   health?: any,
 *   generatedAt?: Date,
 *   unit?: any,
 *   narrative?: any,
 * }} params
 * @returns {DossierReport}
 */
export const buildDossierReport = (params) =>
  isSubjectUnit(params?.unit) ? buildSubjectReport(params) : buildMunicipalityReport(params)
const buildMunicipalityReport = ({
  snapshot,
  research,
  emendas = null,
  camara = null,
  health = null,
  generatedAt = new Date(),
  narrative = null,
}) => {
  const municipality = snapshot.municipality ?? {}
  const municipalityName = municipality.name ?? municipality.slug ?? 'Município'
  const region = municipality.region ?? null
  const poleLine = region
    ? `Território de Identidade ${region} · recorte regional não somável ao município`
    : 'Recorte regional não somável ao município'

  const allItems = research.items ?? []
  /** C209: defense items are the "O que Solla defende" dimension — they never
   * enter the evidence lists, the synthesis or the era tables. */
  const items = allItems.filter((item) => item.kind !== 'defense')
  const municipalItems = items.filter((item) => item.sphere === 'municipio')
  const regionalItems = items.filter((item) => item.sphere !== 'municipio')

  const eraRows = emendaNumberRows(emendas)
  const camaraActions = camaraItemsAsActions(camara, 'C')

  const researchActionsByEra = (era) =>
    items
      .filter((item) => item.era === era && item.id !== 'era_c_titulos')
      .map((item) => ({
        sphere: item.sphere,
        year: item.numbers?.[0]?.year ?? null,
        title: item.answer,
        detail: item.details,
        brief: item.brief ?? null,
        sourceUrl: item.sourceUrl,
        sourceDate: item.sourceDate,
      }))

  const eraSections = DOSSIER_ERAS.map((era) => {
    const eraItems = items.filter((item) => item.era === era.id)
    const ownActions = researchActionsByEra(era.id)
    const extraActions = era.id === 'C' ? camaraActions : []
    const numbers =
      era.id === 'C' ? [...eraRows, ...itemNumberRows(eraItems)] : itemNumberRows(eraItems)
    const honors =
      era.id === 'C'
        ? items
            .filter((item) => item.era === era.id && item.id === 'era_c_titulos')
            .map((item) => ({
              text: item.answer,
              brief: item.brief ?? null,
              sourceUrl: item.sourceUrl,
            }))
        : []
    const actions = [...ownActions, ...extraActions]
    const empty = numbers.length === 0 && actions.length === 0 && honors.length === 0
    return {
      ...era,
      method: eraMethod[era.id],
      recovery: eraRecovery[era.id],
      summary: buildEraSummary({
        era,
        items: eraItems,
        money: moneyRows(numbers),
        scopeLabel: 'no recorte municipal',
        unit: MUNICIPALITY_UNIT,
      }),
      narrative:
        typeof narrative?.eras?.[era.id] === 'string' && narrative.eras[era.id].trim()
          ? narrative.eras[era.id].trim()
          : null,
      numbers,
      actions,
      honors,
      empty,
      /** C209: a city era without a single sourced item gets no sheet — it stays
       * in the index/leitura with the explicit "sem evidência" note. */
      omitted: empty,
    }
  })

  const gaps = (research.gaps ?? []).map((gap) => ({
    label: gap.label ?? gap.id,
    reason: gap.reason,
    nextStep: 'Apurar em fonte primária.',
  }))

  const context = healthContext(health)

  const speechFacts = speechFactsFromRows(snapshot, 'municipio')
  const acervo = {
    items: speechFacts.map((fact) => ({
      id: fact.id,
      period: fact.year ?? '—',
      text: fact.headline,
      excerpt: fact.detail,
      sourceUrl: fact.sourceUrl,
    })),
    total: speechFacts.length,
    omitted: 0,
    /** The municipality-tagged recorte in the base (the extractor brings the latest sample). */
    recorte: snapshot.speeches?.totalCount ?? speechFacts.length,
    topics: snapshot.speeches?.topics?.themes ?? [],
  }
  const synthesis = buildDossierSynthesis({
    items,
    numberRows: [...eraRows, ...itemNumberRows(items)],
    speechFacts,
    gaps: research.gaps ?? [],
    acervoTotal: snapshot.speeches?.totalCount ?? speechFacts.length,
    scopeLabel: 'no recorte municipal',
    unit: MUNICIPALITY_UNIT,
  })

  const bulletinFacts = [
    ...allItems
      .filter((item) => Boolean(item.sourceUrl))
      .map((item) => ({
        id: item.id,
        era: item.era,
        sphere: item.sphere,
        area: item.area,
        defense: item.kind === 'defense',
        headline: stripInlineSources(item.answer),
        detail: item.details ? stripInlineSources(item.details) : null,
        brief: item.brief
          ? {
              title: stripInlineSources(item.brief.title),
              note: item.brief.note ? stripInlineSources(item.brief.note) : null,
            }
          : null,
        value: item.numbers?.[0]?.value ?? null,
        numberLabel: item.numbers?.[0]?.label ?? null,
        year: item.numbers?.[0]?.year ?? null,
        phase: item.numbers?.[0]?.phase ?? null,
        sourceUrl: item.sourceUrl,
        sourceDate: item.sourceDate,
      })),
    ...eraRows
      .filter((row) => row.sourceUrl)
      .map((row, index) => ({
        id: `emenda-${index}`,
        era: 'C',
        sphere: row.sphere,
        area: 'Emendas',
        headline: row.object,
        detail: null,
        value: row.value,
        numberLabel: row.object,
        year: row.year,
        phase: row.phase,
        sourceUrl: row.sourceUrl,
        sourceDate: row.sourceDate,
      })),
    ...speechFacts.map((fact) => ({
      ...fact,
      headline: stripInlineSources(fact.headline),
      sourcePanel: true,
    })),
  ]

  const generatedAtLabel = formatDateTimeBr(generatedAt)
  const readAtLabel = snapshot.meta?.readAt ? formatDateTimeBr(snapshot.meta.readAt) : '—'

  const narrativeParagraphs = Array.isArray(narrative?.opening)
    ? narrative.opening.filter((paragraph) => typeof paragraph === 'string' && paragraph.trim())
    : []
  const opening = {
    title:
      typeof narrative?.title === 'string' && narrative.title.trim()
        ? narrative.title.trim()
        : `O que Jorge Solla fez por ${municipalityName} e pela região`,
    paragraphs: narrativeParagraphs.length > 0 ? narrativeParagraphs : [synthesis.lines.join(' ')],
    authored: narrativeParagraphs.length > 0,
  }

  return {
    unit: MUNICIPALITY_UNIT,
    meta: {
      title: 'Dossiê Solla por cidade',
      municipalityName,
      region: region ?? '—',
      generatedAt,
      generatedAtLabel,
      readAtLabel,
    },
    cover: {
      kicker: 'Comunicação · pesquisa documental',
      series: 'Série municipal · BA',
      internalNote: 'INSUMO INTERNO',
      internalNoteSub: 'Não circular · não publicar',
      eyebrow: 'Dossiê de atuação pública',
      title: municipalityName,
      subtitle: 'O que Jorge Solla fez pela cidade e por seu recorte regional ao longo da carreira',
      territory: region ?? '—',
      pole: poleLine,
      howToUse:
        'Escolha um tema, confira a fonte ao lado da afirmação e trate toda lacuna como tarefa de apuração. Este arquivo não é texto final nem peça publicitária.',
      scope: DOSSIER_SCOPE,
      version: 'Documento de trabalho · versão 01',
    },
    trajectory: CAREER_TIMELINE,
    eras: eraSections,
    essentials: buildEssentials({
      items,
      gaps: research.gaps ?? [],
      synthesis,
      unit: MUNICIPALITY_UNIT,
      eras: eraSections,
    }),
    betweenEras: buildBetweenEras({
      items,
      gaps: research.gaps ?? [],
      synthesis,
      unit: MUNICIPALITY_UNIT,
      narrative,
    }),
    defends: buildDefends({
      items: allItems,
      gaps: research.gaps ?? [],
      defenseIds: defenseChecklistIds(MUNICIPALITY_UNIT),
    }),
    acervo,
    synthesis,
    opening,
    region: {
      ruleTitle: 'Região não é cidade. Não some os dois recortes.',
      ruleBody:
        'Um equipamento de referência ou uma política regional pode atender moradores do município sem constituir entrega exclusiva para ele. Atribuição só entra com alcance documentado.',
      municipal: {
        label: 'município',
        items: municipalItems,
        total: municipalItems.length,
      },
      regional: {
        label: 'região / polo',
        items: regionalItems,
        total: regionalItems.length,
      },
      context,
    },
    gaps,
    news: (research.news ?? []).map((row) => ({
      era: row.era ?? null,
      date: row.publishedAt,
      outlet: row.outlet ?? '—',
      title: row.title,
      summary: row.summary ?? null,
      url: row.url,
    })),
    limits: {
      coverage: [
        'O acervo interno de falas cobre 2011+; períodos anteriores dependem de fontes externas.',
        'Resultado de busca não prova ausência histórica.',
        'Emenda de bancada ou relator só recebe autoria quando a fonte a confirma.',
      ],
      editorial: [
        'Sem fonte, não publica.',
        'URL e data acompanham cada afirmação não trivial.',
        'Município, região e polo permanecem separados.',
        'Valor sempre informa a fase de execução.',
      ],
    },
    bulletinFacts,
  }
}

/* ------------------------------------------------------------------ *
 * Subject branch (C187 institution / C190 theme) — same owner, the    *
 * `subject` shape shares these sections; the vocabulary comes from    *
 * the unit descriptor.                                                *
 * ------------------------------------------------------------------ */

/**
 * Institution lists are never capped: the dossiê flows across as many sheets
 * as the content needs (the builder packs sheets by measured height). Same
 * shape as `capped` so the renderers stay uniform.
 */
const uncapped = (list) => ({ items: list, total: list.length, omitted: 0 })

/**
 * Speeches from the internal acervo (read-only snapshot) that the research did
 * not already carry: they are sourced evidence for the recorte, so they feed
 * the bulletin ledger too — never a second, unsourced fact. They enter as a
 * declared source panel (`sourcePanel: true`): counted in the one-pager, never
 * displacing a finding from the printed slots.
 */
const speechFactsFromRows = (snapshot, sphere) =>
  (snapshot.speeches?.rows ?? [])
    .filter((row) => Boolean(row.officialTextUrl || row.youtubeUrl || row.vodPlaybackUrl))
    .map((row) => ({
      id: `fala-${row.id}`,
      era: 'C',
      sphere,
      area: 'Acervo de falas',
      headline:
        row.summary ??
        row.mentionExcerpt ??
        `Pronunciamento na Câmara (${String(row.speechAt ?? '').slice(0, 4)})`,
      detail: row.mentionExcerpt ?? null,
      value: null,
      numberLabel: null,
      year: row.speechAt ? String(row.speechAt).slice(0, 4) : null,
      phase: null,
      sourceUrl: row.officialTextUrl ?? row.youtubeUrl ?? row.vodPlaybackUrl,
      sourceDate: row.speechAt ?? null,
    }))

/* ---------------------------------------------------------------- *
 * Dossier synthesis (C186/C187 analysis layer) — deterministic      *
 * aggregation of the sourced rows; it introduces no fact.           *
 * ---------------------------------------------------------------- */

const SYNTHESIS_PHASE_ORDER = [
  'empenhado',
  'liquidado',
  'pago',
  'autorizado',
  'restos',
  'nao_informado',
]

const countBy = (list, keyOf) => {
  const counts = new Map()
  for (const entry of list) {
    const key = keyOf(entry)
    if (key === null || key === undefined || key === '') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const toRows = (counts, rank = null) =>
  [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) =>
      rank
        ? (rank.get(left.key) ?? rank.size) - (rank.get(right.key) ?? rank.size)
        : right.count - left.count || String(left.key).localeCompare(String(right.key)),
    )

const chronologicalRows = (counts) =>
  [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => String(left.key).localeCompare(String(right.key)))

const itemYear = (item) =>
  item.numbers?.[0]?.year ?? (item.sourceDate ? String(item.sourceDate).slice(0, 4) : null)

const gapEraKey = (gap) => {
  const match = /^era_([abc])_/i.exec(gap.id ?? '')
  return match ? match[1].toUpperCase() : 'fora'
}

/** Theme gap field: checklist ids carry the era letter, everything else is Acervo. */
const gapEraLabel = (id) => {
  const match = /^era_([abc])_/i.exec(id ?? '')
  return match ? match[1].toUpperCase() : 'Acervo'
}

const buildDossierSynthesis = ({
  items,
  numberRows,
  speechFacts,
  gaps,
  acervoTotal,
  scopeLabel,
  unit = INSTITUTION_UNIT,
}) => {
  const byEra = toRows(
    countBy(items, (item) => item.era),
    new Map([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ]),
  ).map((row) => ({ key: row.key, label: `Era ${row.key}`, count: row.count }))
  const byEraSphere = byEra.map((era) => ({
    key: era.key,
    label: era.label,
    segments: unit.spheres.map((sphere) => ({
      key: sphere,
      label: unit.sphereLabels[sphere],
      count: items.filter((item) => item.era === era.key && item.sphere === sphere).length,
    })),
  }))
  const bySphere = unit.spheres.map((sphere) => ({
    key: sphere,
    label: unit.sphereLabels[sphere],
    count: items.filter((item) => item.sphere === sphere).length,
  }))
  const byPhase = toRows(
    countBy(numberRows, (row) => row.phase),
    new Map(SYNTHESIS_PHASE_ORDER.map((phase, index) => [phase, index])),
  ).map((row) => ({ key: row.key, label: dossierPhaseLabel(row.key), count: row.count }))
  const byArea = toRows(countBy(items, (item) => item.area))
  const byYear = chronologicalRows(countBy(items, itemYear))
  const acervoByYear = chronologicalRows(countBy(speechFacts, (fact) => fact.year))
  const gapsByEra = toRows(
    countBy(gaps, gapEraKey),
    new Map([
      ['A', 0],
      ['B', 1],
      ['C', 2],
      ['fora', 3],
    ]),
  ).map((row) => ({
    key: row.key,
    label: row.key === 'fora' ? 'Fora de era' : `Era ${row.key}`,
    count: row.count,
  }))

  const money = moneyRows(numberRows)
  const sumMoney = (rows) => rows.reduce((sum, row) => sum + row.amount, 0)
  const moneyByPhase = toRows(
    countBy(money, (row) => row.phase),
    new Map(SYNTHESIS_PHASE_ORDER.map((phase, index) => [phase, index])),
  ).map((row) => ({
    key: row.key,
    label: dossierPhaseLabel(row.key),
    count: row.count,
    amount: sumMoney(money.filter((entry) => entry.phase === row.key)),
  }))
  const moneyByYear = chronologicalRows(countBy(money, (row) => row.year)).map((row) => {
    const rows = money.filter((entry) => entry.year === row.key)
    return {
      key: row.key,
      count: row.count,
      amount: sumMoney(rows),
      label: formatMoneyCompact(sumMoney(rows)),
      segments: SYNTHESIS_PHASE_ORDER.map((phase) => ({
        key: phase,
        amount: sumMoney(rows.filter((entry) => entry.phase === phase)),
      })).filter((segment) => segment.amount > 0),
    }
  })
  const executedMoney = money.filter((row) => row.phase === 'pago' || row.phase === 'liquidado')
  const authorizedMoney = money.filter(
    (row) => row.phase === 'autorizado' || row.phase === 'empenhado',
  )
  const proposedMoney = money.filter(
    (row) => row.phase === 'nao_informado' || row.phase === 'restos',
  )
  const moneyTotals = {
    executed: sumMoney(executedMoney),
    authorized: sumMoney(authorizedMoney),
    proposed: sumMoney(proposedMoney),
    total: sumMoney(money),
    count: money.length,
  }
  const moneyProposals = [...proposedMoney]
    .sort((left, right) => right.amount - left.amount)
    .map((row) => ({
      key: `${row.object}-${row.year ?? 's/ano'}`,
      label: row.object,
      year: row.year,
      amount: row.amount,
      formatted: formatMoneyCompact(row.amount),
    }))

  const topEra = toRows(countBy(items, (item) => item.era))[0] ?? null
  const topYears = [...acervoByYear].sort((left, right) => right.count - left.count).slice(0, 3)
  const lines = []
  if (items.length > 0) {
    lines.push(
      `Foram localizados ${items.length} pontos com fonte ${scopeLabel} — ${byEra
        .map((row) => `${row.label}: ${row.count}`)
        .join(' · ')}.`,
    )
    lines.push(
      `Abrangência: ${bySphere.map((row) => `${row.count} ${row.label}`).join(' · ')}. ${unit.synthesisSumGuard ?? 'recortes não são somados.'}`,
    )
    if (topEra) {
      lines.push(
        `Concentração: a Era ${topEra.key} reúne ${topEra.count} de ${items.length} pontos com fonte (${Math.round((topEra.count / items.length) * 100)}%).`,
      )
    }
    lines.push(
      `Itens com valor: ${numberRows.length}${
        byPhase.length ? ` — ${byPhase.map((row) => `${row.count} ${row.label}`).join(' · ')}` : ''
      }. Empenho não é pagamento.`,
    )
    if (moneyTotals.count) {
      // Theme keeps every phase on its own line (never fusing pago/liquidado or
      // autorizado/empenhado); the totals and charts stay untouched.
      const parts =
        unit.moneyPhaseStyle === 'separate'
          ? moneyByPhase.map((row) => `${formatMoneyCompact(row.amount)} ${row.label}`)
          : []
      if (unit.moneyPhaseStyle !== 'separate') {
        if (moneyTotals.executed)
          parts.push(`${formatMoneyCompact(moneyTotals.executed)} pagos/liquidados`)
        if (moneyTotals.authorized)
          parts.push(`${formatMoneyCompact(moneyTotals.authorized)} autorizados/empenhados`)
        if (moneyTotals.proposed)
          parts.push(`${formatMoneyCompact(moneyTotals.proposed)} em propostas sem fase informada`)
      }
      lines.push(`Recursos localizados: ${parts.join(' · ')}.`)
    }
    if (byArea.length) {
      lines.push(
        `Temas com mais registros: ${byArea
          .slice(0, 3)
          .map((row) => `${row.key} (${row.count})`)
          .join(' · ')}.`,
      )
    }
  } else {
    lines.push('Nenhum ponto com fonte foi localizado — a leitura é a das lacunas explícitas.')
  }
  if (speechFacts.length) {
    lines.push(
      `Acervo interno (read-only, 2011+): ${acervoTotal} falas no recorte temático — amostra de ${speechFacts.length} com link${
        topYears.length > 1
          ? `; pico em ${topYears.map((row) => `${row.key} (${row.count})`).join(', ')}`
          : ''
      }.`,
    )
  }
  if (gaps.length) {
    const priority = gaps[0]?.label ?? gaps[0]?.id ?? '—'
    lines.push(
      `Lacunas declaradas: ${gaps.length}${
        gapsByEra.length
          ? ` — ${gapsByEra.map((row) => `${row.label}: ${row.count}`).join(' · ')}`
          : ''
      }. Prioridade: ${priority}.`,
    )
  }

  return {
    byEra,
    byEraSphere,
    bySphere,
    byPhase,
    byArea,
    byYear,
    acervoByYear,
    gapsByEra,
    moneyByPhase,
    moneyByYear,
    moneyProposals,
    moneyTotals,
    totals: {
      items: items.length,
      numbers: numberRows.length,
      money: money.length,
      acervo: speechFacts.length,
      acervoRecorte: acervoTotal,
      gaps: gaps.length,
    },
    lines,
  }
}

/**
 * One deterministic consolidation paragraph per era — the renderer prefers the
 * narrative file's own paragraph when the research copy provides one.
 */
const buildEraSummary = ({ era, items, money, scopeLabel, unit = INSTITUTION_UNIT }) => {
  if (items.length === 0) return null
  const spheres = unit.spheres.map((sphere) => ({
    sphere,
    label: unit.sphereLabels[sphere],
    count: items.filter((item) => item.sphere === sphere).length,
  }))
  const areas = toRows(countBy(items, (item) => item.area))
  const years = items
    .map(itemYear)
    .filter(Boolean)
    .sort((left, right) => String(left).localeCompare(String(right)))
  const period = years.length ? `${years[0]}–${years[years.length - 1]}` : era.period
  const executed = money
    .filter((row) => row.phase === 'pago' || row.phase === 'liquidado')
    .reduce((sum, row) => sum + row.amount, 0)
  const proposed = money
    .filter((row) => row.phase === 'nao_informado')
    .reduce((sum, row) => sum + row.amount, 0)
  const parts = [
    `A ${era.label} reúne ${items.length} ${items.length === 1 ? 'ponto' : 'pontos'} com fonte ${scopeLabel} (${period}): ${spheres
      .map((row) => `${row.count} ${row.label}`)
      .join(' · ')} — recortes não somáveis.`,
  ]
  if (areas.length) {
    parts.push(
      `Concentração em ${areas
        .slice(0, 3)
        .map((row) => `${row.key} (${row.count})`)
        .join(', ')}.`,
    )
  }
  if (executed || proposed) {
    const moneyParts = []
    if (executed) moneyParts.push(`${formatMoneyCompact(executed)} com execução confirmada`)
    if (proposed) moneyParts.push(`${formatMoneyCompact(proposed)} em proposta sem fase informada`)
    parts.push(`Recursos: ${moneyParts.join(' · ')} — empenho não é pagamento.`)
  }
  return parts.join(' ')
}

/* ---------------------------------------------------------------- *
 * C209 analysis layer: "O essencial", "Leitura entre eras" and the  *
 * "O que Solla defende" section. Everything below is a deterministic *
 * reading of the sourced items/gaps — it introduces no fact.        *
 * ---------------------------------------------------------------- */

/** Ids of the `kind: 'defense'` checklist items of a unit (all three eras). */
const defenseChecklistIds = (unit) =>
  new Set(
    DOSSIER_ERA_IDS.flatMap((era) =>
      dossierChecklistForEra(era, unit)
        .filter((item) => item.kind === 'defense')
        .map((item) => item.id),
    ),
  )

/**
 * Positions Solla stands for (sourced `kind: 'defense'` items) plus the defense
 * checklist gaps — a missing source is an explicit "sem registro localizado",
 * never an inferred position.
 */
const buildDefends = ({ items, gaps, defenseIds }) => ({
  positions: items
    .filter((item) => item.kind === 'defense')
    .map((item) => ({
      id: item.id,
      era: item.era,
      label: item.position ?? item.area,
      reading: item.answer,
      details: item.details,
      brief: item.brief ?? null,
      sourceUrl: item.sourceUrl,
      sourceDate: item.sourceDate,
    })),
  gaps: gaps
    .filter((gap) => defenseIds.has(gap.id))
    .map((gap) => ({
      id: gap.id,
      label: gap.label ?? gap.id,
      reason: gap.reason,
      era: /^era_([abc])_/i.exec(gap.id ?? '')?.[1]?.toUpperCase() ?? null,
    })),
})

/** The "O essencial" key facts — a short reading of the sourced set. */
const buildEssentials = ({ items, gaps, synthesis, unit, eras }) => {
  const facts = []
  if (items.length === 0) {
    facts.push({
      label: 'Nenhum ponto com fonte localizado:',
      text: 'a leitura é a das lacunas explícitas — não completar por inferência.',
    })
    return { facts }
  }
  const omitted = eras.filter((era) => era.omitted).map((era) => era.id)
  facts.push({
    label: `${items.length} ${items.length === 1 ? 'ponto com fonte' : 'pontos com fonte'} no recorte:`,
    text: `${synthesis.byEra.map((row) => `${row.count} na ${row.label}`).join(' · ')}.${
      omitted.length
        ? ` A Era ${omitted.join('/')} não tem evidência nominal suficiente e é omitida como seção.`
        : ''
    }`,
  })
  facts.push({
    label: 'Abrangência sem soma:',
    text: `${synthesis.bySphere
      .map((row) => `${row.count} ${row.label}`)
      .join(' · ')}. ${unit.synthesisSumGuard ?? 'recortes não são somados.'}`,
  })
  if (synthesis.moneyByPhase.length) {
    facts.push({
      label: 'Valores localizados, sem consolidar fases:',
      text: `${synthesis.moneyByPhase
        .map((row) => `${formatMoneyCompact(row.amount)} ${row.label}`)
        .join(' · ')}. Empenho não é pagamento.`,
    })
  }
  facts.push({
    label: `${gaps.length} ${gaps.length === 1 ? 'lacuna declarada' : 'lacunas declaradas'}:`,
    text: gaps.length
      ? `prioridade: ${gaps[0].label ?? gaps[0].id}.`
      : 'nenhuma lacuna declarada — confira a cobertura das eras.',
  })
  return { facts }
}

/**
 * "Leitura entre eras": concentration, instruments, continuity, reach and the
 * gaps that weigh. The narrative file may carry its own `betweenEras` bullets
 * (array of strings); without them the reading is derived from the ledger.
 */
const buildBetweenEras = ({ items, gaps, synthesis, unit, narrative }) => {
  const authored = Array.isArray(narrative?.betweenEras)
    ? narrative.betweenEras
        .filter((text) => typeof text === 'string' && text.trim())
        .map((text) => text.trim())
    : []
  const bullets = []
  if (authored.length) {
    bullets.push(...authored.map((text) => ({ label: null, text })))
  } else if (items.length === 0) {
    bullets.push({
      label: 'Lacunas que pesam.',
      text: 'Nenhum ponto com fonte — a leitura é a das lacunas explícitas.',
    })
  } else {
    const top = [...synthesis.byEra].sort((left, right) => right.count - left.count)[0]
    if (top) {
      bullets.push({
        label: 'Concentração.',
        text: `A ${top.label} reúne ${top.count} de ${items.length} pontos com fonte (${Math.round(
          (top.count / items.length) * 100,
        )}%).`,
      })
    }
    const areasByEra = synthesis.byEra
      .map((row) => ({
        era: row.key,
        areas: toRows(
          countBy(
            items.filter((item) => item.era === row.key),
            (item) => item.area,
          ),
        ),
      }))
      .filter((row) => row.areas.length)
    if (areasByEra.length) {
      bullets.push({
        label: 'Instrumentos.',
        text: `${areasByEra
          .map(
            (row) =>
              `Na Era ${row.era}, ${row.areas
                .slice(0, 3)
                .map((area) => `${area.key} (${area.count})`)
                .join(', ')}`,
          )
          .join('; ')}. São registros de natureza distinta; a leitura preserva essa diferença.`,
      })
    }
    const areaEras = new Map()
    for (const item of items) {
      const set = areaEras.get(item.area) ?? new Set()
      set.add(item.era)
      areaEras.set(item.area, set)
    }
    const continuous = [...areaEras].filter(([, eras]) => eras.size > 1)
    bullets.push({
      label: 'Continuidade documentada.',
      text: continuous.length
        ? `${continuous
            .map(([area, eras]) => `${area} (${[...eras].sort().join(', ')})`)
            .join(' · ')}.`
        : 'Nenhuma área aparece em mais de uma era.',
    })
    bullets.push({
      label: 'Alcance por era.',
      text: `${synthesis.byEraSphere
        .map(
          (row) =>
            `Era ${row.key}: ${
              row.segments
                .filter((segment) => segment.count > 0)
                .map((segment) => `${segment.count} ${segment.label}`)
                .join(', ') || 'sem registro'
            }`,
        )
        .join(' · ')}.`,
    })
    if (gaps.length) {
      bullets.push({
        label: 'Lacunas que pesam.',
        text: `${gaps.length} declaradas — prioridade: ${gaps[0].label ?? gaps[0].id}.`,
      })
    }
  }

  const table = synthesis.byEraSphere.map((row) => {
    const present = row.segments.filter((segment) => segment.count > 0)
    const direct = row.segments.find((segment) => segment.key === unit.defaultSphere)?.count ?? 0
    const gapCount = synthesis.gapsByEra.find((gap) => gap.key === row.key)?.count ?? 0
    return {
      era: `${row.key} · ${DOSSIER_ERAS.find((era) => era.id === row.key)?.period ?? ''}`.trim(),
      where: present.length
        ? present.map((segment) => `${segment.count} ${segment.label}`).join(' · ')
        : 'Sem registro com fonte localizado',
      howToCite: present.length
        ? 'Nomear objeto, fase e fonte'
        : `Não atribuir ação ao ${unit.sphereLabels?.[unit.defaultSphere] ?? 'recorte'}`,
      limit:
        present.length === 0
          ? 'Lacuna explícita'
          : direct === 0
            ? `Sem ${unit.sphereLabels?.[unit.defaultSphere] ?? 'recorte'} exclusivo localizado`
            : `${gapCount} ${gapCount === 1 ? 'lacuna declarada' : 'lacunas declaradas'}`,
    }
  })

  return { bullets, table }
}

const buildSubjectReport = (params) => {
  const { snapshot, research, generatedAt = new Date(), narrative = null } = params
  const unit = resolveDossierUnit(params.unit ?? INSTITUTION_UNIT)
  const identity = snapshot[unit.snapshotField] ?? {}
  const subjectName = identity.name ?? identity.label ?? identity.slug ?? '—'
  const speechFacts = speechFactsFromRows(snapshot, unit.defaultSphere)

  const allItems = research.items ?? []
  /** C209: defense items are the "O que Solla defende" dimension — they never
   * enter the evidence lists, the synthesis or the era tables. */
  const items = allItems.filter((item) => item.kind !== 'defense')

  /** Honors live in their own sheet; they are not repeated as era action cards. */
  const researchActionsByEra = (era) =>
    items
      .filter((item) => item.era === era && item.id !== 'era_c_titulos')
      .map((item) => ({
        sphere: item.sphere,
        year: item.numbers?.[0]?.year ?? null,
        title: item.answer,
        detail: item.details,
        brief: item.brief ?? null,
        sourceUrl: item.sourceUrl,
        sourceDate: item.sourceDate,
      }))

  const eraSections = DOSSIER_ERAS.map((era) => {
    const eraItems = items.filter((item) => item.era === era.id)
    const eraNumberRows = itemNumberRows(eraItems)
    const numbers = uncapped(eraNumberRows)
    const actions = uncapped(researchActionsByEra(era.id))
    const honors = uncapped(
      items
        .filter((item) => item.era === era.id && item.id === 'era_c_titulos')
        .map((item) => ({
          text: item.answer,
          detail: item.details ?? null,
          brief: item.brief ?? null,
          date: item.sourceDate ?? null,
          year: item.numbers?.[0]?.year ?? null,
          sourceUrl: item.sourceUrl,
        })),
    )
    return {
      ...era,
      method: unit.eraMethod[era.id],
      recovery: unit.eraRecovery[era.id],
      summary: buildEraSummary({
        era,
        items: eraItems,
        money: moneyRows(eraNumberRows),
        scopeLabel: unit.scopeLabel,
        unit,
      }),
      narrative:
        typeof narrative?.eras?.[era.id] === 'string' && narrative.eras[era.id].trim()
          ? narrative.eras[era.id].trim()
          : null,
      numbers,
      actions,
      honors,
      empty: numbers.items.length === 0 && actions.items.length === 0 && honors.items.length === 0,
    }
  })

  const acervo = {
    items: speechFacts.map((fact) => ({
      id: fact.id,
      period: fact.year ?? '—',
      text: fact.headline,
      excerpt: fact.detail,
      sourceUrl: fact.sourceUrl,
    })),
    total: speechFacts.length,
    omitted: 0,
    /** The theme recorte in the base (the extractor brings the latest sample). */
    recorte: snapshot.speeches?.totalCount ?? speechFacts.length,
    topics: snapshot.speeches?.topics ?? [],
  }

  const gaps = (research.gaps ?? []).map((gap) => ({
    label: gap.label ?? gap.id,
    reason: gap.reason,
    nextStep: 'Apurar em fonte primária.',
    era: gapEraLabel(gap.id),
  }))
  const scopeItem = (sphere, key, label) => {
    const sphereItems = items.filter((item) => item.sphere === sphere)
    return {
      key,
      label,
      sphere,
      ...uncapped(
        sphereItems.map((item) => ({
          id: item.id,
          era: item.era,
          sphere: item.sphere,
          area: item.area,
          year:
            item.numbers?.[0]?.year ??
            (item.sourceDate ? String(item.sourceDate).slice(0, 4) : null),
          value: item.numbers?.[0]?.value ?? null,
          phase: item.numbers?.[0]?.phase ?? null,
          title: item.answer,
          brief: item.brief ?? null,
          evidence: item.details ?? item.label,
          sourceUrl: item.sourceUrl,
          sourceDate: item.sourceDate,
        })),
      ),
    }
  }
  const scopeLists = unit.scopeLists.map(({ key, sphere }) =>
    scopeItem(sphere, key, unit.sphereLabels[sphere]),
  )

  const synthesis = buildDossierSynthesis({
    items,
    numberRows: itemNumberRows(items),
    speechFacts,
    gaps: research.gaps ?? [],
    acervoTotal: snapshot.speeches?.totalCount ?? speechFacts.length,
    scopeLabel: unit.scopeLabel,
    unit,
  })

  const bulletinFacts = allItems
    .filter((item) => Boolean(item.sourceUrl))
    .map((item) => ({
      id: item.id,
      era: item.era,
      sphere: item.sphere,
      area: item.area,
      defense: item.kind === 'defense',
      headline: stripInlineSources(item.answer),
      detail: item.details ? stripInlineSources(item.details) : null,
      brief: item.brief
        ? {
            title: stripInlineSources(item.brief.title),
            note: item.brief.note ? stripInlineSources(item.brief.note) : null,
          }
        : null,
      value: item.numbers?.[0]?.value ?? null,
      numberLabel: item.numbers?.[0]?.label ?? null,
      // Theme bulletin cards fall back to the sourced year when there is no
      // number (C190); the institution ledger keeps its C187 shape.
      year:
        item.numbers?.[0]?.year ??
        (unit.bulletinNumberFallback && item.sourceDate
          ? String(item.sourceDate).slice(0, 4)
          : null),
      phase: item.numbers?.[0]?.phase ?? null,
      sourceUrl: item.sourceUrl,
      sourceDate: item.sourceDate,
    }))
    .concat(
      speechFacts.map((fact) => ({
        ...fact,
        headline: stripInlineSources(fact.headline),
        sourcePanel: true,
      })),
    )

  const generatedAtLabel = formatDateTimeBr(generatedAt)
  const readAtLabel = snapshot.meta?.readAt ? formatDateTimeBr(snapshot.meta.readAt) : '—'

  const narrativeParagraphs = Array.isArray(narrative?.opening)
    ? narrative.opening.filter((paragraph) => typeof paragraph === 'string' && paragraph.trim())
    : []
  const opening = {
    title:
      typeof narrative?.title === 'string' && narrative.title.trim()
        ? narrative.title.trim()
        : unit.copy.openingTitle(subjectName),
    paragraphs: narrativeParagraphs.length > 0 ? narrativeParagraphs : [synthesis.lines.join(' ')],
    authored: narrativeParagraphs.length > 0,
  }

  return {
    unit,
    meta: {
      title: unit.title,
      subjectName,
      identity,
      identityBadges: unit.identityBadges(identity),
      generatedAt,
      generatedAtLabel,
      readAtLabel,
    },
    opening,
    cover: {
      kicker: 'Comunicação · pesquisa documental',
      series: unit.series,
      internalNote: 'INSUMO INTERNO — defeso 2026',
      internalNoteSub: 'Não circular · não publicar',
      eyebrow: 'Dossiê de atuação pública',
      title: subjectName,
      subtitle: unit.copy.coverSubtitle(subjectName),
      howToUse: unit.copy.coverHowToUse,
      scope: unit.copy.coverScope,
      version: 'Documento de trabalho · versão 01',
    },
    trajectory: CAREER_TIMELINE,
    eras: eraSections,
    essentials: buildEssentials({
      items,
      gaps: research.gaps ?? [],
      synthesis,
      unit,
      eras: eraSections,
    }),
    betweenEras: buildBetweenEras({
      items,
      gaps: research.gaps ?? [],
      synthesis,
      unit,
      narrative,
    }),
    defends: buildDefends({
      items: allItems,
      gaps: research.gaps ?? [],
      defenseIds: defenseChecklistIds(unit),
    }),
    acervo,
    synthesis,
    reach: {
      ruleTitle: unit.copy.reachRuleTitle,
      ruleBody: unit.copy.reachRuleBody,
      lists: scopeLists,
    },
    gaps,
    news: (research.news ?? []).map((row) => ({
      era: row.era ?? null,
      date: row.publishedAt,
      outlet: row.outlet ?? '—',
      title: row.title,
      summary: row.summary ?? null,
      url: row.url,
    })),
    limits: {
      coverage: unit.copy.limits.coverage,
      editorial: unit.copy.limits.editorial,
    },
    bulletinFacts,
  }
}

export const dossierPhaseLabel = (phase) => phaseLabels[phase] ?? phaseLabels.nao_informado
