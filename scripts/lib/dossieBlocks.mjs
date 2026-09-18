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
import {
  CAREER_TIMELINE,
  DOSSIER_ERAS,
  DOSSIER_SCOPE,
  careerTimelineHighlights,
} from './dossieCareer.mjs'
import {
  INSTITUTION_UNIT,
  MUNICIPALITY_UNIT,
  isInstitutionUnit,
  resolveDossierUnit,
} from './dossieUnit.mjs'
import { capList, stripInlineSources, summarySurfaceText } from './reportText.mjs'

/**
 * Only the resumo ("one look") caps its lists; the full sections flow across as
 * many sheets as they need (the builder packs by measured height) — C186/C187
 * revision of 2026-09-18, same rule for both recortes.
 */
const MAX_DELIVERIES_PAGE_ONE = 3
const MAX_HOOKS_PAGE_ONE = 2
const MAX_PENDING_PAGE_ONE = 4

/** @param {string} sphere @param {any} [unit] @returns {string} */
export const dossierSphereLabel = (sphere, unit = MUNICIPALITY_UNIT) =>
  resolveDossierUnit(unit).sphereLabels?.[sphere] ?? sphere

/** @param {string} sphere @param {any} [unit] @returns {string} */
export const dossierSphereBadgeClass = (sphere, unit = MUNICIPALITY_UNIT) =>
  resolveDossierUnit(unit).sphereBadgeClass?.[sphere] ?? ''
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

const camaraItemsAsActions = (camara, era) =>
  (camara?.status === 'ok' ? (camara.items ?? []) : []).map((item) => ({
    sphere: 'municipio',
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
 * @property {any} page1
 * @property {any[]} trajectory
 * @property {Array<{ id: string, label: string, period: string, subtitle: string, empty?: boolean, method: string, recovery: string, numbers: any, actions: any, honors: any }>} eras
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   municipal: { label: string, items: any[], total: number, remaining: number },
 *   regional: { label: string, items: any[], total: number, remaining: number },
 *   evidence: { items: any[], total: number, remaining: number },
 *   context: any[],
 *   hook: any,
 *   priorityGap: any,
 * }} region
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   lists: Array<{ key: string, label: string, sphere: string, items: any[], total: number, omitted: number }>,
 *   hook: any,
 *   priorityGap: any,
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
  isInstitutionUnit(params?.unit) ? buildInstitutionReport(params) : buildMunicipalityReport(params)
const buildMunicipalityReport = ({
  snapshot,
  research,
  emendas = null,
  camara = null,
  health = null,
  generatedAt = new Date(),
  textFallback = 'full',
  narrative = null,
}) => {
  const municipality = snapshot.municipality ?? {}
  const municipalityName = municipality.name ?? municipality.slug ?? 'Município'
  const region = municipality.region ?? null
  const poleLine = region
    ? `Território de Identidade ${region} · recorte regional não somável ao município`
    : 'Recorte regional não somável ao município'

  const items = research.items ?? []
  const municipalItems = items.filter((item) => item.sphere === 'municipio')
  const regionalItems = items.filter((item) => item.sphere !== 'municipio')

  const eraRows = emendaNumberRows(emendas)
  const camaraActions = camaraItemsAsActions(camara, 'C')

  const researchActionsByEra = (era) =>
    items
      .filter((item) => item.era === era)
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
    if (numbers.length === 0 && actions.length === 0 && honors.length === 0) return null
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
    }
  }).filter(Boolean)

  const deliveries = capList(
    [...municipalItems]
      .sort((left, right) => {
        const leftEra = left.era === 'C' ? 0 : 1
        const rightEra = right.era === 'C' ? 0 : 1
        if (leftEra !== rightEra) return leftEra - rightEra
        const leftNumber = left.numbers?.length ? 0 : 1
        const rightNumber = right.numbers?.length ? 0 : 1
        return leftNumber - rightNumber
      })
      .map((item) => {
        const { text, fromSummary } = summarySurfaceText(item, textFallback)
        return {
          sphere: item.sphere,
          era: item.era,
          year: item.numbers?.[0]?.year ?? null,
          title: text,
          detail: fromSummary ? item.details : textFallback === 'pointer' ? null : item.details,
          brief: item.brief ?? null,
          value: item.numbers?.[0]?.value ?? null,
          phase: item.numbers?.[0]?.phase ?? null,
          sourceUrl: item.sourceUrl,
          sourceDate: item.sourceDate,
        }
      }),
    MAX_DELIVERIES_PAGE_ONE,
  )

  const hooks = capList(
    [...municipalItems, ...regionalItems].map((item) => ({
      topic: item.area,
      angle: summarySurfaceText(item, textFallback).text,
      brief: item.brief ?? null,
      sourceUrl: item.sourceUrl,
    })),
    MAX_HOOKS_PAGE_ONE,
  )

  const gaps = (research.gaps ?? []).map((gap) => ({
    label: gap.label ?? gap.id,
    reason: gap.reason,
    nextStep: 'Apurar em fonte primária.',
  }))

  const pending = capList(
    (research.gaps ?? []).map((gap) => gap.label ?? gap.id),
    MAX_PENDING_PAGE_ONE,
  )

  const context = healthContext(health)
  const regionItems = regionalItems.map((item) => ({
    item: item.answer,
    sphere: item.sphere,
    evidence: item.details ?? item.label,
    brief: item.brief ?? null,
    sourceUrl: item.sourceUrl,
  }))

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
    ...items
      .filter((item) => Boolean(item.sourceUrl))
      .map((item) => ({
        id: item.id,
        era: item.era,
        sphere: item.sphere,
        area: item.area,
        headline: stripInlineSources(summarySurfaceText(item).text),
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
    ...speechFacts.map((fact) => ({ ...fact, headline: stripInlineSources(fact.headline) })),
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
    page1: {
      timeline: careerTimelineHighlights(),
      deliveries,
      hooks,
      pending,
    },
    trajectory: CAREER_TIMELINE,
    eras: eraSections,
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
      items: regionItems,
      context,
      hook: hooks.items[0] ?? null,
      priorityGap: pending.items[0] ?? null,
    },
    gaps,
    acervo,
    synthesis,
    opening,
    news: (research.news ?? []).map((row) => ({
      date: row.publishedAt,
      outlet: row.outlet ?? '—',
      title: row.title,
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
 * Institution branch (C187) — same owner, institution-shaped sections. *
 * ------------------------------------------------------------------ */

/**
 * The resumo sheet is the "one look": its lists stay capped and the note points
 * to the full sections, which are never capped (they flow across sheets). The
 * acervo is a sample of the internal base — a source panel, not a finding — so
 * its count and year chart carry the whole volume.
 */
const MAX_INSTITUTION_DELIVERIES = 3
const MAX_INSTITUTION_TIMELINE = 3
const MAX_INSTITUTION_HOOKS = 2
const MAX_INSTITUTION_PENDING = 4

const INSTITUTION_SCOPE =
  'Escopo: carreira técnica e gestão pública até 2006 · SESAB 2007–2014 · Câmara dos Deputados 2015–2027. Instituição, setor e rede separados; sem fonte, não entra como entrega.'

const institutionEraMethod = {
  A: 'Registros anteriores a 2007 que citem nominalmente a instituição ou comprovem vínculo. Cargo geral não prova ação institucional.',
  B: 'A gestão estadual é lida por equipamento, programa, convênio e obra; cada linha informa abrangência e fonte. Setor e rede não somam à instituição.',
  C: 'Mandato, relatorias, parcerias e execução financeira têm datas e estágios distintos. Empenho não é pagamento; o valor sempre acompanha a fase.',
}

const institutionEraRecovery = {
  A: 'biografias oficiais · atos e diários · acervos institucionais · busca web datada',
  B: 'DOE-BA (DOOL) · notícias SESAB/instituição · Transparência Bahia · busca web datada',
  C: 'API Câmara · Portal da Transparência · acervo interno read-only · busca web datada',
}

/**
 * Wraps a capped list so the renderer can declare what stayed out ("e mais N")
 * instead of dropping it silently — the C188 no-truncation rule, enforced at
 * the owner for both recortes. `omitted` is the C187 renderer's name for the
 * same count `capList` calls `remaining`.
 */
const capped = (list, max) => {
  const { items, total, remaining } = capList(list, max)
  return { items, total, omitted: remaining }
}

/**
 * Institution lists are never capped: the dossiê flows across as many sheets
 * as the content needs (the builder packs sheets by measured height). Same
 * shape as `capped` so the renderers stay uniform.
 */
const uncapped = (list) => ({ items: list, total: list.length, omitted: 0 })

const identityBadges = (identity) =>
  [identity.kindLabel, identity.sphereLabel, identity.scope ? identity.scopeLabel : null].filter(
    Boolean,
  )

/**
 * Speeches from the internal acervo (read-only snapshot) that the research did
 * not already carry: they are sourced evidence for the recorte, so they feed
 * the bulletin ledger too — never a second, unsourced fact.
 */
const speechFactsFromRows = (snapshot, sphere = 'instituicao') =>
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
      `Abrangência: ${bySphere.map((row) => `${row.count} ${row.label}`).join(' · ')}. Setor e rede não são somados à instituição.`,
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
      const parts = []
      if (moneyTotals.executed)
        parts.push(`${formatMoneyCompact(moneyTotals.executed)} pagos/liquidados`)
      if (moneyTotals.authorized)
        parts.push(`${formatMoneyCompact(moneyTotals.authorized)} autorizados/empenhados`)
      if (moneyTotals.proposed)
        parts.push(`${formatMoneyCompact(moneyTotals.proposed)} em propostas sem fase informada`)
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

const buildInstitutionReport = ({
  snapshot,
  research,
  generatedAt = new Date(),
  narrative = null,
}) => {
  const identity = snapshot.institution ?? {}
  const subjectName = identity.name ?? identity.slug ?? 'Instituição'
  const unit = INSTITUTION_UNIT
  const speechFacts = speechFactsFromRows(snapshot)

  const items = research.items ?? []
  const directItems = items.filter((item) => item.sphere === 'instituicao')

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
      method: institutionEraMethod[era.id],
      recovery: institutionEraRecovery[era.id],
      summary: buildEraSummary({
        era,
        items: eraItems,
        money: moneyRows(eraNumberRows),
        scopeLabel: 'no recorte institucional',
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

  const deliveryList = [...directItems]
    .sort((left, right) => {
      const leftEra = left.era === 'C' ? 0 : 1
      const rightEra = right.era === 'C' ? 0 : 1
      if (leftEra !== rightEra) return leftEra - rightEra
      const leftNumber = left.numbers?.length ? 0 : 1
      const rightNumber = right.numbers?.length ? 0 : 1
      return leftNumber - rightNumber
    })
    .map((item) => ({
      sphere: item.sphere,
      era: item.era,
      year: item.numbers?.[0]?.year ?? null,
      title: item.answer,
      detail: item.details,
      brief: item.brief ?? null,
      value: item.numbers?.[0]?.value ?? null,
      phase: item.numbers?.[0]?.phase ?? null,
      sourceUrl: item.sourceUrl,
      sourceDate: item.sourceDate,
    }))
  const deliveries = capped(deliveryList, MAX_INSTITUTION_DELIVERIES)

  const hookList = items.map((item) => ({
    topic: item.area,
    angle: item.answer,
    brief: item.brief ?? null,
    sourceUrl: item.sourceUrl,
  }))
  const hooks = capped(hookList, MAX_INSTITUTION_HOOKS)

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

  const timelineList = items
    .filter((item) => item.sourceUrl)
    .map((item) => ({
      period: item.numbers?.[0]?.year ?? (item.sourceDate ?? '').slice(0, 4) ?? '—',
      role: item.answer,
      brief: item.brief ?? null,
      source: item.label,
      url: item.sourceUrl,
    }))
    .sort((left, right) => String(left.period).localeCompare(String(right.period)))
  const timeline = capped(timelineList, MAX_INSTITUTION_TIMELINE)

  const gaps = (research.gaps ?? []).map((gap) => ({
    label: gap.label ?? gap.id,
    reason: gap.reason,
    nextStep: 'Apurar em fonte primária.',
  }))
  const pendingList = (research.gaps ?? []).map((gap) => gap.label ?? gap.id)
  const pending = capped(pendingList, MAX_INSTITUTION_PENDING)

  const scopeItem = (sphere, key, label) => {
    const sphereItems = items.filter((item) => item.sphere === sphere)
    return {
      key,
      label,
      sphere,
      ...uncapped(
        sphereItems.map((item) => ({
          id: item.id,
          sphere: item.sphere,
          area: item.area,
          year: item.numbers?.[0]?.year ?? (item.sourceDate ?? '').slice(0, 4) ?? null,
          title: item.answer,
          brief: item.brief ?? null,
          evidence: item.details ?? item.label,
          sourceUrl: item.sourceUrl,
          sourceDate: item.sourceDate,
        })),
      ),
    }
  }
  const scopeLists = [
    scopeItem('instituicao', 'institution', unit.sphereLabels.instituicao),
    scopeItem('setor', 'sector', unit.sphereLabels.setor),
    scopeItem('rede', 'network', unit.sphereLabels.rede),
  ]

  const synthesis = buildDossierSynthesis({
    items,
    numberRows: itemNumberRows(items),
    speechFacts,
    gaps: research.gaps ?? [],
    acervoTotal: snapshot.speeches?.totalCount ?? speechFacts.length,
    scopeLabel: 'no recorte institucional',
    unit,
  })

  const bulletinFacts = items
    .filter((item) => Boolean(item.sourceUrl))
    .map((item) => ({
      id: item.id,
      era: item.era,
      sphere: item.sphere,
      area: item.area,
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
    }))
    .concat(speechFacts.map((fact) => ({ ...fact, headline: stripInlineSources(fact.headline) })))

  const generatedAtLabel = formatDateTimeBr(generatedAt)
  const readAtLabel = snapshot.meta?.readAt ? formatDateTimeBr(snapshot.meta.readAt) : '—'

  const narrativeParagraphs = Array.isArray(narrative?.opening)
    ? narrative.opening.filter((paragraph) => typeof paragraph === 'string' && paragraph.trim())
    : []
  const opening = {
    title:
      typeof narrative?.title === 'string' && narrative.title.trim()
        ? narrative.title.trim()
        : `O que Jorge Solla fez pela e na ${subjectName}`,
    paragraphs: narrativeParagraphs.length > 0 ? narrativeParagraphs : [synthesis.lines.join(' ')],
    authored: narrativeParagraphs.length > 0,
  }

  return {
    unit,
    meta: {
      title: unit.title,
      subjectName,
      identity,
      identityBadges: identityBadges(identity),
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
      subtitle: 'O que Jorge Solla fez por, na e com a instituição ao longo da carreira',
      howToUse:
        'Localize o vínculo ou a entrega, confira fonte, data, fase e abrangência. Transforme toda lacuna em tarefa de apuração. Este arquivo não é fala pronta nem peça pública.',
      scope: INSTITUTION_SCOPE,
      version: 'Documento de trabalho · versão 01',
    },
    page1: { timeline, deliveries, hooks, pending },
    trajectory: CAREER_TIMELINE,
    eras: eraSections,
    acervo,
    synthesis,
    reach: {
      ruleTitle: 'Setor/rede não é a instituição. Não some os recortes.',
      ruleBody:
        'Uma política para uma categoria ou uma articulação com entidades correlatas pode alcançar a instituição sem constituir entrega exclusiva para ela.',
      lists: scopeLists,
      hook: hooks.items[0] ?? null,
      priorityGap: pending.items[0] ?? null,
    },
    gaps,
    acervo,
    synthesis,
    opening,
    news: (research.news ?? []).map((row) => ({
      date: row.publishedAt,
      outlet: row.outlet ?? '—',
      title: row.title,
      url: row.url,
    })),
    limits: {
      coverage: [
        'O acervo interno de falas cobre 2011+; períodos anteriores dependem de fontes externas.',
        'Resultado de busca não prova ausência histórica.',
        'Emenda de bancada ou relator só recebe autoria quando a fonte a confirma.',
        'Menção a entidade correlata (setor/rede) não é atribuição à instituição.',
      ],
      editorial: [
        'Sem fonte, não publica.',
        'URL e data acompanham cada afirmação não trivial.',
        'Instituição, setor e rede permanecem separados.',
        'Valor sempre informa a fase de execução.',
      ],
    },
    bulletinFacts,
  }
}

export const dossierPhaseLabel = (phase) => phaseLabels[phase] ?? phaseLabels.nao_informado
