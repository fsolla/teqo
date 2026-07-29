/**
 * The cut points behind E10's territorial class, in one client-safe module.
 *
 * They live in `lib/` rather than next to the classifier because the map
 * (B13) paints an LQ scale on the SAME cuts the list's "Classe" column uses,
 * and the map panel is a client component: importing the classifier there
 * would drag the committed TSE artifact (~600 KB of JSON) into the browser
 * bundle. Numbers only, no data, no logic — the classifier
 * (`municipalityTerritorialClass.ts`) and the copy
 * (`municipalityLabels.ts`) both read from here, so a recalibration is still
 * a one-line diff in one file.
 *
 * Cuts are ILLUSTRATIVE, not calibrated: the research report gives the shape
 * (LQ > 2–3 = reduto, ~1 = padrão, < 0,5 = fraqueza) and says the exact
 * numbers can only come from a backtest against 2014–2022 — that is **E15**.
 */
export const TERRITORIAL_CLASS_ANCHORS = {
  /** LQ at or above this = performing at least 2× his own statewide standard. */
  strongLq: 2,
  /** LQ below this = performing at less than half his own standard. */
  weakLq: 0.5,
  /** Municípios that together hold this share of his statewide vote are the "core block". */
  coreCumulativeShare: 0.5,
} as const

/** Band where the LQ multiple rounds to "1×", which says nothing — name it instead. */
export const AT_STANDARD_LQ = { min: 0.95, max: 1.15 } as const

/**
 * The class vocabulary itself, single-sourced HERE (P3-K): the classifier,
 * the labels, the URL filter and the map legend all derive from this tuple,
 * so adding a class is a type error everywhere it must be handled — before
 * the fold it compiled green and silently mis-sorted.
 */
export const TERRITORIAL_CLASSES = [
  'reduto',
  'expansao',
  'manutencao',
  'marginal',
  'sem_base',
] as const

export type MunicipalityTerritorialClass = (typeof TERRITORIAL_CLASSES)[number]
