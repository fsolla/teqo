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
 * Geometry of the approved two-series time line (C191 variant), per export
 * size. The data box is the same on every canvas; only the vertical rhythm and
 * the marker sizes change (design: "Feed / Quadrado / Story" rules).
 */
const DUAL_GEOMETRY = {
  feed: {
    width: 880,
    height: 620,
    left: 52,
    right: 600,
    top: 56,
    baseline: 544,
    stroke: 8,
    dotRadius: 8,
    squareSize: 16,
    projectedDotRadius: 11,
    projectedSquareSize: 20,
    dash: '18 12',
    nameSize: 30,
    valueSize: 36,
    valenceSize: 30,
    changeSize: 30,
    axisSize: 30,
    blockOffsets: [-35, 7, 47, 87],
    blockGap: 72,
    crossing: {
      boxWidth: 254,
      boxHeight: 118,
      boxY: 398,
      yearOffset: 33,
      copyOffset: 67,
      copyOffset2: 99,
    },
  },
  square: {
    width: 880,
    height: 440,
    left: 52,
    right: 600,
    top: 40,
    baseline: 370,
    stroke: 7,
    dotRadius: 7,
    squareSize: 14,
    projectedDotRadius: 10,
    projectedSquareSize: 18,
    dash: '15 11',
    nameSize: 30,
    valueSize: 32,
    valenceSize: 30,
    changeSize: 30,
    axisSize: 30,
    blockOffsets: [-31, 7, 45, 83],
    blockGap: 40,
    crossing: {
      boxWidth: 254,
      boxHeight: 108,
      boxY: 252,
      yearOffset: 30,
      copyOffset: 59,
      copyOffset2: 88,
    },
  },
  story: {
    width: 880,
    height: 700,
    left: 52,
    right: 600,
    top: 64,
    baseline: 622,
    stroke: 8,
    dotRadius: 8,
    squareSize: 16,
    projectedDotRadius: 11,
    projectedSquareSize: 20,
    dash: '18 12',
    nameSize: 32,
    valueSize: 36,
    valenceSize: 32,
    changeSize: 32,
    axisSize: 30,
    blockOffsets: [-34, 10, 52, 94],
    blockGap: 84,
    crossing: {
      boxWidth: 254,
      boxHeight: 118,
      boxY: 478,
      yearOffset: 33,
      copyOffset: 67,
      copyOffset2: 99,
    },
  },
}

/** Rounds the shared maximum up to the next legible step (never down). */
const niceMax = (value) => {
  if (!(value > 0)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude
    if (candidate >= value) return candidate
  }
  return 10 * magnitude
}

/**
 * 9–12 annual points alternate their axis labels, always keeping the first and
 * the last; the penultimate is dropped when it would collide with the last
 * (design: "2017, 2019, 2021, 2023 e 2026"). Shared by the two- and the
 * three-series lines.
 */
const axisLabelIndices = (count) => {
  if (count < 9) return [...Array(count).keys()]
  const shown = new Set()
  for (let index = 0; index < count; index += 2) shown.add(index)
  const last = count - 1
  if (!shown.has(last)) {
    shown.delete(last - 1)
    shown.add(last)
  }
  return [...shown].sort((a, b) => a - b)
}

/** Keeps the crossing box inside the data box while staying centered on the point. */
const crossingCenter = (x, cfg) =>
  Math.min(Math.max(x, cfg.left + cfg.crossing.boxWidth / 2), cfg.right - cfg.crossing.boxWidth / 2)

/**
 * Two-series time line (Instagram, C191 approved variant): shared zero-based
 * scale, direct end labels and valence carried by word + arrow + shape + color.
 * `series` items are `{ name, tone?: 'good'|'bad', rows: [{ label, value }] }`;
 * tones come in pairs, or not at all (neutral comparison, no red in the plot).
 */
export const dualLineChart = ({
  series,
  size = 'feed',
  projected = false,
  crossingLabel = /** @type {string | null} */ (null),
  colors,
  valence,
  format,
}) => {
  const cfg = DUAL_GEOMETRY[size] ?? DUAL_GEOMETRY.feed
  const count = series[0].rows.length
  const max = niceMax(Math.max(...series.flatMap((serie) => serie.rows.map((row) => row.value))))
  const step = count > 1 ? (cfg.right - cfg.left) / (count - 1) : 0
  const xAt = (index) => Math.round(cfg.left + index * step)
  const yAt = (value) => cfg.baseline - Math.round((value / max) * (cfg.baseline - cfg.top))
  const pointsOf = (serie) => serie.rows.map((row, index) => ({ x: xAt(index), y: yAt(row.value) }))
  const styles = series.map((serie, index) => {
    if (serie.tone === 'good') {
      return { color: colors.good, shape: 'circle', valence: valence.good, tone: 'good' }
    }
    if (serie.tone === 'bad') {
      return { color: colors.bad, shape: 'square', valence: valence.bad, tone: 'bad' }
    }
    return index === 0
      ? { color: colors.neutralA, shape: 'circle', valence: null, tone: 'a' }
      : { color: colors.neutralB, shape: 'square', valence: null, tone: 'b' }
  })

  const marker = ({ x, y, shape, size: markerSize, fill, className = '' }) =>
    shape === 'square'
      ? `<rect x="${x - markerSize / 2}" y="${y - markerSize / 2}" width="${markerSize}" height="${markerSize}" fill="${fill}"${className ? ` class="${className}"` : ''} />`
      : `<circle cx="${x}" cy="${y}" r="${markerSize / 2}" fill="${fill}"${className ? ` class="${className}"` : ''} />`

  const band = projected
    ? (() => {
        const before = xAt(count - 2)
        const last = xAt(count - 1)
        const start = Math.round((before + last) / 2)
        const end = last + 33
        return `<rect class="dual-projection-band" x="${start}" y="0" width="${end - start}" height="${cfg.baseline}" fill="${colors.grid}" fill-opacity="0.16" />`
      })()
    : ''

  const gridLines = `<line class="dual-grid-line" x1="${cfg.left}" y1="${cfg.top}" x2="${cfg.right}" y2="${cfg.top}" stroke="${colors.grid}" stroke-opacity="0.32" stroke-width="2" />
      <line class="dual-grid-line" x1="${cfg.left}" y1="${Math.round((cfg.top + cfg.baseline) / 2)}" x2="${cfg.right}" y2="${Math.round((cfg.top + cfg.baseline) / 2)}" stroke="${colors.grid}" stroke-opacity="0.32" stroke-width="2" />
      <line class="dual-zero-line" x1="${cfg.left}" y1="${cfg.baseline}" x2="${cfg.right}" y2="${cfg.baseline}" stroke="${colors.grid}" stroke-width="2" />
      <text x="${cfg.left - 10}" y="${cfg.baseline - 5}" text-anchor="end" class="dual-axis-label" font-size="${cfg.axisSize}">0</text>`

  const projectionLabel = projected
    ? `<text x="${cfg.right + 24}" y="${cfg.top - 11}" text-anchor="end" class="dual-projection-label" font-size="${cfg.axisSize}">projeção</text>`
    : ''

  const lines = series
    .map((serie, index) => {
      const points = pointsOf(serie)
      const style = styles[index]
      const solid = projected ? points.slice(0, -1) : points
      const polyline = `<polyline class="dual-series dual-series-${style.tone}" points="${solid.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${style.color}" stroke-width="${cfg.stroke}" stroke-linecap="round" stroke-linejoin="round" />`
      const dashed = projected
        ? `<line class="dual-series-projection dual-series-${style.tone}" x1="${points[count - 2].x}" y1="${points[count - 2].y}" x2="${points[count - 1].x}" y2="${points[count - 1].y}" stroke="${style.color}" stroke-width="${cfg.stroke}" stroke-linecap="round" stroke-dasharray="${cfg.dash}" />`
        : ''
      const regular = projected ? points.slice(0, -1) : points
      const markers = `<g class="dual-markers-${style.tone}" fill="${style.color}">${regular
        .map((point) =>
          marker({
            x: point.x,
            y: point.y,
            shape: style.shape,
            size: style.shape === 'square' ? cfg.squareSize : cfg.dotRadius * 2,
            fill: style.color,
          }),
        )
        .join('')}</g>`
      return `${polyline}${dashed}${markers}`
    })
    .join('')

  const projectedMarkers = projected
    ? series
        .map((serie, index) => {
          const point = pointsOf(serie)[count - 1]
          const style = styles[index]
          return marker({
            x: point.x,
            y: point.y,
            shape: style.shape,
            size: style.shape === 'square' ? cfg.projectedSquareSize : cfg.projectedDotRadius * 2,
            fill: colors.paper,
            className: `dual-marker-projected dual-marker-projected-${style.tone}`,
          }).replace('/>', ` stroke="${style.color}" stroke-width="5" />`)
        })
        .join('')
    : ''

  const observedIndex = projected ? count - 2 : count - 1
  const changeOf = (serie) => {
    const firstValue = serie.rows[0].value
    const observed = serie.rows[observedIndex]?.value
    if (!(firstValue > 0) || !Number.isFinite(observed)) return null
    const percent = Math.round(((observed - firstValue) / firstValue) * 100)
    const sign = percent > 0 ? '+' : percent < 0 ? '−' : ''
    const until = `até ${serie.rows[observedIndex].label}`
    return {
      percent: `${sign}${Math.abs(percent)}%`,
      until,
      label: `${sign}${Math.abs(percent)}% ${until}`,
    }
  }

  const blocks = series
    .map((serie, index) => {
      const point = pointsOf(serie)[count - 1]
      const offsets = styles[index].valence ? cfg.blockOffsets : cfg.blockOffsets.slice(0, 3)
      return {
        name: serie.name,
        style: styles[index],
        point,
        baselines: offsets.map((offset) => point.y + offset),
        value: format(serie.rows[count - 1]),
        change: changeOf(serie),
      }
    })
    .sort((a, b) => a.point.y - b.point.y)
  let previousBottom = null
  for (const block of blocks) {
    if (previousBottom !== null) {
      const minName = previousBottom + cfg.blockGap
      const delta = minName - block.baselines[0]
      if (delta > 0) block.baselines = block.baselines.map((baseline) => baseline + delta)
    }
    previousBottom = block.baselines[block.baselines.length - 1]
  }
  const clampOverflow = blocks[blocks.length - 1]?.baselines.at(-1) - (cfg.height - 12)
  const endBlocks = blocks
    .map((block) => {
      const baselineOffset = clampOverflow > 0 ? -clampOverflow : 0
      const text = (className, size, fill, value, index) =>
        `<text x="${cfg.right + 42}" y="${block.baselines[index] + baselineOffset}" class="${className}" font-size="${size}"${fill ? ` fill="${fill}"` : ''}>${htmlEscape(value)}</text>`
      const parts = [
        `<line class="dual-end-leader" x1="${cfg.right + 15}" y1="${block.point.y}" x2="${cfg.right + 29}" y2="${block.point.y}" stroke="${block.style.color}" stroke-width="3" />`,
        text('dual-end-name', cfg.nameSize, colors.ink, block.name, 0),
        text('dual-end-value', cfg.valueSize, colors.ink, block.value, 1),
      ]
      if (block.style.valence) {
        parts.push(
          text('dual-end-valence', cfg.valenceSize, block.style.color, block.style.valence, 2),
        )
      }
      if (block.change) {
        parts.push(
          text(
            'dual-end-change',
            cfg.changeSize,
            colors.change,
            block.change.label,
            block.style.valence ? 3 : 2,
          ),
        )
      }
      return parts.join('')
    })
    .join('')

  const goodSeries = series.find((serie) => serie.tone === 'good')
  const crossingIndex = crossingLabel
    ? series[0].rows.findIndex((row) => row.label === crossingLabel)
    : -1
  const showCrossing = Boolean(goodSeries) && crossingIndex >= 1
  const crossingGuide = showCrossing
    ? (() => {
        const point = pointsOf(goodSeries)[crossingIndex]
        const center = crossingCenter(point.x, cfg)
        return `<line class="dual-crossing-guide" x1="${center}" y1="${point.y + 16}" x2="${center}" y2="${cfg.crossing.boxY}" stroke="${colors.good}" stroke-width="2" stroke-dasharray="8 8" opacity="0.45" />`
      })()
    : ''
  const crossingAnnotation = showCrossing
    ? (() => {
        const point = pointsOf(goodSeries)[crossingIndex]
        const box = cfg.crossing
        const center = crossingCenter(point.x, cfg)
        return `<circle class="dual-crossing-ring" cx="${point.x}" cy="${point.y}" r="14" fill="${colors.paper}" stroke="${colors.good}" stroke-width="4" />
      <circle cx="${point.x}" cy="${point.y}" r="7" fill="${colors.good}" />
      <rect class="dual-crossing-box" x="${Math.round(center - box.boxWidth / 2)}" y="${box.boxY}" width="${box.boxWidth}" height="${box.boxHeight}" rx="8" fill="${colors.paper}" stroke="${colors.grid}" stroke-width="2" />
      <text x="${center}" y="${box.boxY + box.yearOffset}" text-anchor="middle" class="dual-crossing-year" font-size="30" font-weight="850" fill="${colors.good}">${htmlEscape(crossingLabel)}</text>
      <text x="${center}" y="${box.boxY + box.copyOffset}" text-anchor="middle" class="dual-crossing-copy" font-size="28" font-weight="750" fill="${colors.ink}">${htmlEscape(goodSeries.name)}</text>
      <text x="${center}" y="${box.boxY + box.copyOffset2}" text-anchor="middle" class="dual-crossing-copy" font-size="28" font-weight="750" fill="${colors.ink}">ultrapassa</text>`
      })()
    : ''

  const axis = axisLabelIndices(count)
    .map(
      (index) =>
        `<text x="${xAt(index)}" y="${cfg.height - 14}" text-anchor="middle" class="dual-axis-label" font-size="${cfg.axisSize}">${htmlEscape(series[0].rows[index].label)}</text>`,
    )
    .join('')

  const ariaLabel = `${series
    .map((serie) => {
      const change = changeOf(serie)
      const destination = projected
        ? ` para projeção de ${format(serie.rows[count - 1])} em ${serie.rows[count - 1].label}`
        : ` para ${format(serie.rows[count - 1])} em ${serie.rows[count - 1].label}`
      const trend = change
        ? `, variação observada de ${change.percent} até ${serie.rows[observedIndex].label}`
        : ''
      return `${serie.name}: de ${format(serie.rows[0])} em ${serie.rows[0].label}${destination}${trend}`
    })
    .join('. ')}${showCrossing ? `. ${goodSeries.name} ultrapassa em ${crossingLabel}` : ''}`

  return `<svg class="chart dual-chart" viewBox="0 0 ${cfg.width} ${cfg.height}" role="img" aria-label="${htmlEscape(ariaLabel)}" preserveAspectRatio="xMidYMid meet">
      ${band}
      ${gridLines}
      ${projectionLabel}
      ${crossingGuide}
      ${lines}
      ${projectedMarkers}
      ${crossingAnnotation}
      ${endBlocks}
      ${axis}
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
  highlight = '#e4102f',
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

/**
 * Geometry of the approved three-series time line (C205 extension, feed only).
 * The data box is narrower than the two-series one (x=52…560) so the wider end
 * gutter (x=600…880, 280px) holds three three-line blocks; x=560…600 belongs to
 * the leaders only. Lanes: name / metric / valence with 30–40px line boxes and
 * a 196px pitch (design: 62/108/150 · 258/304/346 · 454/500/542).
 */
const TRIPLE_GEOMETRY = {
  feed: {
    width: 880,
    height: 650,
    left: 52,
    right: 560,
    top: 56,
    baseline: 544,
    stroke: 7,
    dotRadius: 8,
    diamondSize: 14,
    triangleWidth: 20,
    triangleTop: 8,
    triangleApex: 10,
    axisSize: 30,
    axisY: 636,
    zeroX: 42,
    zeroY: 538,
    nameSize: 30,
    metricSize: 34,
    valenceSize: 30,
    textX: 600,
    leader: { start: 570, rail: 580, bend: 590, end: 594 },
    laneOffsets: [62, 108, 150],
    lanePitch: 196,
  },
}

/**
 * Three-series time line (C205 extension of the two-series variant): three
 * observed series on a shared zero-based scale and the triad of redundant tones
 * (melhor = red circle ↑ "amplia"; neutro = gray diamond ↗ "cresce"; neutro
 * escuro = ink triangle ↘ "diminui") with a three-line end gutter. Every point
 * is observed — no band, no dash, no hollow marker, no "projeção".
 *
 * `series` items are `{ name, tone: 'good'|'neutral'|'neutral-dark', rows }`;
 * the caller owns the palette and the valence words (never color alone).
 */
export const tripleLineChart = ({ series, size = 'feed', colors, valence, format }) => {
  const cfg = TRIPLE_GEOMETRY[size] ?? TRIPLE_GEOMETRY.feed
  const count = series[0].rows.length
  const max = niceMax(Math.max(...series.flatMap((serie) => serie.rows.map((row) => row.value))))
  const step = count > 1 ? (cfg.right - cfg.left) / (count - 1) : 0
  const xAt = (index) => Math.round(cfg.left + index * step)
  const yAt = (value) => cfg.baseline - Math.round((value / max) * (cfg.baseline - cfg.top))
  const lastIndex = count - 1

  const marker = (tone, x, y) => {
    if (tone === 'neutral') {
      const half = cfg.diamondSize / 2
      return `<rect x="${x - half}" y="${y - half}" width="${cfg.diamondSize}" height="${cfg.diamondSize}" transform="rotate(45 ${x} ${y})" />`
    }
    if (tone === 'neutral-dark') {
      const half = cfg.triangleWidth / 2
      return `<path d="M${x - half} ${y - cfg.triangleTop} L${x + half} ${y - cfg.triangleTop} L${x} ${y + cfg.triangleApex} Z" />`
    }
    return `<circle cx="${x}" cy="${y}" r="${cfg.dotRadius}" />`
  }

  const gridLines = `<line class="triple-grid-line" x1="${cfg.left}" y1="${cfg.top}" x2="${cfg.right}" y2="${cfg.top}" stroke="${colors.grid}" stroke-opacity="0.32" stroke-width="2" />
      <line class="triple-grid-line" x1="${cfg.left}" y1="${Math.round((cfg.top + cfg.baseline) / 2)}" x2="${cfg.right}" y2="${Math.round((cfg.top + cfg.baseline) / 2)}" stroke="${colors.grid}" stroke-opacity="0.32" stroke-width="2" />
      <line class="triple-zero-line" x1="${cfg.left}" y1="${cfg.baseline}" x2="${cfg.right}" y2="${cfg.baseline}" stroke="${colors.grid}" stroke-width="2" />
      <text x="${cfg.zeroX}" y="${cfg.zeroY}" text-anchor="end" class="triple-axis-label" font-size="${cfg.axisSize}">0</text>`

  const lines = series
    .map((serie) => {
      const color = colors[serie.tone] ?? colors.neutral
      const points = serie.rows.map((row, index) => ({ x: xAt(index), y: yAt(row.value) }))
      return `<polyline class="triple-series triple-series-${serie.tone}" points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${cfg.stroke}" stroke-linecap="round" stroke-linejoin="round" />
      <g class="triple-markers-${serie.tone}" fill="${color}">${points.map((point) => marker(serie.tone, point.x, point.y)).join('')}</g>`
    })
    .join('')

  const changeOf = (serie) => {
    const firstValue = serie.rows[0].value
    const observed = serie.rows[lastIndex].value
    if (!(firstValue > 0) || !Number.isFinite(observed)) return null
    const percent = Math.round(((observed - firstValue) / firstValue) * 100)
    const sign = percent > 0 ? '+' : percent < 0 ? '−' : ''
    return { percent, percentLabel: `${sign}${Math.abs(percent)}%` }
  }

  const blocks = series
    .map((serie) => ({
      serie,
      color: colors[serie.tone] ?? colors.neutral,
      change: changeOf(serie),
      point: { y: yAt(serie.rows[lastIndex].value) },
    }))
    .sort((a, b) => a.point.y - b.point.y)
    .map((block, lane) => ({
      ...block,
      baselines: cfg.laneOffsets.map((offset) => offset + lane * cfg.lanePitch),
    }))

  const endBlocks = blocks
    .map((block) => {
      const { baselines, point } = block
      const metric = `${format(block.serie.rows[lastIndex])}${
        block.change ? ` · ${block.change.percentLabel}` : ''
      }`
      const text = (className, size, fill, value, index) =>
        `<text x="${cfg.textX}" y="${baselines[index]}" class="${className}" font-size="${size}"${fill ? ` fill="${fill}"` : ''}>${htmlEscape(value)}</text>`
      return [
        `<polyline class="triple-end-leader" points="${cfg.leader.start},${point.y} ${cfg.leader.rail},${point.y} ${cfg.leader.bend},${baselines[1]} ${cfg.leader.end},${baselines[1]}" fill="none" stroke="${block.color}" stroke-width="3" />`,
        text('triple-end-name', cfg.nameSize, null, block.serie.name, 0),
        text('triple-end-metric', cfg.metricSize, null, metric, 1),
        text(
          'triple-end-valence',
          cfg.valenceSize,
          block.color,
          valence[block.serie.tone] ?? '',
          2,
        ),
      ].join('')
    })
    .join('')

  const axis = axisLabelIndices(count)
    .map(
      (index) =>
        `<text x="${xAt(index)}" y="${cfg.axisY}" text-anchor="middle" class="triple-axis-label" font-size="${cfg.axisSize}">${htmlEscape(series[0].rows[index].label)}</text>`,
    )
    .join('')

  const ariaLabel = `${series
    .map((serie) => {
      const change = changeOf(serie)
      const direction = !change
        ? ''
        : change.percent > 0
          ? 'aumento'
          : change.percent < 0
            ? 'diminuição'
            : 'sem variação'
      const trend = change ? `, ${direction} de ${Math.abs(change.percent)} por cento` : ''
      return `${serie.name}: de ${format(serie.rows[0])} em ${serie.rows[0].label} para ${format(serie.rows[lastIndex])} em ${serie.rows[lastIndex].label}${trend}`
    })
    .join('. ')}. Todos os pontos de cada série são observados.`

  return `<svg class="chart triple-chart" viewBox="0 0 ${cfg.width} ${cfg.height}" role="img" aria-label="${htmlEscape(ariaLabel)}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      ${lines}
      ${endBlocks}
      ${axis}
    </svg>`
}
