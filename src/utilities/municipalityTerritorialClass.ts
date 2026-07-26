import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { captureRate, ownVotes2022, projectedFieldCeiling } from '@/utilities/municipalityPotential'

/**
 * E10 "classificação territorial relativa" — the operational class of one
 * município, read from the committed `bahia-federal-baseline.json` artifact
 * alone (pure functions, no DB, no `campaignGoals`, no user).
 *
 * Why relative anchors: the class the campaign inherited from the majoritarian
 * era used absolute shares of local valid votes (35/20/10). In a federal-deputy
 * race the candidate's local share is typically 1–5%, so every município in the
 * state collapsed into the worst class. The research report (§6, "limiares
 * 35/20/10 degeneram em DF") prescribes anchoring on multiples of the
 * candidate's OWN statewide share (a location quotient) and reading more than
 * one axis: dominance + how much of his own vote lives here + how much field
 * vote is still uncaptured.
 */

/** Reference year: the field ceiling is 2022-only in the artifact by design. */
const TERRITORIAL_CLASS_YEAR = ELECTION_YEAR_2022

export const TERRITORIAL_CLASSES = [
  'reduto',
  'expansao',
  'manutencao',
  'marginal',
  'sem_base',
] as const

export type MunicipalityTerritorialClass = (typeof TERRITORIAL_CLASSES)[number]

/**
 * Cuts are ILLUSTRATIVE, not calibrated: the research report gives the shape
 * (LQ > 2–3 = reduto, ~1 = padrão, < 0,5 = fraqueza) and says the exact
 * numbers can only come from a backtest against 2014–2022 — that is **E15**.
 * They live here, named and versioned, so recalibration is a one-line diff
 * with a test to prove what moved.
 */
export const TERRITORIAL_CLASS_ANCHORS = {
  /** LQ at or above this = performing at least 2× his own statewide standard. */
  strongLq: 2,
  /** LQ below this = performing at less than half his own standard. */
  weakLq: 0.5,
  /** Municípios that together hold this share of his statewide vote are the "core block". */
  coreCumulativeShare: 0.5,
} as const

/** The axes behind a class — the UI always shows the "por quê", never the label alone. */
type TerritorialFactorId = 'dominance' | 'ownShare' | 'field' | 'capture'

export type TerritorialFactor = {
  id: TerritorialFactorId
  /**
   * `dominance` = LQ (ratio); `ownShare` = share of his statewide vote (0..1);
   * `field` = uncaptured field votes (absolute); `capture` = capture rate (0..1).
   */
  value: number
}

export type MunicipalityTerritorialClassification = {
  class: MunicipalityTerritorialClass
  /** Ordered by relevance to the class — surfaces show the first two. */
  factors: TerritorialFactor[]
  /** Location quotient vs. his own statewide share; null without a local electorate. */
  lq: number | null
  /** Share of his statewide vote that comes from here (the mesa's own anchor, A11). */
  ownShare: number
  /** Field votes (projected 2022 ceiling) his candidacy did not capture. */
  fieldHeadroom: number
  /** True when the município belongs to the block holding `coreCumulativeShare` of his vote. */
  inCoreBlock: boolean
}

export type TerritorialClassInput = {
  ownVotes: number
  validVotes: number
  stateOwnVotes: number
  stateValidVotes: number
  /** Projected field ceiling minus own votes (E8), floored at 0. */
  fieldHeadroom: number
  /** Median `fieldHeadroom` across the catalog — the relative "big field" cut. */
  medianFieldHeadroom: number
  captureRate: number | null
  inCoreBlock: boolean
}

const UNCLASSIFIED: MunicipalityTerritorialClassification = {
  class: 'sem_base',
  factors: [],
  lq: null,
  ownShare: 0,
  fieldHeadroom: 0,
  inCoreBlock: false,
}

/**
 * Pure classifier over explicit inputs (the artifact-backed wrapper below
 * fills them in). Order of the rules is the reading order of the mesa:
 * dominance first, then — only for the weak half — whether there is field
 * left to win.
 */
export const classifyMunicipalityTerritory = (
  input: TerritorialClassInput,
): MunicipalityTerritorialClassification => {
  const { ownVotes, validVotes, stateOwnVotes, stateValidVotes } = input
  if (validVotes <= 0 || stateValidVotes <= 0 || stateOwnVotes <= 0) return UNCLASSIFIED

  const stateShare = stateOwnVotes / stateValidVotes
  const lq = ownVotes / validVotes / stateShare
  const ownShare = ownVotes / stateOwnVotes
  const shared = {
    lq,
    ownShare,
    fieldHeadroom: input.fieldHeadroom,
    inCoreBlock: input.inCoreBlock,
  }
  const dominance: TerritorialFactor = { id: 'dominance', value: lq }
  const ownShareFactor: TerritorialFactor = { id: 'ownShare', value: ownShare }
  const fieldFactor: TerritorialFactor = { id: 'field', value: input.fieldHeadroom }
  const captureFactor: TerritorialFactor[] =
    input.captureRate === null ? [] : [{ id: 'capture', value: input.captureRate }]

  if (lq >= TERRITORIAL_CLASS_ANCHORS.strongLq) {
    // Reduto de conta vs. reduto simbólico is the `ownShare` factor's job
    // (P10: the trophy município must not eat the agenda of the ones that
    // close the quotient), not a fifth class.
    return { ...shared, class: 'reduto', factors: [dominance, ownShareFactor, ...captureFactor] }
  }

  if (lq < TERRITORIAL_CLASS_ANCHORS.weakLq) {
    // A município inside the core block carries real votes even while
    // under-performing, so it can never read as "marginal" — the honest label
    // there is expansão (big base, low penetration).
    const hasFieldLeft = input.fieldHeadroom >= input.medianFieldHeadroom || input.inCoreBlock
    return hasFieldLeft
      ? { ...shared, class: 'expansao', factors: [fieldFactor, dominance, ...captureFactor] }
      : { ...shared, class: 'marginal', factors: [dominance, fieldFactor] }
  }

  return { ...shared, class: 'manutencao', factors: [dominance, ownShareFactor, ...captureFactor] }
}

/** Uncaptured field votes: projected 2022 field ceiling minus his own vote. */
const fieldHeadroomOf = (baseline: MunicipalityFederalBaseline): number =>
  Math.max(0, projectedFieldCeiling(baseline) - ownVotes2022(baseline))

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

type CatalogContext = {
  medianFieldHeadroom: number
  coreBlockSlugs: ReadonlySet<string>
}

let catalogContext: CatalogContext | null = null

/**
 * Catalog-wide reference values, computed once per process (the artifact is
 * immutable): the median field headroom — a relative cut, so no magic vote
 * count ages — and the set of municípios that, sorted by his own vote,
 * accumulate `coreCumulativeShare` of his statewide total.
 */
const getCatalogContext = (): CatalogContext => {
  if (catalogContext) return catalogContext

  const rows = federalBaselineMunicipalitySlugs().map((slug) => {
    const baseline = getMunicipalityFederalBaseline(slug)
    return {
      slug,
      ownVotes: ownVotes2022(baseline),
      fieldHeadroom: fieldHeadroomOf(baseline),
      hasFieldData: projectedFieldCeiling(baseline) > 0,
    }
  })

  // Slugs whose majoritarian cell is missing would drag the median to zero and
  // make every weak município read as "expansão".
  const medianFieldHeadroom = median(
    rows.filter((row) => row.hasFieldData).map((row) => row.fieldHeadroom),
  )

  const stateOwnVotes = getStatewideFederalTotals(TERRITORIAL_CLASS_YEAR).ownVotes
  const coreBlockSlugs = new Set<string>()
  let accumulated = 0
  for (const row of [...rows].sort(
    (a, b) => b.ownVotes - a.ownVotes || a.slug.localeCompare(b.slug),
  )) {
    if (accumulated >= stateOwnVotes * TERRITORIAL_CLASS_ANCHORS.coreCumulativeShare) break
    coreBlockSlugs.add(row.slug)
    accumulated += row.ownVotes
  }

  catalogContext = { medianFieldHeadroom, coreBlockSlugs }
  return catalogContext
}

const classificationBySlug = new Map<string, MunicipalityTerritorialClassification>()

/** Classification for one catalog slug — memoized, pure over the artifact. */
export const computeMunicipalityTerritorialClass = (
  slug: string,
): MunicipalityTerritorialClassification => {
  const cached = classificationBySlug.get(slug)
  if (cached) return cached

  const baseline = getMunicipalityFederalBaseline(slug)
  const totals = getStatewideFederalTotals(TERRITORIAL_CLASS_YEAR)
  const { medianFieldHeadroom, coreBlockSlugs } = getCatalogContext()

  const classification = classifyMunicipalityTerritory({
    ownVotes: ownVotes2022(baseline),
    validVotes: baseline.validVotesByYear[String(TERRITORIAL_CLASS_YEAR)] ?? 0,
    stateOwnVotes: totals.ownVotes,
    stateValidVotes: totals.validVotes,
    fieldHeadroom: fieldHeadroomOf(baseline),
    medianFieldHeadroom,
    captureRate: captureRate(baseline),
    inCoreBlock: coreBlockSlugs.has(slug),
  })

  classificationBySlug.set(slug, classification)
  return classification
}

/**
 * Sort weight for the list's `classe` ordering: descending puts the
 * municípios that carry the campaign (reduto) first and the ones without a
 * baseline last, in either direction.
 */
export const territorialClassSortWeight: Record<MunicipalityTerritorialClass, number | null> = {
  reduto: 4,
  expansao: 3,
  manutencao: 2,
  marginal: 1,
  sem_base: null,
}
