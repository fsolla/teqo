/**
 * C166 — the one owner of the acervo clock label ("01:12" / "1:02:03").
 * Lives in `lib/` because the pure share/selection modules build messages with
 * it and `lib/` never imports `utilities/`.
 */

const pad = (value: number): string => String(value).padStart(2, '0')

/** Transcript timestamp ("01:12" / "1:02:03"). */
export const formatSpeechClock = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`
}

/** Compact duration label ("45s" / "1min27s" / "1h02min") for speech surfaces. */
export const formatSpeechSpan = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}h${pad(minutes)}min`
  if (minutes > 0) return `${minutes}min${pad(secs)}s`
  return `${secs}s`
}
