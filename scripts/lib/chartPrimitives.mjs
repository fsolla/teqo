/**
 * Chart primitives (owner of the drawing): inline-SVG emitters shared by the
 * A4 dossier renderer (C186/C187) and the Instagram chart renderer (C191).
 *
 * Extracted from `dossieRender.mjs` when the Instagram generator became the
 * second consumer, so a fix to the honest-scale/guardrail drawing lives once.
 * The dossier keeps its mm/pt page composition; each consumer composes its own
 * page around these primitives — never a second copy of the drawing.
 */

import { htmlEscape } from './reportText.mjs'

/**
 * Domain palette of the dossier charts. Instagram passes its own Solla palette
 * explicitly; this map stays the dossier default so its output is unchanged.
 */
export const CHART_COLORS = {
  municipio: '#315c75',
  regiao: '#9d8b64',
  polo: '#8f819c',
  instituicao: '#315c75',
  setor: '#9d8b64',
  rede: '#8f819c',
  empenhado: '#6b4918',
  liquidado: '#4a6b7c',
  pago: '#285338',
  autorizado: '#8a5a18',
  restos: '#5b6470',
  nao_informado: '#8b96a2',
  default: '#315c75',
}

/**
 * Honest-scale proportion of a value against the maximum, as a percentage
 * (0..100). Zero stays zero (no bar is drawn); a present small value keeps a
 * visible minimum so it is not mistaken for absent. Used for the ranking width
 * and the column height of the Instagram renderer.
 */
export const proportionalPercent = (value, max) =>
  value <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((value / Math.max(1, max)) * 100)))

export const barChart = ({ rows, width = 330, rowHeight = 19, labelWidth = 118 }) => {
  const max = Math.max(1, ...rows.map((row) => row.count))
  const barMax = width - labelWidth - 26
  const height = rows.length * rowHeight + 4
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">
    ${rows
      .map((row, index) => {
        const y = index * rowHeight + 3
        const barWidth = Math.max(2, Math.round((row.count / max) * barMax))
        return `<text x="0" y="${y + 11}" class="chart-label">${htmlEscape(row.label)}</text>
        <rect x="${labelWidth}" y="${y + 2}" width="${barWidth}" height="${rowHeight - 7}" rx="1" fill="${row.color ?? CHART_COLORS.default}" />
        <text x="${labelWidth + barWidth + 4}" y="${y + 11}" class="chart-value">${row.count}</text>`
      })
      .join('')}
  </svg>`
}

/** HTML list with a proportional bar per row — long labels wrap, nothing overlaps. */
export const valueList = ({ rows, format }) => {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return `<ul class="value-list">
    ${rows
      .map(
        (row) => `<li>
      <span>${htmlEscape(row.label)}</span>
      <span class="value-list-bar"><span style="width:${Math.max(2, Math.round((row.value / max) * 100))}%"></span></span>
      <span class="value-list-value">${htmlEscape(format(row))}</span>
    </li>`,
      )
      .join('')}
  </ul>`
}

/**
 * Vertical columns with the value label above and the year label below.
 * `fullYearLabel` prints the whole year (theme axis); the institution keeps the
 * 2-digit label.
 */
export const columnChart = ({
  rows,
  width = 330,
  height = 132,
  format = (row) => String(row.count),
  fullYearLabel = false,
}) => {
  const max = Math.max(1, ...rows.map((row) => row.value ?? row.count))
  const baseY = height - 18
  const plotHeight = baseY - 16
  const columnWidth = (width - 8) / Math.max(1, rows.length)
  return `<svg class="chart" viewBox="0 0 ${width} ${height + 20}" role="img">
    ${rows
      .map((row, index) => {
        const value = row.value ?? row.count
        const barHeight = Math.max(2, Math.round((value / max) * plotHeight))
        const x = 4 + index * columnWidth
        const y = baseY - barHeight
        return `<rect x="${x + 2}" y="${y}" width="${Math.max(2, columnWidth - 5)}" height="${barHeight}" fill="${row.color ?? CHART_COLORS.default}" />
        <text x="${x + columnWidth / 2}" y="${y - 3}" class="chart-value" text-anchor="middle">${htmlEscape(format(row))}</text>
        <text x="${x + columnWidth / 2}" y="${height + 12}" class="chart-label" text-anchor="middle">${htmlEscape(fullYearLabel ? String(row.key) : String(row.key).slice(-2))}</text>`
      })
      .join('')}
  </svg>`
}

/** Vertical columns stacked by phase (money by year), total label above. */
export const stackedColumnChart = ({
  rows,
  width = 330,
  height = 132,
  format,
  fullYearLabel = false,
}) => {
  const max = Math.max(1, ...rows.map((row) => row.value))
  const baseY = height - 18
  const plotHeight = baseY - 16
  const columnWidth = (width - 8) / Math.max(1, rows.length)
  return `<svg class="chart" viewBox="0 0 ${width} ${height + 20}" role="img">
    ${rows
      .map((row, index) => {
        const x = 4 + index * columnWidth
        let y = baseY
        const bars = row.segments
          .map((segment) => {
            const segmentHeight = Math.max(1, Math.round((segment.amount / max) * plotHeight))
            y -= segmentHeight
            return `<rect x="${x + 2}" y="${y}" width="${Math.max(2, columnWidth - 5)}" height="${segmentHeight}" fill="${CHART_COLORS[segment.key] ?? CHART_COLORS.default}" />`
          })
          .join('')
        const top = baseY - Math.round((row.value / max) * plotHeight)
        return `${bars}
        <text x="${x + columnWidth / 2}" y="${top - 3}" class="chart-value" text-anchor="middle">${htmlEscape(format(row))}</text>
        <text x="${x + columnWidth / 2}" y="${height + 12}" class="chart-label" text-anchor="middle">${htmlEscape(fullYearLabel ? String(row.key) : String(row.key).slice(-2))}</text>`
      })
      .join('')}
  </svg>`
}

/**
 * Time-series line (Instagram): every point a hollow marker, the last one the
 * single red highlight with its value. Honest scale — the baseline is zero.
 */
export const lineChart = ({
  rows,
  width = 880,
  height = 420,
  format,
  stroke = '#78716c',
  highlight = '#c51414',
  paper = '#faf9f7',
  ink = '#1c1917',
  grid = '#a8a29e',
}) => {
  const max = Math.max(1, ...rows.map((row) => row.value))
  const padX = 46
  const padTop = 42
  const baseline = height - 46
  const plotHeight = baseline - padTop
  const step = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : 0
  const pointAt = (row, index) => {
    const x = padX + index * step
    const y = baseline - Math.round((row.value / max) * plotHeight)
    return { x, y }
  }
  const points = rows.map(pointAt)
  const last = points[points.length - 1]
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">
    <line x1="${padX}" y1="${baseline}" x2="${width - padX}" y2="${baseline}" stroke="${grid}" stroke-width="2" />
    <polyline points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    <g fill="${paper}" stroke="${stroke}" stroke-width="4">
      ${points
        .slice(0, -1)
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="7" />`)
        .join('')}
    </g>
    <circle cx="${last.x}" cy="${last.y}" r="10" fill="${highlight}" />
    <text x="${last.x}" y="${last.y - 22}" text-anchor="end" fill="${ink}" font-size="34" font-weight="800">${htmlEscape(format(rows[rows.length - 1]))}</text>
    ${rows
      .map(
        (row, index) =>
          `<text x="${pointAt(row, index).x}" y="${height - 10}" text-anchor="middle" fill="#57534e" font-size="30" font-weight="650">${htmlEscape(row.label)}</text>`,
      )
      .join('')}
  </svg>`
}
