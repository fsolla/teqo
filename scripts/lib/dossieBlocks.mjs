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
import { stripInlineSources } from './reportText.mjs'

const MAX_DELIVERIES_PAGE_ONE = 3
const MAX_HOOKS_PAGE_ONE = 2
const MAX_PENDING_PAGE_ONE = 4
const MAX_ERA_NUMBERS = 6
/** Curated research actions are all kept (the renderer paginates them); only the generic Câmara list is capped. */
const MAX_ERA_CAMARA_ACTIONS = 4
const MAX_REGION_ITEMS = 3
const MAX_SCOPE_LIST = 3

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
 * @typedef {Object} DossierReport
 * @property {any} meta
 * @property {any} cover
 * @property {any} page1
 * @property {any[]} trajectory
 * @property {Array<{ id: string, label: string, period: string, subtitle: string, empty?: boolean, method: string, recovery: string, numbers: any[], actions: any[], honors: any[] }>} eras
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   municipal: { label: string, items: any[], total: number },
 *   regional: { label: string, items: any[], total: number },
 *   items: any[],
 *   context: any[],
 *   hook: any,
 *   priorityGap: any,
 * }} region
 * @property {{
 *   ruleTitle: string,
 *   ruleBody: string,
 *   lists: Array<{ key: string, label: string, sphere: string, items: any[], total: number, omitted: number }>,
 *   evidence: { items: any[], total: number, omitted: number },
 *   hook: any,
 *   priorityGap: any,
 * }} reach
 * @property {{ items: any[], total: number, omitted: number }} acervo
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
            .filter((item) => item.era === era.id && item.id === 'era_c_titulos')
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

/* ------------------------------------------------------------------ *
 * Institution branch (C187) — same owner, institution-shaped sections. *
 * ------------------------------------------------------------------ */

const MAX_INSTITUTION_DELIVERIES = 3
const MAX_INSTITUTION_TIMELINE = 3
const MAX_INSTITUTION_HOOKS = 2
const MAX_INSTITUTION_PENDING = 4
const MAX_INSTITUTION_SCOPE_LIST = 5
const MAX_INSTITUTION_EVIDENCE = MAX_INSTITUTION_SCOPE_LIST * 2
const MAX_INSTITUTION_ACERVO = 6

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
 * the owner for both recortes.
 */
const capped = (list, max) => ({
  items: limit(list, max),
  total: list.length,
  omitted: Math.max(0, list.length - max),
})

const identityBadges = (identity) =>
  [identity.kindLabel, identity.sphereLabel, identity.scope ? identity.scopeLabel : null].filter(
    Boolean,
  )

/**
 * Speeches from the internal acervo (read-only snapshot) that the research did
 * not already carry: they are sourced evidence for the institution recorte, so
 * they feed the bulletin ledger too — never a second, unsourced fact.
 */
const institutionSpeechFacts = (snapshot) =>
  (snapshot.speeches?.rows ?? [])
    .filter((row) => Boolean(row.officialTextUrl || row.youtubeUrl || row.vodPlaybackUrl))
    .map((row) => ({
      id: `fala-${row.id}`,
      era: 'C',
      sphere: 'instituicao',
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

const buildInstitutionReport = ({ snapshot, research, generatedAt = new Date() }) => {
  const identity = snapshot.institution ?? {}
  const subjectName = identity.name ?? identity.slug ?? 'Instituição'
  const unit = INSTITUTION_UNIT
  const speechFacts = institutionSpeechFacts(snapshot)

  const items = research.items ?? []
  const inScope = (sphere) => items.filter((item) => item.sphere === sphere)
  const directItems = inScope('instituicao')
  const sectorItems = inScope('setor')
  const networkItems = inScope('rede')

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
    const numbers = limit(
      itemNumberRows(items.filter((item) => item.era === era.id)),
      MAX_ERA_NUMBERS,
    )
    const actions = limit(researchActionsByEra(era.id), MAX_ERA_CAMARA_ACTIONS)
    const honors = items
      .filter((item) => item.era === era.id && item.id === 'era_c_titulos')
      .map((item) => ({
        text: item.answer,
        detail: item.details ?? null,
        brief: item.brief ?? null,
        date: item.sourceDate ?? null,
        year: item.numbers?.[0]?.year ?? null,
        sourceUrl: item.sourceUrl,
      }))
    return {
      ...era,
      method: institutionEraMethod[era.id],
      recovery: institutionEraRecovery[era.id],
      numbers,
      actions,
      honors,
      empty: numbers.length === 0 && actions.length === 0,
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

  const acervo = capped(
    speechFacts.map((fact) => ({
      id: fact.id,
      period: fact.year ?? '—',
      text: fact.headline,
      excerpt: fact.detail,
      sourceUrl: fact.sourceUrl,
    })),
    MAX_INSTITUTION_ACERVO,
  )

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
    return { key, label, sphere, ...capped(sphereItems, MAX_INSTITUTION_SCOPE_LIST) }
  }
  const scopeLists = [
    scopeItem('instituicao', 'institution', unit.sphereLabels.instituicao),
    scopeItem('setor', 'sector', unit.sphereLabels.setor),
    scopeItem('rede', 'network', unit.sphereLabels.rede),
  ]
  const scopeEvidence = capped(
    [...sectorItems, ...networkItems].map((item) => ({
      item: item.answer,
      sphere: item.sphere,
      evidence: item.details ?? item.label,
      brief: item.brief ?? null,
      sourceUrl: item.sourceUrl,
    })),
    MAX_INSTITUTION_EVIDENCE,
  )

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
    reach: {
      ruleTitle: 'Setor/rede não é a instituição. Não some os recortes.',
      ruleBody:
        'Uma política para uma categoria ou uma articulação com entidades correlatas pode alcançar a instituição sem constituir entrega exclusiva para ela.',
      lists: scopeLists,
      evidence: scopeEvidence,
      hook: hooks.items[0] ?? null,
      priorityGap: pending.items[0] ?? null,
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
