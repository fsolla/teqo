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

/** Municipality politicalTrend.status values derivable from the sheet SITUAÇÃO column. */
export type ProjectionTrendStatus = 'favoravel' | 'neutra' | 'desfavoravel'

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * SITUAÇÃO cell → politicalTrend.status.
 * MAPA GERAL uses long emoji labels ("🔴  QUEDA DE VOTOS  —  Requer ação imediata");
 * PRIORITÁRIAS uses bare labels ("QUEDA" | "MANTÉM" | "AUMENTO").
 * "NÃO DEFINIDA", footers, and anything else → null (leave the municipality untouched).
 */
export const parseSituationCell = (
  raw: string | null | undefined,
): ProjectionTrendStatus | null => {
  if (raw == null) return null
  const normalized = stripDiacritics(raw).toUpperCase()
  if (/\bQUEDA\b/.test(normalized)) return 'desfavoravel'
  if (/\bMANTEM\b/.test(normalized)) return 'neutra'
  if (/\bAUMENTO\b/.test(normalized)) return 'favoravel'
  return null
}

export type NameCellSplit = {
  /** Segments that look like an individual's name (may carry a descriptor, e.g. "Amilton do PT"). */
  names: string[]
  /** Segments dropped as notes/collectives/uncertainty — surfaced in the dry-run report. */
  skipped: string[]
}

// Honorific abbreviations whose trailing period must not act as a sentence separator.
const HONORIFIC_ABBREVIATION = /\b(dr|dra|sr|sra|prof|profa|sec)\./gi
const HONORIFIC_PLACEHOLDER = '\u0000'

/**
 * Note/collective segment detectors, evaluated on the accent-stripped lowercase segment.
 * A match means "this is not an individual's name" — the segment goes to `skipped`.
 */
const NOTE_SEGMENT_PATTERNS: RegExp[] = [
  /^-+$/, // placeholder dash
  /\?/, // uncertainty markers ("Alex?", "vice?", "?")
  // Leading action verbs ("VER COM VILMA", "CONFIRMAR COM JÚLIO", "Construindo Julio", "com Goiano")
  /^(ver|falar|confirmar|aguardar|articulando|construindo|resgatar|tratar|definir|cobrar|com)\b/,
  /\b(ver|falar) com\b/, // embedded notes ("Amauri - VER COM VÉU")
  /-\s*(ver|cobrar|definir|confirmar|aguardar|tratar)\b/, // "Diego Pita - COBRAR IONÁ"
  /\bvai\b/, // "SOLLA VAI INFORMAR", "Solla vai ver"
  /^a definir\b/, // "A definir"
  /^candidato d/, // "candidato do Prefeito"
  // Collectives / relationships / roles without an individual's name
  /^(pessoal|pesoal|grupo|novo nucleo|associacao|sindicato|sindasesb|csol|presidente)\b/,
  /^(pessoa|irma|sogro|moca|assessora?|vereadora?) de\b/,
  /^estadual do\b/,
  /^gerente d/,
  /^indigenas?$/,
  /^ex[- ]?(vice|prefeit)/,
  /^([oa] )?(vereadora?|vereadores|prefeit[oa]|vice)$/,
  /^sec\.? saude$/,
]

const isNoteSegment = (segment: string): boolean => {
  const normalized = stripDiacritics(segment).toLowerCase()
  return NOTE_SEGMENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Splits a DOBRADINHAS / LIDERANÇAS / ASSESSOR RESPONSÁVEL cell into individual names.
 * Separators: comma, slash, semicolon, newline, " e ", and sentence periods (honorifics
 * like "Dr. Paulo" are protected). Parentheticals are extracted into `skipped` before
 * splitting; note-like segments (action phrases, collectives, "?"-marked) are skipped.
 */
export const splitNameCell = (raw: string | null | undefined): NameCellSplit => {
  const names: string[] = []
  const skipped: string[] = []
  const cell = raw?.trim()
  if (!cell) return { names, skipped }

  const withoutParentheticals = cell.replace(/\([^)]*\)/g, (match) => {
    skipped.push(match.trim())
    return ' '
  })

  const protectedCell = withoutParentheticals.replace(
    HONORIFIC_ABBREVIATION,
    `$1${HONORIFIC_PLACEHOLDER}`,
  )

  const segments = protectedCell.split(/(?:[,/;|\n\r]|\s+e\s+|\.\s+|\.$)+/i)

  for (const segment of segments) {
    const cleaned = segment.replaceAll(HONORIFIC_PLACEHOLDER, '.').replace(/\s+/g, ' ').trim()
    if (!cleaned) continue
    if (isNoteSegment(cleaned)) {
      skipped.push(cleaned)
      continue
    }
    // Stray edge punctuation from sheet typos ("Júlio-"); internal descriptors survive.
    const name = cleaned.replace(/^[-–—\s]+/, '').replace(/[-–—\s]+$/, '')
    if (!name) {
      skipped.push(cleaned)
      continue
    }
    names.push(name)
  }

  return { names, skipped }
}
