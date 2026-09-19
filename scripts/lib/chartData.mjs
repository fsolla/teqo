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

export const CHART_TYPES = ['bar', 'column', 'line', 'anchor', 'delta']

/** Max data points per chart (honest density; above this the person must summarize). */
export const MAX_POINTS = 7

/**
 * Stories recompose the vertical rhythm with one fewer ranking point (approved
 * design: "reduz um ponto do ranking"), so a six/seven-point ranking is refused
 * instead of crowded.
 */
export const MAX_POINTS_STORY = 5

/**
 * Two-series and three-series time comparison (approved variants): an annual
 * series carries more points than a ranking, per series. One tone per series
 * encodes the valence — the pair of C191 (good/bad) or the triad of the C205
 * extension (good/neutral/neutral-dark, feed only, no projection and no
 * crossing).
 */
export const MIN_SERIES = 2
export const MAX_SERIES = 3
export const MAX_POINTS_LINE = 12
const PAIR_TONES = ['good', 'bad']
const TRIAD_TONES = ['good', 'neutral', 'neutral-dark']

/** Allowed tone vocabulary of the informed series count (never a cross-vocabulary). */
const tonesFor = (count) => (count === MAX_SERIES ? TRIAD_TONES : PAIR_TONES)

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
  delta: 'Variação no período',
}

/** Kicker of the two-series time line (approved C191 variant). */
export const SERIES_RELATION_LABEL = 'Comparação no tempo'

const TEMPORAL_RE =
  /^(\d{4}|\d{2}|[A-Za-zÀ-ÿ]{3,9}[./-]?\d{2,4}|\d{1,2}[./-]\d{2,4}|[TQ]\d|P\d+|\d{4}[./-]\d{1,2})$/u

/** True when the label reads as a period (year, month, quarter, P1…), not a category. */
export const isTemporalLabel = (label) => TEMPORAL_RE.test(String(label).trim())

/**
 * pt-BR/en number: strips currency/spaces/percent. A single separator is
 * always the decimal (`1.234` and `1,234` both read 1.234; `1.500` reads 1.5) —
 * for thousands write both separators (`1.234,56`) or none (`1234`). With both
 * present the last one is the decimal; a repeated separator (`1.234.567`,
 * `1,234,567`) is refused instead of guessed. Returns null (never 0) for
 * anything non-numeric, so "missing" stays honest.
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

/**
 * A table whose header names two measures over a shared first column is a time
 * comparison: `series` instead of a single ranking. Only the header (words,
 * never numbers) may open that door — a data row with a missing value never
 * turns into a series in silence.
 */
const looksLikeSeriesHeader = (header) =>
  header.length >= MIN_SERIES + 1 &&
  header.every((cell) => cell !== '' && parseNumber(cell) === null)

const detectSeries = (cleaned) => {
  const header = cleaned[0]
  if (cleaned.length < 2 || !looksLikeSeriesHeader(header)) return null
  const issues = []
  const series = header.slice(1).map((name) => ({ name, rows: [] }))
  const seen = new Set()
  for (const row of cleaned.slice(1)) {
    const label = row[0]
    if (!label) {
      issues.push(`linha sem rótulo: ${JSON.stringify(row.join(' | '))}`)
      continue
    }
    if (seen.has(label)) issues.push(`rótulo repetido: "${label}"`)
    seen.add(label)
    series.forEach((serie, index) => {
      const raw = row[index + 1]
      const value = parseNumber(raw)
      if (value === null) {
        issues.push(`valor não numérico em "${serie.name} · ${label}": ${JSON.stringify(raw)}`)
        return
      }
      serie.rows.push({ label, value })
    })
  }
  return { series, issues }
}

const matrixToDataset = (matrix, format) => {
  const cleaned = cleanMatrix(matrix)
  const issues = []
  if (cleaned.length === 0) return { rows: [], format, issues: ['nenhum dado encontrado'] }

  const detected = detectSeries(cleaned)
  if (detected) return { rows: [], series: detected.series, format, issues: detected.issues }

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

/**
 * Delta table (approved C191 variant): the first row is the header naming the
 * two observed periods; every body row carries the label and the two measures
 * (initial and final) of one category. A missing/invalid measure is an explicit
 * issue — never a completed value.
 */
const matrixToDelta = (matrix, format) => {
  const cleaned = cleanMatrix(matrix)
  const empty = { rows: [], startLabel: '', endLabel: '', format }
  if (cleaned.length < 2) {
    return {
      ...empty,
      issues: ['a barra de variação exige o cabeçalho com os dois períodos e ao menos uma linha.'],
    }
  }
  const [header, ...body] = cleaned
  if (header.length < 3) {
    return {
      ...empty,
      issues: ['a barra de variação exige três colunas: rótulo, valor inicial e valor final.'],
    }
  }
  const issues = []
  const rows = []
  const seen = new Set()
  for (const row of body) {
    const label = row[0]
    if (!label) {
      issues.push(`linha sem rótulo: ${JSON.stringify(row.join(' | '))}`)
      continue
    }
    if (seen.has(label)) issues.push(`rótulo repetido: "${label}"`)
    seen.add(label)
    const initial = parseNumber(row[1] ?? '')
    const final = parseNumber(row[2] ?? '')
    if (initial === null) {
      issues.push(`valor inicial não numérico em "${label}": ${JSON.stringify(row[1] ?? '')}`)
      continue
    }
    if (final === null) {
      issues.push(`valor final não numérico em "${label}": ${JSON.stringify(row[2] ?? '')}`)
      continue
    }
    rows.push({ label, initial, final })
  }
  return { rows, startLabel: header[1] ?? '', endLabel: header[2] ?? '', format, issues }
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

const parseFreeText = (text, { delta = false } = {}) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], format: 'txt', issues: ['nenhum dado encontrado'] }
  if (isMarkdownTable(lines)) {
    const matrix = parseMarkdownTable(lines)
    return delta ? matrixToDelta(matrix, 'md') : matrixToDataset(matrix, 'md')
  }
  const delimiter = sniffDelimiter(lines[0])
  if (delimiter) {
    const matrix = lines.map((line) => line.split(delimiter))
    const format = delimiter === '\t' ? 'tsv' : 'csv'
    return delta ? matrixToDelta(matrix, format) : matrixToDataset(matrix, format)
  }
  if (delta) {
    return {
      rows: [],
      startLabel: '',
      endLabel: '',
      format: 'txt',
      issues: ['a barra de variação exige uma tabela (rótulo + valor inicial + valor final).'],
    }
  }
  const matrix = lines.map(splitPair)
  return matrixToDataset(matrix, 'txt')
}

/**
 * @typedef {{ label: string, value?: number, initial?: number, final?: number }} DatasetRow
 * @typedef {{ name: string, rows: { label: string, value: number }[] }} DatasetSeries
 */

/**
 * Parse the raw input into `{ rows, format, issues }`. `buffer` is required for
 * xlsx/xls; `text` for csv/md/txt. `format` overrides the extension inference.
 * `delta` reads the table through the variation-bar contract (label + initial +
 * final, header naming the two periods) instead of the single-measure path.
 *
 * @param {{ text?: string | null, buffer?: Buffer | null, format?: string | null, delta?: boolean }} [options]
 * @returns {{ rows: DatasetRow[], series?: DatasetSeries[], startLabel?: string, endLabel?: string, format: string, issues: string[] }}
 */
export const parseInput = ({ text = null, buffer = null, format = null, delta = false } = {}) => {
  if (format === 'xlsx' || format === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
    return delta ? matrixToDelta(matrix, 'xlsx') : matrixToDataset(matrix, 'xlsx')
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
    return delta ? matrixToDelta(matrix, format) : matrixToDataset(matrix, format)
  }
  return parseFreeText(body, { delta })
}

/**
 * Relation of the data → chart type. One measure is an anchor; two measures per
 * category (initial/final) are the variation bar; every-temporal labels are a
 * series (few periods as columns, many as a line); anything else is a
 * ranking/comparison in horizontal bars.
 *
 * @param {DatasetRow[]} rows
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
  if (
    rows.length > 0 &&
    rows.every((row) => Number.isFinite(row.initial) && Number.isFinite(row.final))
  ) {
    return 'delta'
  }
  if (rows.length === 1) return 'anchor'
  if (rows.length > 1 && rows.every((row) => isTemporalLabel(row.label))) {
    return rows.length <= 4 ? 'column' : 'line'
  }
  return 'bar'
}

/**
 * Guardrails of the multi-series time line (approved variants): aligned
 * periods, at most `MAX_POINTS_LINE` per series, honest zero base, the tone
 * pair (2 series) or triad (3 series, C204 — feed only, no projection, no
 * crossing) informed together and the projection only on the last period.
 */
const validateSeries = (spec) => {
  const { series } = spec
  if (spec.chartType !== 'line') {
    throw new Error('a comparação de séries exige o tipo linha (série de tempo).')
  }
  if (spec.highlight) {
    throw new Error('a linha multi-série marca a valência pelos tons — não use --highlight.')
  }
  if (series.length < MIN_SERIES || series.length > MAX_SERIES) {
    throw new Error(
      `a linha multi-série desenha ${MIN_SERIES} ou ${MAX_SERIES} séries (${series.length} recebidas).`,
    )
  }
  if (series.length === MAX_SERIES) {
    if (spec.projectedLabel) {
      throw new Error('a linha de três séries não certifica projeção — remova --projected.')
    }
    if (spec.crossingLabel) {
      throw new Error('a linha de três séries não certifica cruzamento — remova --crossing.')
    }
    if (spec.size && spec.size !== 'feed') {
      throw new Error('a linha de três séries só está certificada no feed (1080×1350).')
    }
  }
  const names = new Set()
  for (const serie of series) {
    if (typeof serie.name !== 'string' || serie.name.trim() === '')
      throw new Error('série sem nome.')
    if (names.has(serie.name)) throw new Error(`série repetida: "${serie.name}".`)
    names.add(serie.name)
    if (!Array.isArray(serie.rows) || serie.rows.length < 2) {
      throw new Error(`série "${serie.name}" precisa de pelo menos 2 pontos.`)
    }
    if (serie.rows.length > MAX_POINTS_LINE) {
      throw new Error(
        `${serie.rows.length} pontos na série "${serie.name}" (> ${MAX_POINTS_LINE}): resuma os períodos antes de gerar o gráfico.`,
      )
    }
    for (const row of serie.rows) {
      if (!row.label) throw new Error(`ponto de dado sem rótulo na série "${serie.name}".`)
      if (!Number.isFinite(row.value)) {
        throw new Error(`valor ausente/inválido em "${serie.name} · ${row.label}".`)
      }
      if (row.value < 0) {
        throw new Error(`valor negativo em "${serie.name} · ${row.label}" — a linha parte do zero.`)
      }
    }
  }
  const [first] = series
  const aligned = series.every(
    (serie) =>
      serie.rows.length === first.rows.length &&
      serie.rows.every((row, index) => row.label === first.rows[index].label),
  )
  if (!aligned)
    throw new Error('as séries precisam compartilhar os mesmos períodos, na mesma ordem.')
  if (!first.rows.every((row) => isTemporalLabel(row.label))) {
    throw new Error('a linha multi-série exige períodos no eixo (ex.: anos) — sem categorias.')
  }
  const allowedTones = tonesFor(series.length)
  const tones = series.map((serie) => serie.tone ?? null)
  const informed = tones.filter(Boolean)
  if (informed.length > 0 && informed.length !== series.length) {
    throw new Error(
      allowedTones === TRIAD_TONES
        ? 'informe os três tons (melhor, neutro e neutro escuro) ou de nenhum.'
        : 'informe o tom das duas séries (bom e ruim) ou de nenhuma.',
    )
  }
  for (const tone of informed) {
    if (!allowedTones.includes(tone)) {
      throw new Error(`tom inválido: ${JSON.stringify(tone)} (use ${allowedTones.join(', ')}).`)
    }
  }
  if (informed.length === series.length && new Set(tones).size !== series.length) {
    throw new Error(
      allowedTones === TRIAD_TONES
        ? 'os três tons precisam ser distintos (melhor, neutro e neutro escuro).'
        : 'as duas séries não podem compartilhar o mesmo tom (bom × ruim).',
    )
  }
  if (spec.projectedLabel) {
    const last = first.rows[first.rows.length - 1].label
    if (last !== spec.projectedLabel) {
      throw new Error(
        `a projeção só é marcada no último período (recebido "${spec.projectedLabel}"; último é "${last}").`,
      )
    }
  }
  if (spec.crossingLabel) {
    const good = series.find((serie) => serie.tone === 'good')
    const bad = series.find((serie) => serie.tone === 'bad')
    if (!good || !bad) {
      throw new Error('a anotação de cruzamento exige os tons bom e ruim — informe --good e --bad.')
    }
    const labels = first.rows.map((row) => row.label)
    const index = labels.indexOf(spec.crossingLabel)
    if (index < 1) {
      throw new Error(
        `cruzamento "${spec.crossingLabel}" precisa ser um período depois do primeiro — confira o rótulo.`,
      )
    }
    const overtakes =
      good.rows[index].value > bad.rows[index].value &&
      good.rows[index - 1].value <= bad.rows[index - 1].value
    if (!overtakes) {
      throw new Error(
        `não há ultrapassagem confirmada em "${spec.crossingLabel}" — confira os valores antes de anotar.`,
      )
    }
  }
}

/**
 * Guardrails of the approved variation bar (delta variant): zero-based, at most
 * `MAX_POINTS` categories, both measures present, no retraction (a zero-based
 * bar cannot carry a fall — the person gets the two-series line instead) and no
 * highlight (the two-tone pair is fixed; the piece has no valence).
 */
const validateDelta = (spec) => {
  const { rows, startLabel, endLabel } = spec
  if (spec.highlight) {
    throw new Error('a barra de variação não aceita destaque: o par de tons é fixo e sem valência.')
  }
  if (
    typeof startLabel !== 'string' ||
    startLabel.trim() === '' ||
    typeof endLabel !== 'string' ||
    endLabel.trim() === ''
  ) {
    throw new Error('a barra de variação exige startLabel e endLabel (os dois períodos da gutter).')
  }
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error('sem pontos de dado para desenhar.')
  if (rows.length > MAX_POINTS) {
    throw new Error(
      `${rows.length} pontos (> ${MAX_POINTS}): resuma as categorias antes de gerar o gráfico.`,
    )
  }
  for (const row of rows) {
    if (!row.label) throw new Error('ponto de dado sem rótulo.')
    if (!Number.isFinite(row.initial))
      throw new Error(`valor inicial ausente/inválido em "${row.label}".`)
    if (!Number.isFinite(row.final))
      throw new Error(`valor final ausente/inválido em "${row.label}".`)
    if (row.initial < 0 || row.final < 0)
      throw new Error(`valor negativo em "${row.label}" — a barra parte do zero.`)
    if (row.final < row.initial) {
      throw new Error(
        `retração em "${row.label}" (${row.initial} → ${row.final}): a barra de base zero não representa queda — use a linha de duas séries.`,
      )
    }
    if (row.final <= 0) throw new Error(`valor final não positivo em "${row.label}".`)
  }
}

/**
 * Fail-closed guardrails of the approved template. Throws with the actionable
 * reason instead of drawing a misleading chart.
 */
export const validateSpec = (spec) => {
  const { chartType, rows, series, headline } = spec
  if (spec.size && !SIZES[spec.size]) {
    throw new Error(
      `tamanho inválido: ${JSON.stringify(spec.size)} (use ${Object.keys(SIZES).join(', ')})`,
    )
  }
  if (spec.unit !== undefined && spec.unit !== null && typeof spec.unit !== 'string') {
    throw new Error('unidade inválida — use uma string (ex.: --unit="%").')
  }
  if (spec.noHighlight !== undefined && typeof spec.noHighlight !== 'boolean') {
    throw new Error('noHighlight inválido — use booleano.')
  }
  if (spec.noHighlight && spec.highlight) {
    throw new Error(
      'destaque e peça sem destaque são exclusivos — use --highlight ou --no-highlight, nunca os dois.',
    )
  }
  if (spec.dualPositive !== undefined && typeof spec.dualPositive !== 'boolean') {
    throw new Error('dualPositive inválido — use booleano.')
  }
  if (spec.dualPositive) {
    if (chartType !== 'column') {
      throw new Error('a comparação positiva dupla exige o tipo coluna (--type=column).')
    }
    if (!Array.isArray(spec.rows) || spec.rows.length !== 2) {
      throw new Error(
        `a comparação positiva dupla desenha exatamente 2 categorias (${spec.rows?.length ?? 0} recebidas).`,
      )
    }
    if (spec.highlight) {
      throw new Error('a comparação positiva dupla não usa destaque — remova o --highlight.')
    }
    if (spec.noHighlight) {
      throw new Error(
        'a comparação positiva dupla já é a peça positiva — não combine com --no-highlight.',
      )
    }
    if (spec.size && spec.size !== 'feed') {
      throw new Error(
        'a comparação positiva dupla está certificada no tamanho feed; peça o design das versões quadrada/story antes.',
      )
    }
  }
  if (
    spec.kicker !== undefined &&
    spec.kicker !== null &&
    (typeof spec.kicker !== 'string' || spec.kicker.trim() === '')
  ) {
    throw new Error('kicker inválido — use uma string não vazia.')
  }
  if (!CHART_TYPES.includes(chartType)) {
    if (chartType === 'pie') {
      throw new Error(
        'pizza não é gerada no v1 (a comparação fica escondida); use barras horizontais.',
      )
    }
    throw new Error(`tipo de gráfico inválido: ${JSON.stringify(chartType)}`)
  }
  if (chartType === 'delta') {
    validateDelta(spec)
  } else if (Array.isArray(series) && series.length > 0) {
    validateSeries(spec)
  } else {
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
      if (row.value < 0)
        throw new Error(`valor negativo em "${row.label}" — barras partem do zero.`)
    }
    if (spec.highlight && !rows.some((row) => row.label === spec.highlight)) {
      throw new Error(`destaque "${spec.highlight}" não existe nos dados — confira o rótulo.`)
    }
  }
  if (typeof headline !== 'string' || headline.trim() === '') {
    throw new Error('título-manchete ausente — a manchete é obrigatória.')
  }
  return spec
}
