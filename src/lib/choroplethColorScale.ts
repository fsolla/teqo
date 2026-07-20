/** Light muted rose → campaign primary #c51414 */
export const choroplethGradientStart = { r: 254, g: 226, b: 226 } as const
export const choroplethGradientEnd = { r: 197, g: 20, b: 20 } as const

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

export const choroplethMaxValue = (values: Record<string, number>): number => {
  const entries = Object.values(values).filter((value) => value > 0)
  return entries.length > 0 ? Math.max(...entries) : 0
}
