/**
 * Briefing de capacitação — content contract and print budget (C210, owner: the
 * briefing build).
 *
 * The briefing is an internal training handout derived from the dossiê: the
 * authored `<slug>.briefing.json` may only point at facts whose source the
 * dossiê ledger already carries (`buildDossierReport().bulletinFacts`), never at
 * new research. This module owns the fail-closed validation, the deny-list that
 * keeps staff-only/scenario keys out and the deterministic shed order that keeps
 * the four-page cap honest: the PDF prints at most four fixed sheets, so on
 * overflow the lowest-priority lists lose items (declared, never silent) and
 * everything stays in the companion `.md`.
 */

export const BRIEFING_LABEL = 'Insumo interno de capacitação — não publicar'
export const BRIEFING_PAGE_TOTAL = 4
export const BRIEFING_ANCHORS = ['essencial', 'defesas', 'qa', 'evitar']
export const BRIEFING_QA_SIDES = ['direita', 'esquerda', 'entrega']
/** Sides the briefing must always print at least once (C210 guardrail). */
const REQUIRED_QA_SIDES = ['direita', 'esquerda']

export const BRIEFING_MINIMUMS = {
  essential: 3,
  scriptSteps: 3,
  qa: 4,
  avoid: 3,
  beforeAnswer: 2,
  unsure: 2,
}

/** Staff-only electoral scenarios never enter the handout (intention guardrail). */
const FORBIDDEN_KEYS = [
  'estimatedVotes',
  'estimated',
  'scenario',
  'cenario',
  'cenarios',
  'projection',
  'projecao',
  'staffOnly',
  'internalVotes',
  'polls',
]

/** Author-facing caps: reported as warnings — the page-fit guard is the hard limit. */
const TEXT_CAPS = {
  lede: 380,
  subtitle: 160,
  essentialTitle: 120,
  essentialNote: 200,
  defenseTitle: 120,
  defenseNote: 200,
  scriptTitle: 90,
  scriptNote: 220,
  qaQuestion: 180,
  qaAcknowledge: 200,
  qaAnswer: 520,
  qaClose: 200,
  avoidTitle: 120,
  avoidNote: 200,
  checklistItem: 200,
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

const fail = (message) => {
  throw new Error(message)
}

const assertKey = (raw, key, label) => {
  if (!isNonEmptyString(raw?.[key])) fail(`${label}: campo "${key}" obrigatório e não vazio.`)
}

const assertNoForbiddenKeys = (value, label) => {
  if (Array.isArray(value)) {
    for (const entry of value) assertNoForbiddenKeys(entry, label)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      fail(`${label}: chave "${key}" proibida — cenário/estimativa é staff-only, fora do briefing.`)
    }
    assertNoForbiddenKeys(entry, label)
  }
}

const assertList = (value, label) => {
  if (!Array.isArray(value)) fail(`${label}: lista obrigatória.`)
}

const assertMinimum = (list, minimum, label) => {
  if (list.length < minimum) {
    fail(`${label}: mínimo de ${minimum} item(ns) — recebidos ${list.length}.`)
  }
}

const warnIfOver = (warnings, text, max, label) => {
  if (typeof text === 'string' && text.length > max) {
    warnings.push(`${label}: ${text.length} chars (máx. ${max}) — encurte para caber na folha.`)
  }
}

/**
 * The ledger fact the anchor points at (the `bulletinFacts` contract). The
 * acervo sample (`sourcePanel`) is a declared panel, not a finding — the
 * bulletin already refuses it a printed slot, so the briefing refuses it an
 * anchor: an "essencial" item is never a speech sample.
 *
 * @param {any[]} facts
 * @param {string} factId
 * @returns {any|null}
 */
export const briefingAnchorFact = (facts, factId) =>
  (Array.isArray(facts) ? facts : []).find((fact) => fact?.id === factId && !fact.sourcePanel) ??
  null

/**
 * The anchor rule of every item: exactly one of `factId | gapReason`, and a
 * `factId` only counts when it resolves in a sourced, non-panel ledger fact.
 * Returns the resolved anchor; `normalizeAnchor` adds the copy validation.
 */
const resolveAnchor = (item, { facts, label }) => {
  const hasFact = isNonEmptyString(item.factId)
  const hasGap = isNonEmptyString(item.gapReason)
  if (hasFact === hasGap) {
    fail(`${label}: exige exatamente um de "factId" | "gapReason".`)
  }
  if (hasGap) return { factId: null, gapReason: item.gapReason.trim(), fact: null }
  const fact = briefingAnchorFact(facts, item.factId)
  if (!fact?.sourceUrl) {
    fail(
      `${label}: factId "${item.factId}" não resolve em fato com fonte do dossiê — sem fonte, não entra.`,
    )
  }
  return { factId: fact.id, gapReason: null, fact }
}

const normalizeAnchor = (
  item,
  { facts, label, warnings, titleKey, noteKey, titleCap, noteCap },
) => {
  assertKey(item, titleKey, label)
  assertKey(item, noteKey, label)
  warnIfOver(warnings, item[titleKey], titleCap, `${label}.${titleKey}`)
  warnIfOver(warnings, item[noteKey], noteCap, `${label}.${noteKey}`)
  return {
    title: item[titleKey].trim(),
    note: item[noteKey].trim(),
    ...resolveAnchor(item, { facts, label }),
  }
}

const normalizeEssential = (raw, options) =>
  (raw.essential ?? []).map((item, index) =>
    normalizeAnchor(item, {
      ...options,
      label: `essential[${index}]`,
      titleKey: 'title',
      noteKey: 'note',
      titleCap: TEXT_CAPS.essentialTitle,
      noteCap: TEXT_CAPS.essentialNote,
    }),
  )

const normalizeDefenses = (raw, options) =>
  (raw.defenses ?? []).map((item, index) =>
    normalizeAnchor(item, {
      ...options,
      label: `defenses[${index}]`,
      titleKey: 'title',
      noteKey: 'note',
      titleCap: TEXT_CAPS.defenseTitle,
      noteCap: TEXT_CAPS.defenseNote,
    }),
  )

const normalizeScript = (raw, options) => {
  const steps = raw.script?.steps ?? []
  assertList(steps, 'script.steps')
  assertMinimum(steps, BRIEFING_MINIMUMS.scriptSteps, 'script.steps')
  return {
    steps: steps.map((step, index) => {
      assertKey(step, 'title', `script.steps[${index}]`)
      assertKey(step, 'note', `script.steps[${index}]`)
      warnIfOver(
        options.warnings,
        step.title,
        TEXT_CAPS.scriptTitle,
        `script.steps[${index}].title`,
      )
      warnIfOver(options.warnings, step.note, TEXT_CAPS.scriptNote, `script.steps[${index}].note`)
      return { title: step.title.trim(), note: step.note.trim() }
    }),
  }
}

const normalizeQa = (raw, options) => {
  const qa = raw.qa ?? []
  assertList(qa, 'qa')
  assertMinimum(qa, BRIEFING_MINIMUMS.qa, 'qa')
  const items = qa.map((item, index) => {
    const label = `qa[${index}]`
    if (!BRIEFING_QA_SIDES.includes(item?.side)) {
      fail(`${label}: side inválido — use ${BRIEFING_QA_SIDES.join(' | ')}.`)
    }
    for (const key of ['question', 'acknowledge', 'answer', 'close']) {
      assertKey(item, key, label)
    }
    warnIfOver(options.warnings, item.question, TEXT_CAPS.qaQuestion, `${label}.question`)
    warnIfOver(options.warnings, item.acknowledge, TEXT_CAPS.qaAcknowledge, `${label}.acknowledge`)
    warnIfOver(options.warnings, item.answer, TEXT_CAPS.qaAnswer, `${label}.answer`)
    warnIfOver(options.warnings, item.close, TEXT_CAPS.qaClose, `${label}.close`)
    const anchor = resolveAnchor(
      { factId: item.factId, gapReason: item.gapReason },
      { facts: options.facts, label },
    )
    return {
      side: item.side,
      question: item.question.trim(),
      acknowledge: item.acknowledge.trim(),
      answer: item.answer.trim(),
      close: item.close.trim(),
      ...anchor,
    }
  })
  const sides = new Set(items.map((item) => item.side))
  if (!REQUIRED_QA_SIDES.every((side) => sides.has(side))) {
    fail('qa: o briefing cobre os dois lados — exige ao menos 1 "direita" e 1 "esquerda".')
  }
  return items
}

const normalizeAvoid = (raw, options) => {
  const avoid = raw.avoid ?? []
  assertList(avoid, 'avoid')
  assertMinimum(avoid, BRIEFING_MINIMUMS.avoid, 'avoid')
  return avoid.map((item, index) => {
    assertKey(item, 'title', `avoid[${index}]`)
    assertKey(item, 'note', `avoid[${index}]`)
    warnIfOver(options.warnings, item.title, TEXT_CAPS.avoidTitle, `avoid[${index}].title`)
    warnIfOver(options.warnings, item.note, TEXT_CAPS.avoidNote, `avoid[${index}].note`)
    return { title: item.title.trim(), note: item.note.trim() }
  })
}

const normalizeChecklist = (raw, options) => {
  const beforeAnswer = raw.checklist?.beforeAnswer ?? []
  const unsure = raw.checklist?.unsure ?? []
  assertList(beforeAnswer, 'checklist.beforeAnswer')
  assertList(unsure, 'checklist.unsure')
  assertMinimum(beforeAnswer, BRIEFING_MINIMUMS.beforeAnswer, 'checklist.beforeAnswer')
  assertMinimum(unsure, BRIEFING_MINIMUMS.unsure, 'checklist.unsure')
  const items = (list, label) =>
    list.map((value, index) => {
      if (!isNonEmptyString(value)) fail(`${label}[${index}]: item não vazio.`)
      warnIfOver(options.warnings, value, TEXT_CAPS.checklistItem, `${label}[${index}]`)
      return value.trim()
    })
  return {
    beforeAnswer: items(beforeAnswer, 'checklist.beforeAnswer'),
    unsure: items(unsure, 'checklist.unsure'),
  }
}

/**
 * Fail-closed normalization of the authored briefing. Every anchor must resolve
 * in the sourced ledger; a lacuna is declared with `gapReason`, never invented.
 *
 * @param {any} raw parsed `<slug>.briefing.json`
 * @param {{ unit: any, slug: string, facts?: any[] }} options
 * @returns {any} normalized content + warnings
 */
export const normalizeBriefingContent = (raw, { unit, slug, facts = [] }) => {
  if (!raw || typeof raw !== 'object') fail('briefing.json inválido: objeto esperado.')
  if (unit?.id && raw.unitId !== unit.id) {
    fail(`briefing.json: unitId "${raw.unitId ?? '—'}" não é "${unit.id}".`)
  }
  const slugField = unit?.slugField ?? 'slug'
  assertKey(raw, slugField, 'briefing.json')
  if (raw[slugField].trim() !== slug) {
    fail(`briefing.json: ${slugField} "${raw[slugField]}" não é "${slug}" — pare e regenere.`)
  }
  assertKey(raw, 'generatedAt', 'briefing.json')
  if (Number.isNaN(new Date(raw.generatedAt).getTime())) {
    fail(`briefing.json: generatedAt inválido ("${raw.generatedAt}").`)
  }
  assertKey(raw, 'lede', 'briefing.json')
  assertNoForbiddenKeys(raw, 'briefing.json')

  const warnings = []
  warnIfOver(warnings, raw.lede, TEXT_CAPS.lede, 'lede')
  warnIfOver(warnings, raw.subtitle, TEXT_CAPS.subtitle, 'subtitle')

  const essential = normalizeEssential(raw, { facts, warnings })
  assertMinimum(essential, BRIEFING_MINIMUMS.essential, 'essential')

  return {
    slug: raw[slugField].trim(),
    generatedAt: new Date(raw.generatedAt),
    subtitle: isNonEmptyString(raw.subtitle) ? raw.subtitle.trim() : null,
    lede: raw.lede.trim(),
    essential,
    defenses: normalizeDefenses(raw, { facts, warnings }),
    script: normalizeScript(raw, { facts, warnings }),
    qa: normalizeQa(raw, { facts, warnings }),
    avoid: normalizeAvoid(raw, { facts, warnings }),
    checklist: normalizeChecklist(raw, { facts, warnings }),
    shed: { qa: 0, defenses: 0, checklist: 0, avoid: 0 },
    warnings,
  }
}

/**
 * The last qa item whose removal still leaves one representative of each
 * required side — the shed never silences a side (the bulletin/briefing
 * contract prints both). `-1` when only the minimums remain.
 */
const qaShedIndex = (qa) => {
  for (let index = qa.length - 1; index >= 0; index -= 1) {
    const sides = new Set(
      qa.filter((_item, position) => position !== index).map((item) => item.side),
    )
    if (REQUIRED_QA_SIDES.every((side) => sides.has(side))) return index
  }
  return -1
}

/**
 * One shed step: drop a single item from the lowest-priority list that is still
 * above its minimum (qa → defesas → conferir → evitar), never breaking the
 * two-sides coverage. Essential, roteiro and identification never shed. Returns
 * a new content object, or `null` when nothing else may be dropped — the caller
 * then fails closed.
 *
 * @param {any} content
 * @returns {any|null}
 */
export const trimBriefing = (content) => {
  const shed = { ...content.shed }
  if (content.qa.length > BRIEFING_MINIMUMS.qa) {
    const index = qaShedIndex(content.qa)
    if (index !== -1) {
      shed.qa += 1
      return {
        ...content,
        qa: content.qa.filter((_item, position) => position !== index),
        shed,
      }
    }
  }
  if (content.defenses.length > 0) {
    shed.defenses += 1
    return { ...content, defenses: content.defenses.slice(0, -1), shed }
  }
  const checklistTotal = content.checklist.beforeAnswer.length + content.checklist.unsure.length
  if (checklistTotal > BRIEFING_MINIMUMS.beforeAnswer + BRIEFING_MINIMUMS.unsure) {
    shed.checklist += 1
    if (content.checklist.unsure.length > BRIEFING_MINIMUMS.unsure) {
      return {
        ...content,
        checklist: { ...content.checklist, unsure: content.checklist.unsure.slice(0, -1) },
        shed,
      }
    }
    return {
      ...content,
      checklist: {
        ...content.checklist,
        beforeAnswer: content.checklist.beforeAnswer.slice(0, -1),
      },
      shed,
    }
  }
  if (content.avoid.length > BRIEFING_MINIMUMS.avoid) {
    shed.avoid += 1
    return { ...content, avoid: content.avoid.slice(0, -1), shed }
  }
  return null
}
