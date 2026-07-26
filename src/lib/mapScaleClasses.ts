import { discreteChoroplethFill } from '@/lib/choroplethColorScale'
import { formatElectionNumber, formatPlacementOrdinal } from '@/lib/electionFormat'
import { AT_STANDARD_LQ, TERRITORIAL_CLASS_ANCHORS } from '@/lib/territorialClassAnchors'

/**
 * B13 — relative map scales: the pure statistics behind the choropleth's
 * discrete classes, with no Leaflet and no data access, so the map and its
 * legend read the same source and a unit test can pin every cut.
 *
 * Why relative at all: "% dos válidos" (B11) is honest and useless here — a
 * federal-deputy candidate tops out around 5% of a município's valid votes,
 * so a 0–100% ramp paints Bahia one colour. Every scale below is measured
 * against the candidate himself (his own distribution, his own statewide
 * standard, his own placement), which is what discriminates.
 */

type MapScaleClass = {
  /** Fill painted on the polygon and swatched in the legend. */
  fill: string
  /** pt-BR range label — "13–48", "2× ou mais", "2º–3º". */
  label: string
}

export type MapScaleClassing = {
  /** Weakest first, so every legend reads left-to-right the same way. */
  classes: MapScaleClass[]
  /** Feature key → class index. Keys without a class are absent, never 0. */
  classIndexByKey: Record<string, number>
}

const EMPTY_CLASSING: MapScaleClassing = { classes: [], classIndexByKey: {} }

const buildClassing = (
  ranges: ReadonlyArray<{ label: string }>,
  classIndexByKey: Record<string, number>,
): MapScaleClassing => ({
  classes: ranges.map((range, index) => ({
    label: range.label,
    fill: discreteChoroplethFill(index, ranges.length),
  })),
  classIndexByKey,
})

/** Full quantile split; below this many features the split degrades. */
export const QUANTILE_CLASSES = 5

/**
 * An advisor's portfolio can be a handful of municípios. Cutting eight values
 * into five "quantiles" invents precision, so the split drops to three.
 */
export const QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT = 10
const QUANTILE_REDUCED_CLASSES = 3

/**
 * Quantile classes over the positive values of the rendered set (Brewer &
 * Pickle: quantiles discriminate by construction and stay comparable across
 * years, unlike Jenks, whose breaks move with the data).
 *
 * Labels carry the real extremes of each class rather than the computed
 * break, so no gap is ever implied between "até 12" and "13–48".
 */
export const buildQuantileClassing = (values: Record<string, number>): MapScaleClassing => {
  const entries = Object.entries(values).filter(([, value]) => value > 0)
  if (entries.length === 0) return EMPTY_CLASSING

  const sorted = entries.map(([, value]) => value).sort((left, right) => left - right)
  const distinct = new Set(sorted).size
  const desired =
    sorted.length < QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT
      ? QUANTILE_REDUCED_CLASSES
      : QUANTILE_CLASSES
  const count = Math.min(desired, distinct)

  // Upper bound of each quantile, de-duplicated: heavy ties (many municípios
  // on the same vote count) can collapse two quantiles into one bound, and a
  // repeated bound would render as an empty class in the legend.
  const upperBounds: number[] = []
  for (let index = 1; index <= count; index += 1) {
    const position = Math.ceil((index * sorted.length) / count) - 1
    const bound = sorted[position]
    if (upperBounds.at(-1) !== bound) upperBounds.push(bound)
  }

  const extremes = upperBounds.map(() => ({ min: Number.POSITIVE_INFINITY, max: 0 }))
  const classIndexByKey: Record<string, number> = {}
  for (const [key, value] of entries) {
    // Always found: the last bound is the maximum of the same set.
    const index = upperBounds.findIndex((bound) => value <= bound)
    classIndexByKey[key] = index
    extremes[index].min = Math.min(extremes[index].min, value)
    extremes[index].max = Math.max(extremes[index].max, value)
  }

  const ranges = extremes.map(({ min, max }) => ({
    label:
      min === max
        ? formatElectionNumber(min)
        : `${formatElectionNumber(min)}–${formatElectionNumber(max)}`,
  }))

  return buildClassing(ranges, classIndexByKey)
}

/**
 * Two decimals, not one: the "no padrão" band starts at 0,95× and rounding
 * that to "1,0×" would print the same number on two adjacent legend swatches.
 */
const lqMultipleFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

const formatLqMultiple = (value: number): string => `${lqMultipleFormatter.format(value)}×`

/**
 * Location-quotient classes cut on the SAME anchors as E10's territorial
 * class, so the map and the list's "Classe" column can never disagree about
 * where "reduto" starts.
 *
 * Deliberately NOT the diverging red↔blue scale: in this product that palette
 * means "Solla × adversário" (the compare mode), and reusing it for "above ×
 * below his own standard" would make two different questions look identical.
 */
const LQ_CLASS_RANGES = [
  {
    upperBound: TERRITORIAL_CLASS_ANCHORS.weakLq,
    label: `menos de ${formatLqMultiple(TERRITORIAL_CLASS_ANCHORS.weakLq)}`,
  },
  {
    upperBound: AT_STANDARD_LQ.min,
    label: `${formatLqMultiple(TERRITORIAL_CLASS_ANCHORS.weakLq)}–${formatLqMultiple(AT_STANDARD_LQ.min)}`,
  },
  { upperBound: AT_STANDARD_LQ.max, label: 'no padrão (≈1×)' },
  {
    upperBound: TERRITORIAL_CLASS_ANCHORS.strongLq,
    label: `${formatLqMultiple(AT_STANDARD_LQ.max)}–${formatLqMultiple(TERRITORIAL_CLASS_ANCHORS.strongLq)}`,
  },
  {
    upperBound: Number.POSITIVE_INFINITY,
    label: `${formatLqMultiple(TERRITORIAL_CLASS_ANCHORS.strongLq)} ou mais`,
  },
] as const

export const buildLqClassing = (lqByKey: Record<string, number>): MapScaleClassing => {
  const classIndexByKey: Record<string, number> = {}
  for (const [key, lq] of Object.entries(lqByKey)) {
    if (!(lq > 0)) continue
    classIndexByKey[key] = LQ_CLASS_RANGES.findIndex((range) => lq < range.upperBound)
  }

  if (Object.keys(classIndexByKey).length === 0) return EMPTY_CLASSING
  return buildClassing(LQ_CLASS_RANGES, classIndexByKey)
}

/** Best placement that still counts as a contender rather than the field. */
const COMPETITIVE_RANK_CONTENDER = 3

/**
 * Competitive placement, ordered weakest first so the legend keeps the same
 * left-to-right reading as the other scales even though a LOWER placement
 * number is the better one. `bestRank` is the strongest placement each band
 * accepts, and the labels are derived from it — the same shape as the LQ
 * ranges above, so moving a cut can never leave the legend describing the old one.
 */
const COMPETITIVE_RANK_RANGES = [
  {
    bestRank: COMPETITIVE_RANK_CONTENDER + 1,
    label: `${formatPlacementOrdinal(COMPETITIVE_RANK_CONTENDER + 1)} ou pior`,
  },
  {
    bestRank: 2,
    label: `${formatPlacementOrdinal(2)}–${formatPlacementOrdinal(COMPETITIVE_RANK_CONTENDER)}`,
  },
  { bestRank: 1, label: formatPlacementOrdinal(1) },
] as const

export const buildCompetitiveRankClassing = (
  rankByKey: Record<string, number>,
): MapScaleClassing => {
  const classIndexByKey: Record<string, number> = {}
  for (const [key, rank] of Object.entries(rankByKey)) {
    if (!(rank >= 1)) continue
    classIndexByKey[key] = COMPETITIVE_RANK_RANGES.findIndex((range) => rank >= range.bestRank)
  }

  if (Object.keys(classIndexByKey).length === 0) return EMPTY_CLASSING
  return buildClassing(COMPETITIVE_RANK_RANGES, classIndexByKey)
}

/** Feature key → fill, ready for `BahiaMap`'s `fillByKey`. */
export const fillsForClassing = (classing: MapScaleClassing): Record<string, string> => {
  const fills: Record<string, string> = {}
  for (const [key, index] of Object.entries(classing.classIndexByKey)) {
    const fill = classing.classes[index]?.fill
    if (fill) fills[key] = fill
  }
  return fills
}
