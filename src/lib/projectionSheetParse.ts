/**
 * Pure parsers for the campaign projection spreadsheet (E4R).
 * Sheet cells → voteGoals / priority — no Payload, no I/O.
 */

export type ProjectionVoteGoals = {
  good: number
  regular: number
  minimum: number
}

export type ProjectionPriority = 'alta' | 'normal'

/** Strip Brazilian thousand separators (`10.000` → 10000) and parse an integer. */
export const parseSheetNumber = (raw: string | number | null | undefined): number | null => {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    return Math.round(raw)
  }

  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/\./g, '').replace(/,/g, '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value)
}

// Accepts `|` or `\` between Bom/Regular/Mínimo (some sheet exports use backslash).
const LABELED_EXPECTATION =
  /^Bom\s*:\s*([\d.]+)\s*[|\\]\s*Regular\s*:\s*([\d.]+)\s*[|\\]\s*M[ií]nimo\s*:\s*([\d.]+)\s*$/i

const SLASH_EXPECTATION = /^([\d.]+)\s*\/\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/

export const parseExpectationCell = (
  raw: string | null | undefined,
): ProjectionVoteGoals | null => {
  if (raw == null) return null

  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  const labeled = trimmed.match(LABELED_EXPECTATION)
  if (labeled) {
    const good = parseSheetNumber(labeled[1])
    const regular = parseSheetNumber(labeled[2])
    const minimum = parseSheetNumber(labeled[3])
    if (good == null || regular == null || minimum == null) return null
    return { good, regular, minimum }
  }

  const slash = trimmed.match(SLASH_EXPECTATION)
  if (slash) {
    const good = parseSheetNumber(slash[1])
    const regular = parseSheetNumber(slash[2])
    const minimum = parseSheetNumber(slash[3])
    if (good == null || regular == null || minimum == null) return null
    return { good, regular, minimum }
  }

  return null
}

/** `alta` → alta; anything else (incl. Baixa / empty) → normal. */
export const mapSheetPriority = (raw: string | null | undefined): ProjectionPriority => {
  if (raw == null) return 'normal'
  return raw.trim().toLowerCase() === 'alta' ? 'alta' : 'normal'
}
