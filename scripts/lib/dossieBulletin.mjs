/**
 * Boletim model (C186): one A4 page, voter-facing. It reads ONLY the
 * `bulletinFacts` ledger produced by `buildDossierReport` — every fact there
 * already carries a source, so the boletim cannot introduce a new fact. No
 * sources are printed (they live in the dossiê).
 */

import { formatDateTimeBr } from './cityReportFormat.mjs'
import { dossierSphereLabel } from './dossieBlocks.mjs'
import { BULLETIN_TIMELINE_STEPS } from './dossieCareer.mjs'

export const BULLETIN_HIGHLIGHT_LIMIT = 6
export const BULLETIN_MORE_LIMIT = 14

const sphereRank = { municipio: 0, regiao: 1, polo: 2 }
const eraRank = { C: 0, B: 1, A: 2 }

const rankFacts = (facts) =>
  [...facts].sort((left, right) => {
    const sphere = (sphereRank[left.sphere] ?? 9) - (sphereRank[right.sphere] ?? 9)
    if (sphere !== 0) return sphere
    const hasValue = (left.value ? 0 : 1) - (right.value ? 0 : 1)
    if (hasValue !== 0) return hasValue
    const era = (eraRank[left.era] ?? 9) - (eraRank[right.era] ?? 9)
    if (era !== 0) return era
    return String(left.id).localeCompare(String(right.id))
  })

/**
 * @param {{
 *   facts?: Array<{ id: string, era: string, sphere: string, area: string, headline: string, detail: string|null, value: string|null, year: string|null, phase: string|null, sourceUrl: string, sourceDate: string }>,
 *   municipality: string,
 *   region?: string | null,
 *   generatedAt?: Date,
 * }} params
 */
export const buildBulletin = ({
  facts = [],
  municipality,
  region = null,
  generatedAt = new Date(),
}) => {
  const ordered = rankFacts(facts)
  const highlights = ordered.slice(0, BULLETIN_HIGHLIGHT_LIMIT).map((fact) => ({
    eyebrow: `${fact.area ?? 'Atuação'} · ${dossierSphereLabel(fact.sphere)}`,
    number: fact.value,
    title: fact.headline,
    note: fact.detail ?? null,
  }))
  const moreItems = ordered
    .slice(BULLETIN_HIGHLIGHT_LIMIT, BULLETIN_HIGHLIGHT_LIMIT + BULLETIN_MORE_LIMIT)
    .map((fact) => ({
      label: fact.headline,
      detail: fact.detail ?? fact.value ?? fact.area,
    }))

  return {
    meta: {
      title: 'Boletim informativo modelo',
      kicker: 'Boletim informativo · atuação pública',
      municipality,
      region,
      generatedAt,
      generatedAtLabel: formatDateTimeBr(generatedAt),
      modelLabel: 'Modelo — insumo interno',
    },
    highlights,
    moreItems,
    timeline: BULLETIN_TIMELINE_STEPS,
  }
}
