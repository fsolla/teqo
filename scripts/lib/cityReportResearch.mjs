/**
 * Research-contract validation for the city report (C163).
 *
 * The web layer of the report is written by the agent as a JSON file; this
 * module is the guard: every checklist item either carries a date + URL or
 * becomes an explicit gap. "Sem fonte, não publica" is enforced here, before
 * the renderer ever sees the data.
 */

import { DAY_MS } from '../../src/lib/text.ts'

const RESEARCH_NEWS_WINDOW_DAYS = 90

const RESEARCH_CHECKLIST = [
  { id: 'prefeito', label: 'Prefeito(a) — nome, partido, federação, situação' },
  { id: 'vice', label: 'Vice-prefeito(a) — nome, partido' },
  { id: 'relacao_campo', label: 'Relação com o campo (aliado, oposição, neutro)' },
  { id: 'vereadores', label: 'Vereadores e dobradas' },
  { id: 'disputa_local', label: 'Disputa local' },
  { id: 'quem_investe', label: 'Quem mais investe na cidade (bancada e adversários)' },
  { id: 'noticias', label: 'Notícias da cidade/região (janela ≤90 dias)' },
  { id: 'imprensa_local', label: 'Imprensa e rádio local' },
  {
    id: 'emendas_web',
    label: 'Emendas — indícios web (município, região ou polo)',
  },
]

export const RESEARCH_CHECKLIST_IDS = RESEARCH_CHECKLIST.map((item) => item.id)

const checklistById = new Map(RESEARCH_CHECKLIST.map((item) => [item.id, item]))

/** Where an emenda indication points to: the município itself, its region or the regional pole. */
const EMENDA_SPHERES = ['municipio', 'regiao', 'polo']

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

const isValidDate = (value) => isNonEmptyString(value) && !Number.isNaN(Date.parse(value))

const inNewsWindow = (publishedAt, reference) =>
  Date.parse(publishedAt) >= reference.getTime() - RESEARCH_NEWS_WINDOW_DAYS * DAY_MS &&
  Date.parse(publishedAt) <= reference.getTime() + DAY_MS

/**
 * Validated `extraSources` of one research entry: additional URLs that support
 * the same item (a text can cite facts from more than one outlet). Each needs
 * url+date; invalid ones are dropped (the primary source already carries the
 * item, so a broken extra is not worth a visible gap).
 */
const collectExtraSources = (entry) =>
  (Array.isArray(entry?.extraSources) ? entry.extraSources : [])
    .map((extra) => ({
      label: isNonEmptyString(extra?.label) ? extra.label.trim() : null,
      url: isNonEmptyString(extra?.url) ? extra.url.trim() : null,
      date: isValidDate(extra?.date) ? extra.date : null,
    }))
    .filter((extra) => extra.url && extra.date)

/**
 * Validates/normalizes the agent-written research JSON.
 *
 * Structural failures (no slug, no research date) throw — the operator has to
 * fix the file. Content failures (missing source, stale news, unknown item)
 * degrade to explicit gaps, which the report prints as such.
 */
export const normalizeResearchInput = (raw, { now = new Date() } = {}) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Pesquisa inválida: o arquivo precisa ser um objeto JSON.')
  }
  if (!isNonEmptyString(raw.municipalitySlug)) {
    throw new Error('Pesquisa inválida: falta "municipalitySlug".')
  }
  if (!isValidDate(raw.researchedAt)) {
    throw new Error(
      'Pesquisa inválida: falta "researchedAt" (ISO) — a pesquisa precisa ser datada.',
    )
  }

  const researchedAt = new Date(raw.researchedAt)
  const reference = now instanceof Date ? now : new Date(now)
  const gaps = []
  const items = []
  const seen = new Set()

  for (const entry of Array.isArray(raw.items) ? raw.items : []) {
    const id = typeof entry?.id === 'string' ? entry.id : null
    if (!id || !checklistById.has(id)) {
      gaps.push({
        id: id ?? 'desconhecido',
        label: id && checklistById.get(id)?.label,
        reason: 'Item fora do checklist de pesquisa.',
      })
      continue
    }
    seen.add(id)
    const answer = isNonEmptyString(entry.answer) ? entry.answer.trim() : null
    const sourceUrl = isNonEmptyString(entry.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry.sourceDate) ? entry.sourceDate : null
    if (!answer) {
      gaps.push({ id, label: checklistById.get(id).label, reason: 'Não pesquisado.' })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id,
        label: checklistById.get(id).label,
        reason: 'Sem fonte: cada item exige URL e data.',
      })
      continue
    }
    const extraSources = []
    for (const extra of Array.isArray(entry.extraSources) ? entry.extraSources : []) {
      const extraUrl = isNonEmptyString(extra?.url) ? extra.url.trim() : null
      const extraDate = isValidDate(extra?.date) ? extra.date : null
      if (!extraUrl || !extraDate) {
        gaps.push({
          id: 'fonte_extra',
          label: checklistById.get(id).label,
          reason: 'Fonte adicional sem URL ou data — descartada.',
        })
        continue
      }
      extraSources.push({
        label: isNonEmptyString(extra.label) ? extra.label.trim() : null,
        url: extraUrl,
        date: extraDate,
      })
    }
    items.push({
      id,
      label: checklistById.get(id).label,
      answer,
      details: isNonEmptyString(entry.details) ? entry.details.trim() : null,
      sourceUrl,
      sourceDate,
      extraSources,
      consultedAt: isValidDate(entry.consultedAt) ? entry.consultedAt : null,
    })
  }

  for (const entry of Array.isArray(raw.gaps) ? raw.gaps : []) {
    if (isNonEmptyString(entry?.reason)) {
      const id = isNonEmptyString(entry.id) ? entry.id : 'lacuna'
      // A gap declared by the agent already accounts for the checklist item —
      // otherwise the item would show up twice ("Não pesquisado." + the real gap).
      if (checklistById.has(id)) seen.add(id)
      gaps.push({
        id,
        label: isNonEmptyString(entry.label) ? entry.label : null,
        reason: entry.reason.trim(),
      })
    }
  }

  for (const checklistItem of RESEARCH_CHECKLIST) {
    if (!seen.has(checklistItem.id)) {
      gaps.push({ id: checklistItem.id, label: checklistItem.label, reason: 'Não pesquisado.' })
    }
  }

  const news = []
  for (const entry of Array.isArray(raw.news) ? raw.news : []) {
    const title = isNonEmptyString(entry?.title) ? entry.title.trim() : null
    const url = isNonEmptyString(entry?.url) ? entry.url.trim() : null
    const publishedAt = isValidDate(entry?.publishedAt) ? entry.publishedAt : null
    if (!title || !url || !publishedAt) {
      gaps.push({
        id: 'noticia_sem_fonte',
        reason: 'Notícia sem título, URL ou data — descartada.',
      })
      continue
    }
    if (!inNewsWindow(publishedAt, reference)) {
      gaps.push({
        id: 'noticia_fora_da_janela',
        label: title,
        reason: `Fora da janela de ${RESEARCH_NEWS_WINDOW_DAYS} dias — descartada.`,
      })
      continue
    }
    news.push({
      title,
      outlet: isNonEmptyString(entry.outlet) ? entry.outlet.trim() : null,
      publishedAt,
      url,
      summary: isNonEmptyString(entry.summary) ? entry.summary.trim() : null,
    })
  }

  const approach = []
  for (const entry of Array.isArray(raw.approach) ? raw.approach : []) {
    const topic = isNonEmptyString(entry?.topic) ? entry.topic.trim() : null
    const suggestion = isNonEmptyString(entry?.suggestion) ? entry.suggestion.trim() : null
    const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
    if (!topic || !suggestion) {
      gaps.push({
        id: 'abordagem_incompleta',
        label: topic,
        reason: 'Sugestão sem tema ou texto — descartada.',
      })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id: 'abordagem_sem_fonte',
        label: topic,
        reason: 'Sugestão sem fonte: URL e data são obrigatórias.',
      })
      continue
    }
    approach.push({
      persona: isNonEmptyString(entry.persona) ? entry.persona.trim() : null,
      topic,
      suggestion,
      sourceUrl,
      sourceDate,
      extraSources: collectExtraSources(entry),
      consultedAt: isValidDate(entry.consultedAt) ? entry.consultedAt : null,
    })
  }

  const preCandidates = []
  for (const entry of Array.isArray(raw.preCandidates) ? raw.preCandidates : []) {
    const name = isNonEmptyString(entry?.name) ? entry.name.trim() : null
    const office = isNonEmptyString(entry?.office) ? entry.office.trim() : null
    const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
    if (!name || !office) {
      gaps.push({
        id: 'precandidato_incompleto',
        label: name,
        reason: 'Pré-candidato sem nome ou cargo — descartado.',
      })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id: 'precandidato_sem_fonte',
        label: name,
        reason: 'Pré-candidato sem fonte: URL e data são obrigatórias.',
      })
      continue
    }
    preCandidates.push({
      name,
      office,
      party: isNonEmptyString(entry.party) ? entry.party.trim() : null,
      support: isNonEmptyString(entry.support) ? entry.support.trim() : null,
      note: isNonEmptyString(entry.note) ? entry.note.trim() : null,
      sourceUrl,
      sourceDate,
    })
  }

  const leaders = []
  for (const entry of Array.isArray(raw.leaders) ? raw.leaders : []) {
    const name = isNonEmptyString(entry?.name) ? entry.name.trim() : null
    const role = isNonEmptyString(entry?.role) ? entry.role.trim() : null
    const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
    if (!name || !role) {
      gaps.push({
        id: 'lideranca_incompleta',
        label: name,
        reason: 'Liderança sem nome ou papel — descartada.',
      })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id: 'lideranca_sem_fonte',
        label: name,
        reason: 'Liderança sem fonte: URL e data são obrigatórias.',
      })
      continue
    }
    leaders.push({
      name,
      role,
      party: isNonEmptyString(entry.party) ? entry.party.trim() : null,
      period: isNonEmptyString(entry.period) ? entry.period.trim() : null,
      note: isNonEmptyString(entry.note) ? entry.note.trim() : null,
      sourceUrl,
      sourceDate,
    })
  }

  const leaderAgenda = []
  for (const entry of Array.isArray(raw.leaderAgenda) ? raw.leaderAgenda : []) {
    const name = isNonEmptyString(entry?.name) ? entry.name.trim() : null
    const topics = isNonEmptyString(entry?.topics) ? entry.topics.trim() : null
    const hook = isNonEmptyString(entry?.hook) ? entry.hook.trim() : null
    const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
    if (!name) {
      gaps.push({
        id: 'agenda_lideranca_incompleta',
        reason: 'Pauta de liderança sem nome — descartada.',
      })
      continue
    }
    if (!topics && !hook) {
      gaps.push({
        id: 'agenda_lideranca_sem_pauta',
        label: name,
        reason: 'Liderança sem pauta provável nem gancho recente — descartada.',
      })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id: 'agenda_lideranca_sem_fonte',
        label: name,
        reason: 'Pauta de liderança sem fonte: URL e data são obrigatórias.',
      })
      continue
    }
    leaderAgenda.push({
      name,
      field: isNonEmptyString(entry.field) ? entry.field.trim() : null,
      topics,
      hook,
      sourceUrl,
      sourceDate,
      extraSources: collectExtraSources(entry),
    })
  }

  const sourcedLists = {
    demography: [],
    economy: [],
    transport: [],
    opposition: [],
    alliances: [],
    investments: [],
  }
  for (const key of Object.keys(sourcedLists)) {
    for (const entry of Array.isArray(raw[key]) ? raw[key] : []) {
      const topic = isNonEmptyString(entry?.topic) ? entry.topic.trim() : null
      const detail = isNonEmptyString(entry?.detail) ? entry.detail.trim() : null
      const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
      const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
      if (!topic || !detail) {
        gaps.push({
          id: `${key}_incompleto`,
          label: topic,
          reason: 'Item sem tema ou dado — descartado.',
        })
        continue
      }
      if (!sourceUrl || !sourceDate) {
        gaps.push({
          id: `${key}_sem_fonte`,
          label: topic,
          reason: 'Item sem fonte: URL e data são obrigatórias.',
        })
        continue
      }
      sourcedLists[key].push({
        topic,
        detail,
        sourceUrl,
        sourceDate,
        extraSources: collectExtraSources(entry),
        consultedAt: isValidDate(entry.consultedAt) ? entry.consultedAt : null,
      })
    }
  }

  /**
   * Structured emenda indications (município/região/polo). The page-1 block is
   * "quem indica o quê, para onde e com que fonte" — the free-text `emendas_web`
   * synthesis alone cannot show the value/esfera per author. Every row needs a
   * source; without it the row is dropped into an explicit gap.
   */
  const emendasIndicators = []
  for (const entry of Array.isArray(raw.emendasIndicators) ? raw.emendasIndicators : []) {
    const author = isNonEmptyString(entry?.author) ? entry.author.trim() : null
    const sphere = isNonEmptyString(entry?.sphere) ? entry.sphere.trim() : null
    const sourceUrl = isNonEmptyString(entry?.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry?.sourceDate) ? entry.sourceDate : null
    if (!author || !sphere || !EMENDA_SPHERES.includes(sphere)) {
      gaps.push({
        id: 'emenda_indicio_incompleto',
        label: author,
        reason: `Indício de emenda sem autor ou esfera (${EMENDA_SPHERES.join('/')}) — descartado.`,
      })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id: 'emenda_indicio_sem_fonte',
        label: author,
        reason: 'Indício de emenda sem fonte: URL e data são obrigatórias.',
      })
      continue
    }
    emendasIndicators.push({
      author,
      sphere,
      value: isNonEmptyString(entry.value) ? entry.value.trim() : null,
      purpose: isNonEmptyString(entry.purpose) ? entry.purpose.trim() : null,
      year: isNonEmptyString(entry.year) ? entry.year.trim() : null,
      sourceUrl,
      sourceDate,
    })
  }

  return {
    municipalitySlug: raw.municipalitySlug.trim(),
    researchedAt: researchedAt.toISOString(),
    items,
    news,
    approach,
    preCandidates,
    leaders,
    leaderAgenda,
    emendasIndicators,
    demography: sourcedLists.demography,
    economy: sourcedLists.economy,
    transport: sourcedLists.transport,
    opposition: sourcedLists.opposition,
    alliances: sourcedLists.alliances,
    investments: sourcedLists.investments,
    gaps,
  }
}

export const researchItemById = (research, id) =>
  research.items.find((item) => item.id === id) ?? null
