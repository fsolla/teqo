const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export const formatRelativeAge = (timestampMs: number, nowMs: number): string => {
  const diffMs = timestampMs - nowMs
  const minutes = Math.round(diffMs / (60 * 1000))
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute')
  const hours = Math.round(diffMs / (60 * 60 * 1000))
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour')
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
  return relativeFormatter.format(days, 'day')
}
