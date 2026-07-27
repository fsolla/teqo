import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { medianOf } from '@/lib/median'
import { computeVoteRankByYear } from '@/lib/municipalityVoteRank'
import { TERRITORIAL_CLASS_ANCHORS } from '@/lib/territorialClassAnchors'
import { territorialClassSortWeight } from '@/lib/territorialClassSortWeight'
import {
  captureRate,
  fieldCeiling,
  ownVotes2022,
  projectedFieldCeiling,
} from '@/utilities/municipalityPotential'

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
  /**
   * The "big field" cut `fieldHeadroom` is measured against: the catalog
   * median for one município, and that median times the group size for an
   * aggregate — headroom is a level, not a ratio, so a summed one has to be
   * compared against a reference summed the same way.
   */
  fieldHeadroomCut: number
  captureRate: number | null
  inCoreBlock: boolean
}

const UNCLASSIFIED: MunicipalityTerritorialClassification = {
  class: 'sem_base',
  factors: [],
  lq: null,
  ownShare: 0,
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
  const shared = { lq, ownShare, inCoreBlock: input.inCoreBlock }
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
    const hasFieldLeft = input.fieldHeadroom >= input.fieldHeadroomCut || input.inCoreBlock
    return hasFieldLeft
      ? { ...shared, class: 'expansao', factors: [fieldFactor, dominance, ...captureFactor] }
      : { ...shared, class: 'marginal', factors: [dominance, fieldFactor] }
  }

  return { ...shared, class: 'manutencao', factors: [dominance, ownShareFactor, ...captureFactor] }
}

/** Uncaptured field votes: projected 2022 field ceiling minus his own vote. */
const fieldHeadroomOf = (baseline: MunicipalityFederalBaseline): number =>
  Math.max(0, projectedFieldCeiling(baseline) - ownVotes2022(baseline))

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

  // Slugs whose majoritarian cell is missing would drag the median to zero and
  // make every weak município read as "expansão".
  const medianFieldHeadroom =
    medianOf(
      federalBaselineMunicipalitySlugs()
        .map(getMunicipalityFederalBaseline)
        .filter((baseline) => projectedFieldCeiling(baseline) > 0)
        .map(fieldHeadroomOf),
    ) ?? 0

  // A11 already ranks every slug by own vote, descending, and memoizes it —
  // walking that map is the same order this used to re-sort for itself.
  const coreVoteTarget =
    getStatewideFederalTotals(TERRITORIAL_CLASS_YEAR).ownVotes *
    TERRITORIAL_CLASS_ANCHORS.coreCumulativeShare
  const coreBlockSlugs = new Set<string>()
  let accumulated = 0
  for (const [slug, entry] of computeVoteRankByYear(TERRITORIAL_CLASS_YEAR)) {
    if (accumulated >= coreVoteTarget) break
    coreBlockSlugs.add(slug)
    accumulated += entry.votes
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
    fieldHeadroomCut: medianFieldHeadroom,
    captureRate: captureRate(baseline),
    inCoreBlock: coreBlockSlugs.has(slug),
  })

  classificationBySlug.set(slug, classification)
  return classification
}

/**
 * The class of a GROUP of catalog slugs read as one territory — the map paints
 * one polygon per IBGE municipality, and Salvador is 19 catalog slugs.
 *
 * It sums the inputs and runs the SAME `classifyMunicipalityTerritory`; it
 * never averages or votes on the per-slug classes, because LQ is a ratio and
 * the average of ratios is not the ratio of the sums. The ratios (LQ, capture)
 * are compared against exactly the statewide standard everyone else gets; the
 * one LEVEL among the inputs, field headroom, needs its cut scaled by the
 * group size or a 19-slug Salvador would clear a per-município median by an
 * order of magnitude and never read as "marginal".
 *
 * E12's TI rollup inherits this helper rather than growing a second one.
 */
export const computeAggregateTerritorialClass = (
  slugs: ReadonlyArray<string>,
): MunicipalityTerritorialClassification => {
  if (slugs.length === 1) return computeMunicipalityTerritorialClass(slugs[0])
  if (slugs.length === 0) return UNCLASSIFIED

  const totals = getStatewideFederalTotals(TERRITORIAL_CLASS_YEAR)
  const { medianFieldHeadroom, coreBlockSlugs } = getCatalogContext()

  let ownVotes = 0
  let validVotes = 0
  let fieldHeadroom = 0
  let fieldCeiling2022 = 0
  let inCoreBlock = false

  for (const slug of slugs) {
    const baseline = getMunicipalityFederalBaseline(slug)
    ownVotes += ownVotes2022(baseline)
    validVotes += baseline.validVotesByYear[String(TERRITORIAL_CLASS_YEAR)] ?? 0
    fieldHeadroom += fieldHeadroomOf(baseline)
    fieldCeiling2022 += fieldCeiling(baseline)
    inCoreBlock ||= coreBlockSlugs.has(slug)
  }

  return classifyMunicipalityTerritory({
    ownVotes,
    validVotes,
    stateOwnVotes: totals.ownVotes,
    stateValidVotes: totals.validVotes,
    fieldHeadroom,
    fieldHeadroomCut: medianFieldHeadroom * slugs.length,
    captureRate: fieldCeiling2022 > 0 ? ownVotes / fieldCeiling2022 : null,
    inCoreBlock,
  })
}

export { territorialClassSortWeight }
