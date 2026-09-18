/**
 * Chart data core (C191): parse the numbers the communication team pasted or
 * dropped (xlsx/csv/md/txt/free text), pick the chart relation and enforce the
 * correctness guardrails — all pure, no Chromium and no DOM, so the unit suite
 * covers it without a database or a browser.
 *
 * The renderer (`graficosInstagramRender.mjs`) owns the look; this module never
 * invents a value: anything missing or ambiguous becomes an explicit question.
 */

import { parse as parseCsv } from 'csv-parse/sync'
import XLSX from 'xlsx'

export const CHART_TYPES = ['bar', 'column', 'line', 'anchor']

/** Max data points per chart (honest density; above this the person must summarize). */
export const MAX_POINTS = 7

/**
 * Stories recompose the vertical rhythm with one fewer ranking point (approved
 * design: "reduz um ponto do ranking"), so a six/seven-point ranking is refused
 * instead of crowded.
 */
export const MAX_POINTS_STORY = 5

/** Output canvases: feed 4:5 (default), square, stories/reels 9:16 with safe bands. */
export const SIZES = {
  feed: { width: 1080, height: 1350, label: '1080×1350', safeTop: 0, safeBottom: 0 },
  square: { width: 1080, height: 1080, label: '1080×1080', safeTop: 0, safeBottom: 0 },
  story: { width: 1080, height: 1920, label: '1080×1920', safeTop: 250, safeBottom: 250 },
}

/** Kicker of each relation, matching the approved hi-fi template. */
export const RELATION_LABEL = {
  bar: 'Comparação',
  column: 'Poucos períodos',
  line: 'Série de tempo',
  anchor: 'Número-âncora',
}

const TEMPORAL_RE =
  /^(\d{4}|\d{2}|[A-Za-zÀ-ÿ]{3,9}[./-]?\d{2,4}|\d{1,2}[./-]\d{2,4}|[TQ]\d|P\d+|\d{4}[./-]\d{1,2})$/u

/** True when the label reads as a period (year, month, quarter, P1…), not a category. */
export const isTemporalLabel = (label) => TEMPORAL_RE.test(String(label).trim())

/**
 * pt-BR/en number: strips currency/spaces/percent, treats the last separator as
 * the decimal when both `.` and `,` appear, and comma-as-decimal otherwise.
 * Returns null (never 0) for anything non-numeric, so "missing" stays honest.
 */
export const parseNumber = (raw) => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let value = String(raw ?? '')
    .replace(/[R$\s%]/gi, '')
    .trim()
  if (value === '') return null
  const hasDot = value.includes('.')
  const hasComma = value.includes(',')
  if (hasDot && hasComma) {
    value =
      value.lastIndexOf(',') > value.lastIndexOf('.')
        ? value.replaceAll('.', '').replace(',', '.')
        : value.replaceAll(',', '')
  } else if (hasComma) {
    value = value.replace(',', '.')
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const lastCell = (row) => row[row.length - 1]

const normalizeWord = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * A header row is only recognized by an explicit header word in some cell —
 * never by "the first value is not numeric", which would drop a real data row
 * with a missing value ("Ilhéus n/d") in silence. Unknown headers survive as a
 * data row and become an explicit question instead.
 */
const HEADER_HINTS = new Set([
  'valor',
  'value',
  'total',
  'quantidade',
  'qtd',
  'numero',
  'montante',
  'percentual',
  'percent',
  '%',
  'taxa',
  'media',
  'indice',
  'votos',
  'count',
  'amount',
  'resultado',
  'unidade',
  'ano',
  'mes',
  'periodo',
  'data',
  'indicador',
  'metrica',
  'r$',
  'populacao',
  'eleitores',
  'eleitorado',
  'cidade',
  'municipio',
  'categoria',
  'grupo',
  'regiao',
  'estado',
  'partido',
  'candidato',
])

const looksLikeHeaderRow = (row) =>
  row.some((cell) =>
    normalizeWord(cell)
      .split(/[^a-z0-9%$]+/)
      .some((word) => HEADER_HINTS.has(word)),
  )

const cleanMatrix = (matrix) =>
  matrix
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean))

const matrixToDataset = (matrix, format) => {
  const cleaned = cleanMatrix(matrix)
  const issues = []
  if (cleaned.length === 0) return { rows: [], format, issues: ['nenhum dado encontrado'] }

  let start = 0
  if (
    cleaned.length > 1 &&
    parseNumber(lastCell(cleaned[0])) === null &&
    looksLikeHeaderRow(cleaned[0])
  ) {
    start = 1
  }

  const rows = []
  for (const row of cleaned.slice(start)) {
    const label = row[0]
    const rawValue = lastCell(row)
    const value = parseNumber(rawValue)
    if (!label && value === null) {
      issues.push(`linha sem rótulo: ${JSON.stringify(row.join(' | '))}`)
      continue
    }
    if (value === null) {
      issues.push(`valor não numérico em "${label}": ${JSON.stringify(rawValue)}`)
      continue
    }
    rows.push({ label, value })
  }

  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.label)) issues.push(`rótulo repetido: "${row.label}"`)
    seen.add(row.label)
  }
  return { rows, format, issues }
}

const sniffDelimiter = (line) => {
  let best = null
  let bestCount = 0
  for (const delimiter of ['\t', ';', ',']) {
    const count = line.split(delimiter).length - 1
    if (count > bestCount) {
      bestCount = count
      best = delimiter
    }
  }
  return bestCount > 0 ? best : null
}

const isMarkdownTable = (lines) =>
  lines.length > 1 && lines[0].includes('|') && /^\s*\|?[\s:-]*-{3,}[\s:|-]*\|?\s*$/.test(lines[1])

const parseMarkdownTable = (lines) =>
  lines
    .filter((line) => line.includes('|'))
    .filter((_line, index) => index !== 1)
    .map((line) =>
      line
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )

/** Last separator wins, so labels may contain spaces: "Votos em Ilhéus: 84". */
const splitPair = (line) => {
  const separators = [':', '=', '\t']
  for (const separator of separators) {
    const at = line.lastIndexOf(separator)
    if (at > 0) return [line.slice(0, at), line.slice(at + 1)]
  }
  const match = line.match(/^(.*\S)\s+([^\s]+)$/s)
  if (match) return [match[1], match[2]]
  // A bare number is an unlabeled single measure (the anchor relation).
  if (parseNumber(line) !== null) return ['', line]
  return [line, '']
}

const parseFreeText = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], format: 'txt', issues: ['nenhum dado encontrado'] }
  if (isMarkdownTable(lines)) return matrixToDataset(parseMarkdownTable(lines), 'md')
  const delimiter = sniffDelimiter(lines[0])
  if (delimiter) {
    const matrix = lines.map((line) => line.split(delimiter))
    return matrixToDataset(matrix, delimiter === '\t' ? 'tsv' : 'csv')
  }
  const matrix = lines.map(splitPair)
  return matrixToDataset(matrix, 'txt')
}

/**
 * Parse the raw input into `{ rows, format, issues }`. `buffer` is required for
 * xlsx/xls; `text` for csv/md/txt. `format` overrides the extension inference.
 *
 * @param {{ text?: string | null, buffer?: Buffer | null, format?: string | null }} [options]
 */
export const parseInput = ({ text = null, buffer = null, format = null } = {}) => {
  if (format === 'xlsx' || format === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
    return matrixToDataset(matrix, 'xlsx')
  }
  const body = String(text ?? '')
  if (format === 'csv' || format === 'tsv') {
    const delimiter =
      format === 'tsv' ? '\t' : (sniffDelimiter(body.split(/\r?\n/)[0] ?? '') ?? ',')
    const matrix = parseCsv(body, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
    })
    return matrixToDataset(matrix, format)
  }
  return parseFreeText(body)
}

/**
 * Relation of the data → chart type. One measure is an anchor; every-temporal
 * labels are a series (few periods as columns, many as a line); anything else
 * is a ranking/comparison in horizontal bars.
 *
 * @param {{ label: string, value: number }[]} rows
 * @param {string | null} [forcedType]
 */
export const classifyRelation = (rows, forcedType = null) => {
  if (forcedType) {
    // `pie` passes through so `validateSpec` answers with the actionable
    // "use barras horizontais" message instead of a generic unknown type.
    if (forcedType !== 'pie' && !CHART_TYPES.includes(forcedType)) {
      throw new Error(
        `tipo de gráfico desconhecido: ${JSON.stringify(forcedType)} (use ${CHART_TYPES.join(', ')})`,
      )
    }
    return forcedType
  }
  if (rows.length === 1) return 'anchor'
  if (rows.length > 1 && rows.every((row) => isTemporalLabel(row.label))) {
    return rows.length <= 4 ? 'column' : 'line'
  }
  return 'bar'
}

/**
 * Fail-closed guardrails of the approved template. Throws with the actionable
 * reason instead of drawing a misleading chart.
 */
export const validateSpec = (spec) => {
  const { chartType, rows, headline } = spec
  if (spec.size && !SIZES[spec.size]) {
    throw new Error(
      `tamanho inválido: ${JSON.stringify(spec.size)} (use ${Object.keys(SIZES).join(', ')})`,
    )
  }
  if (!CHART_TYPES.includes(chartType)) {
    if (chartType === 'pie') {
      throw new Error(
        'pizza não é gerada no v1 (a comparação fica escondida); use barras horizontais.',
      )
    }
    throw new Error(`tipo de gráfico inválido: ${JSON.stringify(chartType)}`)
  }
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error('sem pontos de dado para desenhar.')
  if (rows.length > MAX_POINTS) {
    throw new Error(
      `${rows.length} pontos (> ${MAX_POINTS}): resuma as categorias antes de gerar o gráfico.`,
    )
  }
  if (
    spec.size === 'story' &&
    (chartType === 'bar' || chartType === 'column') &&
    rows.length > MAX_POINTS_STORY
  ) {
    throw new Error(
      `stories comporta até ${MAX_POINTS_STORY} pontos no ranking (${rows.length} recebidos): resuma para gerar a versão vertical.`,
    )
  }
  if (chartType === 'anchor' && rows.length !== 1) {
    throw new Error('número-âncora exige exatamente um valor.')
  }
  for (const row of rows) {
    if (!row.label && chartType !== 'anchor') throw new Error('ponto de dado sem rótulo.')
    if (!Number.isFinite(row.value)) throw new Error(`valor ausente/inválido em "${row.label}".`)
    if (row.value < 0) throw new Error(`valor negativo em "${row.label}" — barras partem do zero.`)
  }
  if (spec.highlight && !rows.some((row) => row.label === spec.highlight)) {
    throw new Error(`destaque "${spec.highlight}" não existe nos dados — confira o rótulo.`)
  }
  if (typeof headline !== 'string' || headline.trim() === '') {
    throw new Error('título-manchete ausente — a manchete é obrigatória.')
  }
  return spec
}
