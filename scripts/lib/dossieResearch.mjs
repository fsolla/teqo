/**
 * Research contract for the C186 dossiê (owner). The dossiê is researched one
 * file per era (`<slug>.<era>.research.json`); each claim either carries a date
 * + URL or becomes an explicit gap. Reuses the C163 validation primitives
 * (exported additively from `cityReportResearch.mjs`) instead of twinning them.
 */

import { collectExtraSources, isNonEmptyString, isValidDate } from './cityReportResearch.mjs'
import { DOSSIER_ERA_IDS } from './dossieCareer.mjs'

/** Explicit spheres: a regional/pole item is never summed into the município. */
const DOSSIER_SPHERES = ['municipio', 'regiao', 'polo']

/** Execution phases (empenho ≠ pagamento). Unknown/absent degrades to "não informada". */
const DOSSIER_PHASES = ['autorizado', 'empenhado', 'liquidado', 'pago', 'restos', 'nao_informado']

/**
 * Copy budget for a printed `brief` (reformulated headline + note that must fit
 * the fixed A4 surfaces with no ellipsis). The full `answer`/`details` stay in
 * the record and the companion `.md`; the `brief` is the reformulated, shorter
 * version the PDF prints. Items without a `brief` fall back to the full text and
 * the builder's A4 fit guard fails closed if it overflows.
 */
export const DOSSIER_BRIEF_TITLE_MAX = 80
export const DOSSIER_BRIEF_NOTE_MAX = 120

/** Checklist per era — the dossiê's research checklist. `area` labels the boletim card. */
const DOSSIER_RESEARCH_CHECKLIST = [
  {
    id: 'era_a_formacao',
    era: 'A',
    area: 'Formação',
    label: 'Formação e residência (UFBA/INAMPS)',
  },
  {
    id: 'era_a_sesab',
    era: 'A',
    area: 'Saúde pública',
    label: 'SESAB — epidemiologia e sanitarismo (até 1998)',
  },
  {
    id: 'era_a_consultor_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Consultoria no Ministério da Saúde (1995–1999)',
  },
  {
    id: 'era_a_conquista',
    era: 'A',
    area: 'Saúde municipal',
    label: 'Secretaria Municipal de Saúde de Vitória da Conquista (1999–2002)',
  },
  {
    id: 'era_a_sas_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Secretaria de Atenção à Saúde do Ministério da Saúde (2003–2005)',
  },
  { id: 'era_b_sesab', era: 'B', area: 'Saúde estadual', label: 'Gestão da SESAB (2007–2014)' },
  {
    id: 'era_b_equipamentos',
    era: 'B',
    area: 'Equipamentos',
    label: 'Hospitais, UPAs e equipamentos na região',
  },
  {
    id: 'era_b_programas',
    era: 'B',
    area: 'Programas',
    label: 'Programas e políticas estaduais de saúde',
  },
  {
    id: 'era_b_obras',
    era: 'B',
    area: 'Obras',
    label: 'Obras e investimentos em saúde no município/região',
  },
  {
    id: 'era_c_discursos',
    era: 'C',
    area: 'Mandato',
    label: 'Pronunciamentos e falas com menção ao município',
  },
  {
    id: 'era_c_proposicoes',
    era: 'C',
    area: 'Mandato',
    label: 'Proposições, relatorias e ações legislativas',
  },
  {
    id: 'era_c_emendas',
    era: 'C',
    area: 'Emendas',
    label: 'Emendas e recursos para o município/região',
  },
  {
    id: 'era_c_titulos',
    era: 'C',
    area: 'Reconhecimento',
    label: 'Títulos, honrarias e vínculos locais',
  },
  {
    id: 'era_c_atuacao',
    era: 'C',
    area: 'Atuação regional',
    label: 'Atuação e articulação regional',
  },
]

export const DOSSIER_RESEARCH_CHECKLIST_IDS = DOSSIER_RESEARCH_CHECKLIST.map((item) => item.id)

const checklistById = new Map(DOSSIER_RESEARCH_CHECKLIST.map((item) => [item.id, item]))

export const dossierChecklistForEra = (era) =>
  DOSSIER_RESEARCH_CHECKLIST.filter((item) => item.era === era)

const normalizeSphere = (value) => {
  if (!isNonEmptyString(value)) return 'municipio'
  const sphere = value.trim()
  return DOSSIER_SPHERES.includes(sphere) ? sphere : null
}

const normalizePhase = (value) => {
  if (!isNonEmptyString(value)) return 'nao_informado'
  const phase = value.trim()
  return DOSSIER_PHASES.includes(phase) ? phase : 'nao_informado'
}

const normalizeBrief = (entry) => {
  const title = isNonEmptyString(entry?.title) ? entry.title.trim() : null
  if (!title) return null
  return { title, note: isNonEmptyString(entry?.note) ? entry.note.trim() : null }
}

/** Non-fatal: an over-budget brief is kept, but the A4 fit guard will likely fail — surface it early. */
const warnIfBriefOverBudget = (id, brief) => {
  if (!brief) return
  if (brief.title.length > DOSSIER_BRIEF_TITLE_MAX) {
    console.warn(
      `[dossie-research] brief.title de ${id} tem ${brief.title.length} chars (teto ${DOSSIER_BRIEF_TITLE_MAX}).`,
    )
  }
  if ((brief.note?.length ?? 0) > DOSSIER_BRIEF_NOTE_MAX) {
    console.warn(
      `[dossie-research] brief.note de ${id} tem ${brief.note.length} chars (teto ${DOSSIER_BRIEF_NOTE_MAX}).`,
    )
  }
}

const normalizeNumbers = (entry) => {
  const numbers = []
  for (const number of Array.isArray(entry?.numbers) ? entry.numbers : []) {
    const label = isNonEmptyString(number?.label) ? number.label.trim() : null
    const value =
      number?.value === null || number?.value === undefined
        ? null
        : String(number.value).trim() || null
    if (!label || !value) continue
    numbers.push({
      label,
      value,
      year: isNonEmptyString(number?.year) ? number.year.trim() : null,
      phase: normalizePhase(number?.phase),
    })
  }
  return numbers
}

/**
 * Validates/normalizes one era's agent-written research JSON.
 *
 * Structural failures (no slug, no research date, no/unknown era) throw — the
 * operator fixes the file. Content failures (missing source, unknown item, item
 * from another era) degrade to explicit gaps.
 */
export const normalizeDossierResearchInput = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Pesquisa do dossiê inválida: o arquivo precisa ser um objeto JSON.')
  }
  if (!isNonEmptyString(raw.municipalitySlug)) {
    throw new Error('Pesquisa do dossiê inválida: falta "municipalitySlug".')
  }
  if (!isValidDate(raw.researchedAt)) {
    throw new Error(
      'Pesquisa do dossiê inválida: falta "researchedAt" (ISO) — a pesquisa precisa ser datada.',
    )
  }
  const era = isNonEmptyString(raw.era) ? raw.era.trim().toUpperCase() : null
  if (!era || !DOSSIER_ERA_IDS.includes(era)) {
    throw new Error('Pesquisa do dossiê inválida: falta "era" (A, B ou C).')
  }

  const researchedAt = new Date(raw.researchedAt)
  const gaps = []
  const items = []
  const seen = new Set()

  for (const entry of Array.isArray(raw.items) ? raw.items : []) {
    const id = typeof entry?.id === 'string' ? entry.id : null
    const checklistItem = id ? checklistById.get(id) : null
    if (!checklistItem) {
      gaps.push({
        id: id ?? 'desconhecido',
        label: null,
        reason: 'Item fora do checklist de pesquisa do dossiê.',
      })
      continue
    }
    if (checklistItem.era !== era) {
      gaps.push({
        id,
        label: checklistItem.label,
        reason: `Item da Era ${checklistItem.era} enviado no arquivo da Era ${era}.`,
      })
      continue
    }
    seen.add(id)
    const answer = isNonEmptyString(entry.answer) ? entry.answer.trim() : null
    const sourceUrl = isNonEmptyString(entry.sourceUrl) ? entry.sourceUrl.trim() : null
    const sourceDate = isValidDate(entry.sourceDate) ? entry.sourceDate : null
    if (!answer) {
      gaps.push({ id, label: checklistItem.label, reason: 'Não pesquisado.' })
      continue
    }
    if (!sourceUrl || !sourceDate) {
      gaps.push({
        id,
        label: checklistItem.label,
        reason: 'Sem fonte: cada item exige URL e data.',
      })
      continue
    }
    const sphere = normalizeSphere(entry.sphere)
    if (!sphere) {
      gaps.push({
        id,
        label: checklistItem.label,
        reason: `Esfera inválida (esperado ${DOSSIER_SPHERES.join('/')}).`,
      })
      continue
    }
    const brief = normalizeBrief(entry.brief)
    warnIfBriefOverBudget(id, brief)
    items.push({
      id,
      era,
      label: checklistItem.label,
      area: checklistItem.area,
      answer,
      details: isNonEmptyString(entry.details) ? entry.details.trim() : null,
      brief,
      sphere,
      numbers: normalizeNumbers(entry),
      sourceUrl,
      sourceDate,
      extraSources: collectExtraSources(entry),
      consultedAt: isValidDate(entry.consultedAt) ? entry.consultedAt : null,
    })
  }

  for (const entry of Array.isArray(raw.gaps) ? raw.gaps : []) {
    if (isNonEmptyString(entry?.reason)) {
      const id = isNonEmptyString(entry.id) ? entry.id : 'lacuna'
      if (checklistById.has(id)) seen.add(id)
      gaps.push({
        id,
        label: isNonEmptyString(entry.label) ? entry.label : null,
        reason: entry.reason.trim(),
      })
    }
  }

  for (const checklistItem of dossierChecklistForEra(era)) {
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
    news.push({
      era,
      title,
      outlet: isNonEmptyString(entry.outlet) ? entry.outlet.trim() : null,
      publishedAt,
      url,
      summary: isNonEmptyString(entry.summary) ? entry.summary.trim() : null,
    })
  }

  return {
    municipalitySlug: raw.municipalitySlug.trim(),
    era,
    researchedAt: researchedAt.toISOString(),
    items,
    news,
    gaps,
  }
}

/** Short receipt the researcher subagent returns (never the body). */
export const dossierResearchReceipt = (research) => ({
  slug: research.municipalitySlug,
  era: research.era,
  status: 'ok',
  researchPath: `data/dossie-solla-cidade/${research.municipalitySlug}.${research.era.toLowerCase()}.research.json`,
  researchedAt: research.researchedAt,
  itemCount: research.items.length,
  gapCount: research.gaps.length,
  newsCount: research.news.length,
  gaps: research.gaps.map((gap) => gap.id),
})

/**
 * Merges the per-era research files into one view. Fails closed when the slugs
 * disagree (a mixed bundle would print another city's facts).
 */
export const mergeDossierResearch = (researches) => {
  const list = Array.isArray(researches) ? researches.filter(Boolean) : []
  if (list.length === 0) throw new Error('Dossiê sem pesquisa: nenhum arquivo por era foi lido.')
  const slug = list[0].municipalitySlug
  for (const research of list) {
    if (research.municipalitySlug !== slug) {
      throw new Error(
        `Pesquisas de municípios diferentes ("${slug}" e "${research.municipalitySlug}") — pare e regenere.`,
      )
    }
  }
  const eraOrder = new Map(DOSSIER_ERA_IDS.map((id, index) => [id, index]))
  const items = list
    .flatMap((research) => research.items)
    .sort((left, right) => (eraOrder.get(left.era) ?? 0) - (eraOrder.get(right.era) ?? 0))
  const news = list
    .flatMap((research) => research.news)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
  const gaps = list.flatMap((research) => research.gaps)
  const researchedAt = list
    .map((research) => research.researchedAt)
    .sort()
    .at(-1)
  return {
    municipalitySlug: slug,
    eras: list.map((research) => research.era),
    items,
    news,
    gaps,
    researchedAt,
  }
}
