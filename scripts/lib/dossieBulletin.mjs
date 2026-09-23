/**
 * Boletim model (owner: C186; unit seam C187): one A4 page, voter-facing. It
 * reads ONLY the `bulletinFacts` ledger produced by `buildDossierReport` — every
 * fact there already carries a source, so the boletim cannot introduce a new
 * fact. No sources are printed (they live in the dossiê). C209: the ledger also
 * carries the `defense` facts ("O que Solla defende"), printed outside the
 * highlight ranking and counted in the "e mais N" line.
 */

import { formatDateTimeBr } from './cityReportFormat.mjs'
import { dossierPhaseLabel } from './dossieBlocks.mjs'
import { BULLETIN_TIMELINE_STEPS } from './dossieCareer.mjs'
import { resolveDossierUnit } from './dossieUnit.mjs'

export const BULLETIN_HIGHLIGHT_LIMIT = 6
const BULLETIN_MORE_LIMIT = 14
/** "O que Solla defende" budget of the one-page boletim (design cena 12). */
export const BULLETIN_DEFENSE_LIMIT = 2

const eraRank = { C: 0, B: 1, A: 2 }

const rankFacts = (facts, unit) => {
  const sphereRank = resolveDossierUnit(unit).breadthRank ?? {}
  return [...facts].sort((left, right) => {
    const sphere = (sphereRank[left.sphere] ?? 9) - (sphereRank[right.sphere] ?? 9)
    if (sphere !== 0) return sphere
    const hasValue = (left.value ? 0 : 1) - (right.value ? 0 : 1)
    if (hasValue !== 0) return hasValue
    const era = (eraRank[left.era] ?? 9) - (eraRank[right.era] ?? 9)
    if (era !== 0) return era
    return String(left.id).localeCompare(String(right.id))
  })
}

/**
 * @param {{
 *   facts?: Array<{ id: string, era: string, sphere: string, area: string, defense?: boolean, headline: string, detail: string|null, value: string|null, year: string|null, phase: string|null, sourceUrl: string, sourceDate: string, sourcePanel?: boolean }>,
 *   municipality?: string,
 *   region?: string | null,
 *   identity?: { name: string, badges?: string[] } | null,
 *   unit?: any,
 *   generatedAt?: Date,
 *   printLimit?: number | null,
 *   defenseLimit?: number,
 * }} params
 */
export const buildBulletin = ({
  facts = [],
  municipality = null,
  region = null,
  identity = null,
  unit,
  generatedAt = new Date(),
  printLimit = null,
  defenseLimit = BULLETIN_DEFENSE_LIMIT,
}) => {
  const resolvedUnit = resolveDossierUnit(unit)
  const ordered = rankFacts(facts, resolvedUnit)
  // The acervo sample is a source panel, not a finding (C190): it is counted in
  // the one-pager but never takes a printed slot from a sourced finding. The
  // defenses (C209) are their own block, outside the highlight ranking.
  const printable = ordered.filter((fact) => !fact.sourcePanel && !fact.defense)
  const defenseFacts = ordered.filter((fact) => fact.defense)
  const target =
    printLimit === null
      ? BULLETIN_HIGHLIGHT_LIMIT + (resolvedUnit.bulletinMoreLimit ?? BULLETIN_MORE_LIMIT)
      : Math.max(0, printLimit)
  const printed = printable.slice(0, target)
  const subjectName = municipality ?? identity?.name ?? '—'
  const highlights = printed.slice(0, BULLETIN_HIGHLIGHT_LIMIT).map((fact) => {
    // Theme-only fallback: a fact without money value shows its year; without
    // either, the line prints no number at all (never a fake zero).
    const number = resolvedUnit.bulletinNumberFallback
      ? (fact.value ?? fact.year ?? null)
      : fact.value
    return {
      number,
      title: fact.brief?.title ?? fact.headline,
      note: fact.brief?.note ?? fact.detail ?? null,
      phaseLabel: fact.value ? dossierPhaseLabel(fact.phase) : null,
    }
  })
  const moreItems = printed.slice(BULLETIN_HIGHLIGHT_LIMIT).map((fact) => ({
    label: fact.brief?.title ?? fact.headline,
    detail: fact.brief?.note ?? fact.detail ?? fact.value ?? fact.area,
  }))
  const defenses = defenseFacts.slice(0, Math.max(0, defenseLimit)).map((fact) => ({
    label: fact.brief?.title ?? fact.headline,
    text: fact.brief?.note ?? fact.detail ?? fact.headline,
  }))
  const shown = highlights.length + moreItems.length + defenses.length

  return {
    unit: resolvedUnit,
    sparse: printable.length < 3,
    meta: {
      title: resolvedUnit.bulletinTitle,
      kicker:
        resolvedUnit.bulletinKicker ??
        (municipality
          ? `Boletim informativo · ${subjectName}`
          : 'Boletim informativo · atuação pública'),
      subjectName,
      municipality: subjectName,
      region,
      identity,
      identityBadges: identity?.badges ?? [],
      generatedAt,
      generatedAtLabel: formatDateTimeBr(generatedAt),
      modelLabel: 'Modelo — insumo interno',
    },
    highlights,
    defenses,
    moreItems,
    // Never a silent drop (C188): the facts beyond the caps — and the whole
    // source panel — are counted so the one-page boletim states how much of the
    // sourced set it left out.
    factsTotal: ordered.length,
    factsPrintable: printable.length + defenseFacts.length,
    factsPrinted: shown,
    factsRemaining: ordered.length - shown,
    timeline: BULLETIN_TIMELINE_STEPS,
  }
}

/**
 * One shrink step of the one-page fit (C190/C209): reduce the printed highlights
 * first (two at a time), then the defenses (2 → 1 → 0). Returns the options for
 * the next `buildBulletin`, or null when there is nothing left to cut — the
 * builder then fails closed instead of truncating.
 *
 * @param {any} bulletin
 * @returns {{ printLimit?: number, defenseLimit?: number } | null}
 */
export const nextBulletinFit = (bulletin) => {
  const printedFacts = bulletin.highlights.length + bulletin.moreItems.length
  if (printedFacts > 0) return { printLimit: Math.max(0, printedFacts - 2) }
  if (bulletin.defenses.length > 1) return { printLimit: 0, defenseLimit: 1 }
  if (bulletin.defenses.length > 0) return { printLimit: 0, defenseLimit: 0 }
  return null
}
