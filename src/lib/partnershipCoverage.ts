/**
 * Pure presentation logic for the Sollinha "cobertura de parcerias" reading
 * (B190): which municipalities have no linked dobradinha, and which
 * dobradinhas are orphans (no municipality linked anywhere).
 *
 * Pure module — no server/database imports. The chat tool
 * (`src/utilities/ai/tools/getPartnershipCoverage.ts`) queries the
 * collections under RBAC and delegates shaping here so the grouping rules are
 * unit-testable without payload.
 */

import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { salvadorCity } from '@/lib/salvadorCity'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

export type PartnershipCoverageMode = 'municipalities' | 'orphanDeputies'

/** One operational municipality without a dobradinha (a ZE of Salvador included). */
export type PartnershipCoverageUnit = {
  nome: string
  slug: string
  cidade: string
  regiao: string
  /** Zone number for Salvador ZEs; null for whole-municipality units. */
  zoneNumber: number | null
}

/** Zone rows the model can link to (`/campanha/municipios/<slug>`). */
type PartnershipCoverageZone = {
  nome: string
  slug: string
}

/** One row of the grouped (default) reading: a city, with its units folded. */
export type PartnershipCoverageCityRow = {
  nome: string
  /**
   * City page slug when the city is split into zone units (Salvador →
   * `salvador`), the single unit's slug otherwise, null when neither exists.
   */
  slug: string | null
  cidade: string
  regiao: string
  /** Number of operational units without a dobradinha in this city. */
  unidades: number
  zonas: PartnershipCoverageZone[]
}

export const PARTNERSHIP_COVERAGE_CRITERION = {
  municipalities: 'Municípios sem nenhuma dobradinha vinculada no cadastro atual.',
  orphanDeputies: 'Dobradinhas sem nenhum município vinculado no cadastro atual.',
} as const satisfies Record<PartnershipCoverageMode, string>

/**
 * Resolves a user-spoken identity territory tolerantly ("Vale do Jiquiriça"
 * matches the canonical "Vale do Jiquiriçá") via accent/case-folded equality
 * against the 27 canonical names. Returns undefined when nothing matches.
 */
export const resolveIdentityTerritory = (input: string): BahiaIdentityTerritory | undefined => {
  const normalized = normalizeSearchPhrase(input)
  if (!normalized) return undefined
  return bahiaIdentityTerritories.find(
    (territory) => normalizeSearchPhrase(territory) === normalized,
  )
}

const compareUnits = (left: PartnershipCoverageUnit, right: PartnershipCoverageUnit): number =>
  left.regiao.localeCompare(right.regiao, 'pt-BR') ||
  left.cidade.localeCompare(right.cidade, 'pt-BR') ||
  (left.zoneNumber ?? Number.POSITIVE_INFINITY) - (right.zoneNumber ?? Number.POSITIVE_INFINITY) ||
  left.nome.localeCompare(right.nome, 'pt-BR')

/**
 * Coverage is a reading of the operational catalog: region asc, then city
 * asc, then zone number asc — a stable order the model can echo back.
 */
export const sortCoverageUnits = (
  units: readonly PartnershipCoverageUnit[],
): PartnershipCoverageUnit[] => [...units].sort(compareUnits)

/** The city page slug for a split city (Salvador today); null otherwise. */
const cityPageSlug = (cidade: string): string | null =>
  cidade === salvadorCity.city ? salvadorCity.slug : null

/**
 * Groups units by city, folding a split city (Salvador's ZEs) into one row
 * with its zone list. Input is expected sorted by `sortCoverageUnits`, which
 * the grouping preserves: zones arrive in zone order, cities in region order.
 */
export const groupCoverageByCity = (
  units: readonly PartnershipCoverageUnit[],
): PartnershipCoverageCityRow[] => {
  const rows: PartnershipCoverageCityRow[] = []
  for (const unit of units) {
    const previous = rows[rows.length - 1]
    if (previous && previous.cidade === unit.cidade) {
      previous.unidades += 1
      previous.zonas.push({ nome: unit.nome, slug: unit.slug })
      continue
    }
    rows.push({
      nome: unit.cidade,
      slug: cityPageSlug(unit.cidade) ?? unit.slug,
      cidade: unit.cidade,
      regiao: unit.regiao,
      unidades: 1,
      zonas: [{ nome: unit.nome, slug: unit.slug }],
    })
  }
  return rows
}

/** Orphan dobradinhas read alphabetically (pt-BR) — stable for the model. */
export const sortOrphanDobradinhas = <T extends { nome: string }>(rows: readonly T[]): T[] =>
  [...rows].sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
