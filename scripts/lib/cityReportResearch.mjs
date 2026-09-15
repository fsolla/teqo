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
  { id: 'emendas_web', label: 'Emendas na web (quando a fonte oficial não responder)' },
]

export const RESEARCH_CHECKLIST_IDS = RESEARCH_CHECKLIST.map((item) => item.id)

const checklistById = new Map(RESEARCH_CHECKLIST.map((item) => [item.id, item]))

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

const isValidDate = (value) => isNonEmptyString(value) && !Number.isNaN(Date.parse(value))

const inNewsWindow = (publishedAt, reference) =>
  Date.parse(publishedAt) >= reference.getTime() - RESEARCH_NEWS_WINDOW_DAYS * DAY_MS &&
  Date.parse(publishedAt) <= reference.getTime() + DAY_MS

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
    items.push({
      id,
      label: checklistById.get(id).label,
      answer,
      details: isNonEmptyString(entry.details) ? entry.details.trim() : null,
      sourceUrl,
      sourceDate,
      consultedAt: isValidDate(entry.consultedAt) ? entry.consultedAt : null,
    })
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

  for (const entry of Array.isArray(raw.gaps) ? raw.gaps : []) {
    if (isNonEmptyString(entry?.reason)) {
      gaps.push({
        id: isNonEmptyString(entry.id) ? entry.id : 'lacuna',
        label: isNonEmptyString(entry.label) ? entry.label : null,
        reason: entry.reason.trim(),
      })
    }
  }

  return {
    municipalitySlug: raw.municipalitySlug.trim(),
    researchedAt: researchedAt.toISOString(),
    items,
    news,
    gaps,
  }
}

export const researchItemById = (research, id) =>
  research.items.find((item) => item.id === id) ?? null
