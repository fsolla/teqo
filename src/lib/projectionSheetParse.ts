/**
 * Pure parsers for the campaign projection spreadsheet (E4R).
 * Sheet cells → municipality expectedVotes / priority — no Payload, no I/O.
 *
 * Sheet vocabulary maps onto the estimate scenarios:
 * Bom → optimistic, Regular → central (média), Mínimo → pessimistic.
 */

import type { VoteEstimateScenarioFields } from '@/utilities/voteEstimate'

/** Parsed sheet triple — all three scenarios present (same keys as expectedVotes). */
export type ProjectionVoteEstimates = Required<
  Pick<VoteEstimateScenarioFields, 'pessimistic' | 'central' | 'optimistic'>
>

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
): ProjectionVoteEstimates | null => {
  if (raw == null) return null

  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  const match = trimmed.match(LABELED_EXPECTATION) ?? trimmed.match(SLASH_EXPECTATION)
  if (!match) return null

  const optimistic = parseSheetNumber(match[1])
  const central = parseSheetNumber(match[2])
  const pessimistic = parseSheetNumber(match[3])
  if (optimistic == null || central == null || pessimistic == null) return null
  return { optimistic, central, pessimistic }
}

/** `alta` → alta; anything else (incl. Baixa / empty) → normal. */
export const mapSheetPriority = (raw: string | null | undefined): ProjectionPriority => {
  if (raw == null) return 'normal'
  return raw.trim().toLowerCase() === 'alta' ? 'alta' : 'normal'
}
