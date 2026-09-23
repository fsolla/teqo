/**
 * Research contract for the dossiê (owner: C186; unit seam added by C187). The
 * dossiê is researched one file per era (`<slug>.<era>.research.json`); each
 * claim either carries a date + URL or becomes an explicit gap. Reuses the C163
 * validation primitives (exported additively from `cityReportResearch.mjs`)
 * instead of twinning them.
 *
 * The `unit` descriptor selects the slug field, the sphere vocabulary and the
 * per-era checklist; without it the behaviour is the C186 municipality one.
 */

import { collectExtraSources, isNonEmptyString, isValidDate } from './cityReportResearch.mjs'
import { DOSSIER_ERA_IDS } from './dossieCareer.mjs'
import { MUNICIPALITY_UNIT, resolveDossierUnit } from './dossieUnit.mjs'

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

/**
 * C209: a checklist item of `kind: 'defense'` is a position/priority Solla
 * stands for in the recorte. It enters through the same item→research→report
 * contract (answer + sourceUrl + sourceDate) and feeds the "O que Solla
 * defende" section; without a dated source it degrades to an explicit gap.
 */
const DEFENSE_AREA = 'Posições e defesas'

const defenseItem = (era, label) => ({
  id: `era_${era.toLowerCase()}_defesas`,
  era,
  area: DEFENSE_AREA,
  label,
  kind: 'defense',
})

/** Municipality checklist (C186). `area` labels the boletim card. */
const MUNICIPALITY_RESEARCH_CHECKLIST = [
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
  defenseItem('A', 'Posições e defesas sobre o município e a região (até 2006)'),
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
  defenseItem('B', 'Posições e defesas sobre o município e a região (2007–2014)'),
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
  defenseItem('C', 'Posições e defesas sobre o município e a região (2015–2027)'),
]

/** Institution checklist (C187) — same eras, institution-oriented. */
const INSTITUTION_RESEARCH_CHECKLIST = [
  {
    id: 'era_a_formacao',
    era: 'A',
    area: 'Formação',
    label: 'Formação, residência e pesquisa com vínculo nominal à instituição',
  },
  {
    id: 'era_a_sesab',
    era: 'A',
    area: 'Gestão pública',
    label: 'Atuação na SESAB com efeito ou menção à instituição',
  },
  {
    id: 'era_a_consultor_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Consultoria no Ministério da Saúde com interface institucional',
  },
  {
    id: 'era_a_conquista',
    era: 'A',
    area: 'Gestão municipal',
    label: 'Gestão municipal de saúde com parceria institucional',
  },
  {
    id: 'era_a_sas_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Secretaria de Atenção à Saúde do MS com interface institucional',
  },
  defenseItem('A', 'Posições e defesas sobre a instituição (até 2006)'),
  {
    id: 'era_a_vinculo',
    era: 'A',
    area: 'Vínculo',
    label: 'Vínculo institucional documentado (professor, pesquisador, conselheiro)',
  },
  {
    id: 'era_b_sesab',
    era: 'B',
    area: 'Gestão estadual',
    label: 'Gestão da SESAB (2007–2014) com a instituição',
  },
  {
    id: 'era_b_equipamentos',
    era: 'B',
    area: 'Equipamentos',
    label: 'Equipamentos e serviços de saúde ligados à instituição',
  },
  {
    id: 'era_b_programas',
    era: 'B',
    area: 'Programas',
    label: 'Programas e políticas estaduais com a instituição',
  },
  {
    id: 'era_b_obras',
    era: 'B',
    area: 'Obras',
    label: 'Obras e investimentos na instituição',
  },
  {
    id: 'era_b_convenios',
    era: 'B',
    area: 'Convênios',
    label: 'Convênios, termos e parcerias formais com a instituição',
  },
  defenseItem('B', 'Posições e defesas sobre a instituição (2007–2014)'),
  {
    id: 'era_c_discursos',
    era: 'C',
    area: 'Mandato',
    label: 'Pronunciamentos e falas com menção à instituição',
  },
  {
    id: 'era_c_proposicoes',
    era: 'C',
    area: 'Mandato',
    label: 'Proposições e relatorias de interesse da instituição',
  },
  {
    id: 'era_c_emendas',
    era: 'C',
    area: 'Emendas',
    label: 'Emendas e recursos destinados à instituição',
  },
  {
    id: 'era_c_titulos',
    era: 'C',
    area: 'Reconhecimento',
    label: 'Títulos, honrarias e homenagens da instituição',
  },
  {
    id: 'era_c_atuacao',
    era: 'C',
    area: 'Atuação',
    label: 'Atuação e articulação institucional',
  },
  {
    id: 'era_c_parcerias',
    era: 'C',
    area: 'Parcerias',
    label: 'Parcerias, audiências e articulação formal com a instituição',
  },
  defenseItem('C', 'Posições e defesas sobre a instituição (2015–2027)'),
]

/** Theme/area checklist (C190) — same eras, area-oriented. */
const THEME_RESEARCH_CHECKLIST = [
  {
    id: 'era_a_formacao',
    era: 'A',
    area: 'Formação',
    label: 'Formação, residência e pesquisa com interface na área',
  },
  {
    id: 'era_a_sesab',
    era: 'A',
    area: 'Gestão pública',
    label: 'Atuação na gestão pública com efeito ou menção à área',
  },
  {
    id: 'era_a_consultor_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Consultoria no Ministério da Saúde na área',
  },
  {
    id: 'era_a_conquista',
    era: 'A',
    area: 'Gestão municipal',
    label: 'Gestão municipal de saúde com ação na área',
  },
  {
    id: 'era_a_sas_ms',
    era: 'A',
    area: 'Ministério da Saúde',
    label: 'Secretaria de Atenção à Saúde do MS com interface na área',
  },
  {
    id: 'era_a_vinculo',
    era: 'A',
    area: 'Vínculo',
    label: 'Atuação documentada na área (pesquisa, conselho, docência)',
  },
  defenseItem('A', 'Posições e defesas sobre a área (até 2006)'),
  {
    id: 'era_b_sesab',
    era: 'B',
    area: 'Gestão estadual',
    label: 'Gestão da SESAB (2007–2014) com a área',
  },
  {
    id: 'era_b_politicas',
    era: 'B',
    area: 'Políticas',
    label: 'Políticas e programas estaduais de interesse da área',
  },
  {
    id: 'era_b_investimentos',
    era: 'B',
    area: 'Investimentos',
    label: 'Investimentos e equipamentos ligados à área',
  },
  {
    id: 'era_b_convenios',
    era: 'B',
    area: 'Convênios',
    label: 'Convênios, termos e parcerias formais na área',
  },
  {
    id: 'era_b_articulacao',
    era: 'B',
    area: 'Articulação',
    label: 'Articulação regional e setorial da área',
  },
  defenseItem('B', 'Posições e defesas sobre a área (2007–2014)'),
  {
    id: 'era_c_discursos',
    era: 'C',
    area: 'Mandato',
    label: 'Pronunciamentos e falas sobre a área',
  },
  {
    id: 'era_c_proposicoes',
    era: 'C',
    area: 'Mandato',
    label: 'Proposições e relatorias de interesse da área',
  },
  {
    id: 'era_c_relatorias',
    era: 'C',
    area: 'Relatorias',
    label: 'Relatorias e pareceres ligados à área',
  },
  {
    id: 'era_c_emendas',
    era: 'C',
    area: 'Emendas',
    label: 'Emendas e recursos destinados à área',
  },
  {
    id: 'era_c_programas',
    era: 'C',
    area: 'Programas',
    label: 'Programas federais e ações na área',
  },
  {
    id: 'era_c_audiencias',
    era: 'C',
    area: 'Audiências',
    label: 'Audiências e articulação formal com a área',
  },
  {
    id: 'era_c_titulos',
    era: 'C',
    area: 'Reconhecimento',
    label: 'Títulos, honrarias e homenagens ligadas à área',
  },
  defenseItem('C', 'Posições e defesas sobre a área (2015–2027)'),
]

/** @type {Record<string, Array<{ id: string, era: string, area: string, label: string, kind?: string }>>} */
const CHECKLIST_BY_UNIT = {
  municipality: MUNICIPALITY_RESEARCH_CHECKLIST,
  institution: INSTITUTION_RESEARCH_CHECKLIST,
  theme: THEME_RESEARCH_CHECKLIST,
}

const checklistFor = (unit) => CHECKLIST_BY_UNIT[unit.id] ?? MUNICIPALITY_RESEARCH_CHECKLIST

/** Municipality checklist ids (C186 surface kept stable). */
export const DOSSIER_RESEARCH_CHECKLIST_IDS = MUNICIPALITY_RESEARCH_CHECKLIST.map((item) => item.id)

/**
 * @param {string} era
 * @param {any} [unit]
 * @returns {Array<{ id: string, era: string, area: string, label: string, kind?: string }>}
 */
export const dossierChecklistForEra = (era, unit = MUNICIPALITY_UNIT) =>
  checklistFor(resolveDossierUnit(unit)).filter((item) => item.era === era)

const normalizeSphere = (value, unit) => {
  if (!isNonEmptyString(value)) return unit.defaultSphere
  const sphere = value.trim()
  return unit.spheres.includes(sphere) ? sphere : null
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
 * @typedef {Object} NormalizedDossierResearch
 * @property {string} era
 * @property {string} researchedAt
 * @property {any[]} items
 * @property {any[]} news
 * @property {any[]} gaps
 */

/**
 * Validates/normalizes one era's agent-written research JSON.
 *
 * Structural failures (no slug, no research date, no/unknown era) throw — the
 * operator fixes the file. Content failures (missing source, unknown item, item
 * from another era) degrade to explicit gaps.
 *
 * @param {any} raw
 * @param {{ unit?: any }} [options]
 * @returns {NormalizedDossierResearch & Record<string, any>}
 */
export const normalizeDossierResearchInput = (raw, { unit } = {}) => {
  const resolvedUnit = resolveDossierUnit(unit)
  const checklist = checklistFor(resolvedUnit)
  const checklistById = new Map(checklist.map((item) => [item.id, item]))
  const slug = isNonEmptyString(raw?.[resolvedUnit.slugField])
    ? raw[resolvedUnit.slugField].trim()
    : null

  if (!raw || typeof raw !== 'object') {
    throw new Error('Pesquisa do dossiê inválida: o arquivo precisa ser um objeto JSON.')
  }
  if (!slug) {
    throw new Error(`Pesquisa do dossiê inválida: falta "${resolvedUnit.slugField}".`)
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
    const sphere = normalizeSphere(entry.sphere, resolvedUnit)
    if (!sphere) {
      gaps.push({
        id,
        label: checklistItem.label,
        reason: `Esfera inválida (esperado ${resolvedUnit.spheres.join('/')}).`,
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
      // C209: `defense` items feed the "O que Solla defende" section; every other
      // item is evidence for the era/recorte sections.
      kind: checklistItem.kind ?? 'evidence',
      answer,
      // C209: `brief` is the reformulated, shorter copy the fixed A4 surfaces
      // print; the integral `answer`/`details` stay in the record and the .md.
      brief,
      // Optional short label of the position/priority (defense items); the
      // checklist `area` is the fallback when the researcher does not name it.
      position: isNonEmptyString(entry.position) ? entry.position.trim() : null,
      details: isNonEmptyString(entry.details) ? entry.details.trim() : null,
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

  for (const checklistItem of dossierChecklistForEra(era, resolvedUnit)) {
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
    [resolvedUnit.slugField]: slug,
    era,
    researchedAt: researchedAt.toISOString(),
    items,
    news,
    gaps,
  }
}

/**
 * Short receipt the researcher subagent returns (never the body).
 *
 * @param {any} research
 * @param {{ unit?: any }} [options]
 * @returns {any}
 */
export const dossierResearchReceipt = (research, { unit } = {}) => {
  const resolvedUnit = resolveDossierUnit(unit)
  const slug = research[resolvedUnit.slugField]
  return {
    slug,
    era: research.era,
    status: 'ok',
    researchPath: `${resolvedUnit.researchDir}/${slug}.${research.era.toLowerCase()}.research.json`,
    researchedAt: research.researchedAt,
    itemCount: research.items.length,
    gapCount: research.gaps.length,
    newsCount: research.news.length,
    gaps: research.gaps.map((gap) => gap.id),
  }
}

/**
 * Merges the per-era research files into one view. Fails closed when the slugs
 * disagree (a mixed bundle would print another unit's facts).
 *
 * @param {any} researches
 * @param {{ unit?: any }} [options]
 * @returns {{ eras: string[], items: any[], news: any[], gaps: any[], researchedAt: string } & Record<string, any>}
 */
export const mergeDossierResearch = (researches, { unit } = {}) => {
  const resolvedUnit = resolveDossierUnit(unit)
  const slugField = resolvedUnit.slugField
  const list = Array.isArray(researches) ? researches.filter(Boolean) : []
  if (list.length === 0) throw new Error('Dossiê sem pesquisa: nenhum arquivo por era foi lido.')
  const slug = list[0][slugField]
  for (const research of list) {
    if (research[slugField] !== slug) {
      const noun = resolvedUnit.nounPlural ?? 'municípios'
      throw new Error(
        `Pesquisas de ${noun} diferentes ("${slug}" e "${research[slugField]}") — pare e regenere.`,
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
    [slugField]: slug,
    eras: list.map((research) => research.era),
    items,
    news,
    gaps,
    researchedAt,
  }
}
