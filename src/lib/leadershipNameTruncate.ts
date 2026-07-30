/** Word-boundary ellipsis for leadership tile titles (B70). */
export const truncateNameAtWordBoundary = (name: string, maxChars: number): string => {
  const trimmed = name.trim()
  if (trimmed.length <= maxChars) return trimmed

  const words = trimmed.split(/\s+/)
  let result = ''
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word
    if (candidate.length > maxChars) break
    result = candidate
  }

  if (!result) {
    return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`
  }

  return `${result}…`
}
