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
import { stripInlineSources } from './reportText.mjs'

const MAX_DELIVERIES_PAGE_ONE = 3
const MAX_HOOKS_PAGE_ONE = 2
const MAX_PENDING_PAGE_ONE = 4
const MAX_ERA_NUMBERS = 6
/** Curated research actions are all kept (the renderer paginates them); only the generic Câmara list is capped. */
const MAX_ERA_CAMARA_ACTIONS = 4
const MAX_REGION_ITEMS = 3
const MAX_SCOPE_LIST = 3

const sphereLabels = { municipio: 'município', regiao: 'região', polo: 'polo' }
export const dossierSphereLabel = (sphere) => sphereLabels[sphere] ?? sphere
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
 * @template T
 * @param {T[]} list
 * @param {number} max
 * @returns {T[]}
 */
const limit = (list, max) => list.slice(0, max)

const eraRecovery = {
  A: 'Biografia Câmara · DOU/acervo do Ministério da Saúde · pesquisa web datada',
  B: 'DOE-BA (DOOL) · notícias SESAB · Transparência Bahia · SIOPS/DATASUS',
  C: 'API Câmara · Portal da Transparência · Siga Brasil · acervo interno read-only',
}

const eraMethod = {
  A: 'Itens ligados ao município foram conferidos em fonte oficial e separados por esfera. Cargos técnicos e de gestão têm datas e objetos distintos — sem atribuição local sem documento contemporâneo.',
  B: 'A gestão estadual é lida por equipamento, política e obra; cada linha informa esfera e fonte. Região e polo não somam ao município.',
  C: 'Mandato, relatorias e execução financeira têm datas e estágios distintos. Empenho não é pagamento; o valor sempre acompanha a fase.',
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
 * Builds the dossiê report model. `research` is the merged per-era research
 * (see `mergeDossierResearch`); `emendas`/`camara`/`health` may be gaps.
 *
 * @param {{
 *   snapshot: any,
 *   research: any,
 *   emendas?: any,
 *   camara?: any,
 *   health?: any,
 *   generatedAt?: Date,
 * }} params
 */
export const buildDossierReport = ({
  snapshot,
  research,
  emendas = null,
  camara = null,
  health = null,
  generatedAt = new Date(),
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
    const ownActions = researchActionsByEra(era.id)
    const extraActions = era.id === 'C' ? camaraActions : []
    const numbers = limit(
      era.id === 'C'
        ? [...eraRows, ...itemNumberRows(items.filter((i) => i.era === 'C'))]
        : itemNumberRows(items.filter((i) => i.era === era.id)),
      MAX_ERA_NUMBERS,
    )
    const honors =
      era.id === 'C'
        ? items
            .filter((item) => item.id === 'era_c_titulos')
            .map((item) => ({
              text: item.answer,
              brief: item.brief ?? null,
              sourceUrl: item.sourceUrl,
            }))
        : []
    const actions = [...ownActions, ...limit(extraActions, MAX_ERA_CAMARA_ACTIONS)]
    if (numbers.length === 0 && actions.length === 0) return null
    return {
      ...era,
      method: eraMethod[era.id],
      recovery: eraRecovery[era.id],
      numbers,
      actions,
      honors,
    }
  }).filter(Boolean)

  const deliveries = limit(
    [...municipalItems]
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
      })),
    MAX_DELIVERIES_PAGE_ONE,
  )

  const hooks = limit(
    [...municipalItems, ...regionalItems].map((item) => ({
      topic: item.area,
      angle: item.answer,
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

  const pending = limit(
    (research.gaps ?? []).map((gap) => gap.label ?? gap.id),
    MAX_PENDING_PAGE_ONE,
  )

  const context = healthContext(health)
  const regionItems = limit(
    regionalItems.map((item) => ({
      item: item.answer,
      sphere: item.sphere,
      evidence: item.details ?? item.label,
      brief: item.brief ?? null,
      sourceUrl: item.sourceUrl,
    })),
    MAX_REGION_ITEMS,
  )

  const bulletinFacts = [
    ...items
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
  ]

  const generatedAtLabel = formatDateTimeBr(generatedAt)
  const readAtLabel = snapshot.meta?.readAt ? formatDateTimeBr(snapshot.meta.readAt) : '—'

  return {
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
    region: {
      ruleTitle: 'Região não é cidade. Não some os dois recortes.',
      ruleBody:
        'Um equipamento de referência ou uma política regional pode atender moradores do município sem constituir entrega exclusiva para ele. Atribuição só entra com alcance documentado.',
      municipal: {
        label: 'município',
        items: limit(municipalItems, MAX_SCOPE_LIST),
        total: municipalItems.length,
      },
      regional: {
        label: 'região / polo',
        items: limit(regionalItems, MAX_SCOPE_LIST),
        total: regionalItems.length,
      },
      items: regionItems,
      context,
      hook: hooks[0] ?? null,
      priorityGap: pending[0] ?? null,
    },
    gaps,
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

export const dossierPhaseLabel = (phase) => phaseLabels[phase] ?? phaseLabels.nao_informado
