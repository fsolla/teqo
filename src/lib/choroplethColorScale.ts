/** Light muted rose → campaign primary #c51414 */
const choroplethGradientStart = { r: 254, g: 226, b: 226 } as const
const choroplethGradientEnd = { r: 197, g: 20, b: 20 } as const

export const choroplethGradientCss = `linear-gradient(to right, rgb(${choroplethGradientStart.r} ${choroplethGradientStart.g} ${choroplethGradientStart.b}), rgb(${choroplethGradientEnd.r} ${choroplethGradientEnd.g} ${choroplethGradientEnd.b}))`

/** Sequential fill for campaign choropleth maps (primary red scale). */
export const choroplethFillColor = (value: number, max: number): string => {
  if (value <= 0 || max <= 0) return '#f4f4f5'

  const ratio = Math.min(1, value / max)
  const start = choroplethGradientStart
  const end = choroplethGradientEnd
  const r = Math.round(start.r + (end.r - start.r) * ratio)
  const g = Math.round(start.g + (end.g - start.g) * ratio)
  const b = Math.round(start.b + (end.b - start.b) * ratio)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * The same sequential ramp sampled at `total` evenly spaced steps — the fill
 * for class `index` (0 = weakest). Discrete classes are what make a relative
 * scale readable at a glance: a continuous ramp over a federal-deputy race
 * paints almost the whole state the same shade (B11's lesson).
 *
 * The floor keeps the lightest class distinguishable from "no data" (#f4f4f5).
 */
const DISCRETE_CLASS_FLOOR = 0.18

export const discreteChoroplethFill = (index: number, total: number): string => {
  if (total <= 0) return '#f4f4f5'
  if (total === 1) return choroplethFillColor(1, 1)

  const step = index / (total - 1)
  return choroplethFillColor(DISCRETE_CLASS_FLOOR + (1 - DISCRETE_CLASS_FLOOR) * step, 1)
}

export const choroplethMaxValue = (values: Record<string, number>): number => {
  const entries = Object.values(values).filter((value) => value > 0)
  return entries.length > 0 ? Math.max(...entries) : 0
}

/**
 * Diverging comparison scale (product decision 2026-07-20): campaign red where
 * Solla leads, white at the tie, blue where the compared candidate leads.
 */
const divergingBlueEnd = { r: 30, g: 64, b: 175 } as const

const white = { r: 255, g: 255, b: 255 } as const

export const divergingFillColor = (diff: number, maxAbs: number): string => {
  if (maxAbs <= 0 || diff === 0) return `rgb(${white.r}, ${white.g}, ${white.b})`

  const ratio = Math.min(1, Math.abs(diff) / maxAbs)
  const end = diff > 0 ? choroplethGradientEnd : divergingBlueEnd
  const r = Math.round(white.r + (end.r - white.r) * ratio)
  const g = Math.round(white.g + (end.g - white.g) * ratio)
  const b = Math.round(white.b + (end.b - white.b) * ratio)
  return `rgb(${r}, ${g}, ${b})`
}

export const divergingGradientCss = `linear-gradient(to right, rgb(${divergingBlueEnd.r} ${divergingBlueEnd.g} ${divergingBlueEnd.b}), rgb(255 255 255), rgb(${choroplethGradientEnd.r} ${choroplethGradientEnd.g} ${choroplethGradientEnd.b}))`

export const choroplethMaxAbsValue = (values: Record<string, number>): number => {
  const entries = Object.values(values).map((value) => Math.abs(value))
  return entries.length > 0 ? Math.max(...entries) : 0
}

/** Share of valid votes per geography (0–1). Omits entries with no valid denominator or zero votes. */
export const computeValidVoteShares = (
  votes: Record<string, number>,
  validVotes: Record<string, number>,
): Record<string, number> => {
  const shares: Record<string, number> = {}
  for (const [code, voteCount] of Object.entries(votes)) {
    const valid = validVotes[code]
    if (valid > 0 && voteCount > 0) {
      shares[code] = voteCount / valid
    }
  }
  return shares
}
