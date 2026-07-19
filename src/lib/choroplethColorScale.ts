/** Sequential fill for campaign choropleth maps (primary red scale). */
export const choroplethFillColor = (value: number, max: number): string => {
  if (value <= 0 || max <= 0) return '#f4f4f5'

  const ratio = Math.min(1, value / max)
  // Light muted rose → campaign primary #c51414
  const start = { r: 254, g: 226, b: 226 }
  const end = { r: 197, g: 20, b: 20 }
  const r = Math.round(start.r + (end.r - start.r) * ratio)
  const g = Math.round(start.g + (end.g - start.g) * ratio)
  const b = Math.round(start.b + (end.b - start.b) * ratio)
  return `rgb(${r}, ${g}, ${b})`
}

export const choroplethMaxValue = (values: Record<string, number>): number => {
  const entries = Object.values(values).filter((value) => value > 0)
  return entries.length > 0 ? Math.max(...entries) : 0
}
