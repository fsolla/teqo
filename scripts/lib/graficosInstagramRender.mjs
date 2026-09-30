/**
 * Instagram chart renderer (C191): composes the approved hi-fi template
 * (`docs/plans/graficos-dados-instagram-ui-design.html`) into a single canvas
 * HTML document, class-by-class, with inline CSS (the pipeline has no bundler
 * and the render must never need the network). One red highlight, honest scale,
 * headline-manchete, source and brand inside the image.
 *
 * The page is authored at the exact export size; `buildPdf.screenshotHtmlPng`
 * only sets the viewport and clips the canvas.
 */

import { RELATION_LABEL, SERIES_RELATION_LABEL, SIZES } from './chartData.mjs'
import { MOTION_CSS, MOTION_STAGES, columnMotion, pairMotion } from './chartMotion.mjs'
import {
  dualLineChart,
  lineChart,
  proportionalPercent,
  tripleLineChart,
} from './chartPrimitives.mjs'
import { htmlEscape } from './reportText.mjs'

/** Official kit 1313 palette, mapped by role (C203). */
export const SOLLA_PALETTE = {
  highlight: '#e4102f',
  brandBlue: '#184e92',
  ink: '#1c1917',
  hairline: '#e7e5e4',
  paper: '#faf9f7',
  bar: '#d6d3d1',
  barStrong: '#a8a29e',
  axis: '#78716c',
  label: '#57534e',
}

const FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const formatValue = (value, unit = '') =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit}`

const sortedByValue = (rows) => [...rows].sort((a, b) => b.value - a.value)

const highlightLabel = (spec) => {
  if (spec.noHighlight) return null
  return spec.highlight ?? sortedByValue(spec.rows)[0]?.label ?? null
}

const rankingBody = (spec) => {
  const rows = sortedByValue(spec.rows)
  const max = Math.max(...rows.map((row) => row.value))
  const winner = highlightLabel(spec)
  return `<div class="rank">
    ${rows
      .map((row) => {
        const percent = proportionalPercent(row.value, max)
        const isHighlight = row.label === winner
        return `<div class="rank-row">
        <span class="rank-label">${htmlEscape(row.label)}</span>
        <div class="bar-track">
          <div class="bar${isHighlight ? ' highlight' : ''}${percent === 0 ? ' zero' : ''}" style="width:${percent}%">${formatValue(row.value, spec.unit)}</div>
        </div>
      </div>`
      })
      .join('')}
  </div>`
}

const columnBody = (spec) => {
  const motion = spec.motion === true
  const rows = spec.rows
  const max = Math.max(...rows.map((row) => row.value))
  const winner = highlightLabel(spec)
  // CENA 02A (approved): the two-positive comparison caps and centers the pair
  // and assigns the tones by input order — never by value.
  const tracks = spec.dualPositive
    ? 'repeat(2, minmax(0, 280px))'
    : `repeat(${rows.length}, minmax(0, 320px))`
  return `<div class="columns" style="grid-template-columns:${tracks}">
    ${rows
      .map((row, index) => {
        const isHighlight = !spec.dualPositive && row.label === winner
        const tone = spec.dualPositive ? ` positive-${index === 0 ? 'a' : 'b'}` : ''
        // C239: the two-period motion grows each column left to right (the
        // recent red one last), with the value landing after the bar settles.
        const timing = columnMotion(index)
        return `<div class="column-cell">
        <span class="column-value${motionClass(motion, timing.value)}"${styleAttr(motionVars(motion, timing.value))}>${formatValue(row.value, spec.unit)}</span>
        <div class="column${isHighlight ? ' highlight' : ''}${tone}${motionClass(motion, timing.bar)}"${styleAttr(styleJoin(`height:${proportionalPercent(row.value, max)}%`, motionVars(motion, timing.bar)))}></div>
        <span class="column-label${motionClass(motion, timing.label)}"${styleAttr(motionVars(motion, timing.label))}>${htmlEscape(row.label)}</span>
      </div>`
      })
      .join('')}
  </div>`
}

const formatPercent = (value) => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Motion plumbing: the schedule travels as `--md`/`--mud` inline vars (C238). */
const styleAttr = (value) => (value ? ` style="${value}"` : '')
const styleJoin = (...parts) => parts.filter(Boolean).join(';')
const motionClass = (motion, timing) => (motion && timing ? ` motion-${timing.kind}` : '')
const motionVars = (motion, timing) =>
  motion && timing ? `--md:${timing.delay}s;--mud:${timing.duration}s` : ''

const deltaOrder = (rows) =>
  [...rows].sort(
    (a, b) => b.final - a.final || a.initial - b.initial || a.label.localeCompare(b.label, 'pt-BR'),
  )

/** The sigla before "·" gets the bold of the approved variant; plain labels stay plain. */
const deltaLabelHtml = (label) => {
  const separator = label.indexOf('·')
  if (separator < 0) return htmlEscape(label)
  return `<b>${htmlEscape(label.slice(0, separator).trim())}</b> · ${htmlEscape(
    label.slice(separator + 1).trim(),
  )}`
}

/**
 * Variation bar (approved C191 variant): one zero-based bar per category, the
 * 0 → initial segment in the base tone and the initial → final extension in the
 * lighter tone. A flat category has no extension segment at all, and the two
 * numbers in the gutter carry the reading — never the color alone.
 */
const deltaBody = (spec) => {
  const rows = deltaOrder(spec.rows)
  const max = Math.max(1, ...rows.map((row) => row.final))
  const aria = `Barras por tipo, de ${spec.startLabel} a ${spec.endLabel}: ${rows
    .map((row) => `${row.label} ${formatValue(row.initial)} → ${formatValue(row.final)}`)
    .join('; ')}.`
  return `<div class="delta-grade" role="img" aria-label="${htmlEscape(aria)}">
    <div class="delta-head">
      <span></span><span></span>
      <span class="delta-period">${htmlEscape(spec.startLabel)}</span>
      <span class="delta-period">${htmlEscape(spec.endLabel)}</span>
    </div>
    ${rows
      .map((row) => {
        const flat = row.final === row.initial
        return `<div class="delta-row${flat ? ' is-flat' : ''}">
      <span class="delta-label">${deltaLabelHtml(row.label)}</span>
      <div class="delta-track">
        <span class="delta-base" style="width:${formatPercent((row.initial / max) * 100)}%"></span>${
          flat
            ? ''
            : `<span class="delta-ext" style="width:${formatPercent(((row.final - row.initial) / max) * 100)}%"></span>`
        }
      </div>
      <span class="delta-value initial">${formatValue(row.initial, spec.unit)}</span>
      <span class="delta-value final">${formatValue(row.final, spec.unit)}</span>
    </div>`
      })
      .join('')}
  </div>`
}

/**
 * Paired columns (C237 degraded design): the same two-measure dataset of the
 * delta, drawn as two zero-based columns per category — the initial in the
 * neutral tone and the recent one in the official red (the positive datum is
 * shared by every pair, never a winner). The period legend carries the color
 * cue, the value travels over each bar and the category label under the pair,
 * so color never carries the reading alone. An initial of zero simply has no
 * gray column.
 *
 * C238 motion: under `spec.motion` the pairs grow left to right (both columns
 * together, labels with the growth, values after the bar lands) and the legend
 * fades in with the shell staging — the timing comes from `chartMotion.mjs`.
 */
const pairedBody = (spec) => {
  const motion = spec.motion === true
  const rows = deltaOrder(spec.rows)
  const max = Math.max(1, ...rows.map((row) => row.final))
  const aria = `Colunas emparelhadas por categoria, ${spec.startLabel} e ${spec.endLabel}: ${rows
    .map(
      (row) =>
        `${row.label} ${formatValue(row.initial, spec.unit)} e ${formatValue(row.final, spec.unit)}`,
    )
    .join('; ')}. A coluna cinza é o início do período; a vermelha é o dado mais recente.`
  return `<div class="paired-grade" role="img" aria-label="${htmlEscape(aria)}">
    <div class="paired-legend${motionClass(motion, MOTION_STAGES.legend)}"${styleAttr(motionVars(motion, MOTION_STAGES.legend))}>
      <span><i class="paired-swatch initial"></i>${htmlEscape(spec.startLabel)}</span>
      <span><i class="paired-swatch final"></i>${htmlEscape(spec.endLabel)}</span>
    </div>
    <div class="paired-columns" style="grid-template-columns:repeat(${rows.length}, minmax(0, 1fr))">
      ${rows
        .map((row, index) => {
          const timing = pairMotion(index)
          const initialHeight = formatPercent((row.initial / max) * 100)
          const finalHeight = formatPercent((row.final / max) * 100)
          return `<div class="paired-pair">
        <div class="paired-bar-cell">
          <span class="paired-value${motionClass(motion, timing.value)}"${styleAttr(motionVars(motion, timing.value))}>${formatValue(row.initial, spec.unit)}</span>${
            row.initial > 0
              ? `<span class="paired-bar${motionClass(motion, timing.bar)}"${styleAttr(styleJoin(`height:${initialHeight}%`, motionVars(motion, timing.bar)))}></span>`
              : ''
          }
        </div>
        <div class="paired-bar-cell">
          <span class="paired-value${motionClass(motion, timing.value)}"${styleAttr(motionVars(motion, timing.value))}>${formatValue(row.final, spec.unit)}</span>
          <span class="paired-bar recent${motionClass(motion, timing.bar)}"${styleAttr(styleJoin(`height:${finalHeight}%`, motionVars(motion, timing.bar)))}></span>
        </div>
        <span class="paired-label${motionClass(motion, timing.label)}"${styleAttr(motionVars(motion, timing.label))}>${deltaLabelHtml(row.label)}</span>
      </div>`
        })
        .join('')}
    </div>
  </div>`
}

const anchorBody = (spec) => {
  // C239: the anchor motion rises the hero number and fades the copy after it —
  // same vocabulary, never a dramatic count-up.
  const motion = spec.motion === true
  const row = spec.rows[0]
  const copy = row.label || spec.subtitle || ''
  return `<div class="anchor">
    <div class="anchor-number${motionClass(motion, MOTION_STAGES.number)}"${styleAttr(motionVars(motion, MOTION_STAGES.number))}>${formatValue(row.value, spec.unit)}</div>
    ${copy ? `<p class="anchor-copy${motionClass(motion, MOTION_STAGES.copy)}"${styleAttr(motionVars(motion, MOTION_STAGES.copy))}>${htmlEscape(copy)}</p>` : ''}
  </div>`
}

/**
 * Two-series time line (approved C191 variant): the valence travels by word +
 * arrow + marker shape + color, never by color alone. Red belongs to the
 * mandate (the good path); the falling series stays neutral.
 */
const DUAL_COLORS = {
  good: SOLLA_PALETTE.highlight,
  bad: SOLLA_PALETTE.axis,
  neutralA: SOLLA_PALETTE.ink,
  neutralB: SOLLA_PALETTE.axis,
  grid: SOLLA_PALETTE.barStrong,
  paper: SOLLA_PALETTE.paper,
  ink: SOLLA_PALETTE.ink,
  change: SOLLA_PALETTE.label,
}

const DUAL_VALENCE = { good: '↑ amplia', bad: '↓ recua' }

const dualBody = (spec) => {
  const sizeKey = SIZES[spec.size] ? spec.size : 'feed'
  return `<div class="dual-line-plot">${dualLineChart({
    series: spec.series,
    size: sizeKey,
    projected: Boolean(spec.projectedLabel),
    crossingLabel: spec.crossingLabel ?? null,
    colors: DUAL_COLORS,
    valence: DUAL_VALENCE,
    format: (row) => formatValue(row.value, spec.unit),
  })}</div>`
}

/**
 * Three-series time line (approved C205 extension of the two-series variant,
 * projected final period certified by C207; feed only): melhor = red + circle +
 * "↑ amplia"; neutro = gray + diamond + "↗ cresce"; neutro escuro = ink +
 * triangle + "↘ diminui" (factual direction, never the bad valence "↓ recua").
 * Every tone travels by word + arrow + shape + color, and the brand blue leaves
 * the data entirely.
 */
const TRIPLE_COLORS = {
  good: SOLLA_PALETTE.highlight,
  neutral: SOLLA_PALETTE.axis,
  'neutral-dark': SOLLA_PALETTE.ink,
  grid: SOLLA_PALETTE.barStrong,
  paper: SOLLA_PALETTE.paper,
  ink: SOLLA_PALETTE.ink,
}

const TRIPLE_VALENCE = { good: '↑ amplia', neutral: '↗ cresce', 'neutral-dark': '↘ diminui' }

const tripleBody = (spec) =>
  `<div class="triple-line-plot">${tripleLineChart({
    series: spec.series,
    size: 'feed',
    projected: Boolean(spec.projectedLabel),
    colors: TRIPLE_COLORS,
    valence: TRIPLE_VALENCE,
    format: (row) => formatValue(row.value),
  })}</div>`

const plotBody = (spec) => {
  if (spec.chartType === 'delta') return spec.pairedColumns ? pairedBody(spec) : deltaBody(spec)
  const seriesCount = Array.isArray(spec.series) ? spec.series.length : 0
  if (seriesCount === 3) return tripleBody(spec)
  if (seriesCount > 0) return dualBody(spec)
  if (spec.chartType === 'anchor') return anchorBody(spec)
  if (spec.chartType === 'column') return columnBody(spec)
  if (spec.chartType === 'line') {
    return `<div class="line-plot">${lineChart({
      rows: spec.rows,
      width: 880,
      height: 430,
      format: (row) => formatValue(row.value, spec.unit),
      stroke: SOLLA_PALETTE.axis,
      highlight: SOLLA_PALETTE.highlight,
      paper: SOLLA_PALETTE.paper,
      ink: SOLLA_PALETTE.ink,
      grid: SOLLA_PALETTE.barStrong,
    })}</div>`
  }
  return rankingBody(spec)
}

const brandMark = (brandMarkDataUri) => `<div class="brand-logo-frame">
    <img src="${brandMarkDataUri}" alt="Jorge Solla — Deputado Federal" />
  </div>`

const footer = (spec, brandMarkDataUri, motion = false) =>
  `<footer class="footer${motionClass(motion, MOTION_STAGES.footer)}"${styleAttr(motionVars(motion, MOTION_STAGES.footer))}>
    <p class="source"><strong>Fonte:</strong> ${htmlEscape(spec.source)}${spec.note ? `<br />Nota: ${htmlEscape(spec.note)}` : ''}</p>
    ${brandMark(brandMarkDataUri)}
  </footer>`

const CSS = `* { box-sizing: border-box; }
html, body { margin: 0; background: ${SOLLA_PALETTE.paper}; }
.canvas {
  position: relative;
  overflow: hidden;
  color: ${SOLLA_PALETTE.ink};
  background: ${SOLLA_PALETTE.paper};
  font-family: ${FONT_STACK};
  -webkit-font-smoothing: antialiased;
}
.inner { position: absolute; inset: 0; display: flex; flex-direction: column; }
.top-rule { width: 64px; height: 10px; background: ${SOLLA_PALETTE.brandBlue}; }
.context { margin: 0; color: ${SOLLA_PALETTE.brandBlue}; font-size: 30px; line-height: 1.2; font-weight: 750; }
.headline { margin: 0; font-weight: 800; line-height: 1.03; letter-spacing: -0.045em; }
.subtitle { margin: 0; color: ${SOLLA_PALETTE.label}; font-weight: 450; line-height: 1.35; }
.plot { flex: 1; min-height: 0; }
.rank { display: grid; align-content: start; }
.rank-row { display: grid; grid-template-columns: 250px 1fr; align-items: center; gap: 22px; }
.rank-label { font-size: 31px; line-height: 1.08; font-weight: 650; }
.bar-track { position: relative; height: 53px; border-left: 2px solid ${SOLLA_PALETTE.axis}; }
.bar {
  display: flex; align-items: center; justify-content: flex-end; height: 100%;
  min-width: 94px; padding-right: 16px; color: #292524; background: ${SOLLA_PALETTE.bar};
  font-size: 31px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums;
}
.bar.highlight { color: #fff; background: ${SOLLA_PALETTE.highlight}; }
.bar.zero { min-width: 0; padding: 0 0 0 8px; justify-content: flex-start; }
.delta-grade {
  --delta-label-w: 292px;
  --delta-v1-w: 88px;
  --delta-v2-w: 110px;
  --delta-gap: 20px;
  --delta-bar-h: 53px;
  --delta-base: ${SOLLA_PALETTE.barStrong};
  --delta-ext: ${SOLLA_PALETTE.bar};
  flex: none;
  display: grid;
  gap: var(--delta-gap);
  margin-top: 34px;
}
.delta-head,
.delta-row {
  display: grid;
  grid-template-columns: var(--delta-label-w) 1fr var(--delta-v1-w) var(--delta-v2-w);
  align-items: center;
  gap: var(--delta-gap);
}
.delta-head { align-items: end; padding-bottom: 6px; }
.delta-label { font-size: 30px; line-height: 1.1; font-weight: 650; }
.delta-label b { font-weight: 850; }
.delta-track {
  position: relative;
  display: flex;
  height: var(--delta-bar-h);
  border-left: 2px solid ${SOLLA_PALETTE.axis};
}
.delta-base { height: 100%; background: var(--delta-base); }
.delta-ext {
  height: 100%;
  background: var(--delta-ext);
  border-left: 3px solid ${SOLLA_PALETTE.axis};
}
.delta-value {
  font-variant-numeric: tabular-nums;
  font-size: 31px;
  line-height: 1;
  text-align: right;
  white-space: nowrap;
}
.delta-value.initial { color: ${SOLLA_PALETTE.label}; font-weight: 700; }
.delta-value.final { color: ${SOLLA_PALETTE.ink}; font-weight: 850; }
.delta-period {
  color: ${SOLLA_PALETTE.label};
  font-size: 30px;
  line-height: 1;
  font-weight: 750;
  text-align: right;
  white-space: nowrap;
}
.paired-grade { display: flex; flex-direction: column; height: 100%; }
.paired-legend {
  flex: none; display: flex; justify-content: flex-end; align-items: center;
  gap: 26px; margin-bottom: 16px; color: ${SOLLA_PALETTE.label};
  font-size: 28px; line-height: 1; font-weight: 700;
}
.paired-legend span { display: inline-flex; align-items: center; gap: 10px; }
.paired-swatch { width: 18px; height: 18px; flex: 0 0 18px; }
.paired-swatch.initial { background: ${SOLLA_PALETTE.bar}; }
.paired-swatch.final { background: ${SOLLA_PALETTE.highlight}; }
.paired-columns {
  flex: 1; min-height: 0; display: grid; align-items: end; gap: 30px;
  padding: 0 5px 46px; border-bottom: 3px solid ${SOLLA_PALETTE.barStrong};
}
.paired-pair {
  position: relative; display: flex; align-items: flex-end; justify-content: center;
  gap: 12px; height: 100%;
}
.paired-bar-cell {
  position: relative; display: flex; flex-direction: column; justify-content: flex-end;
  width: 50%; max-width: 86px; height: 100%;
}
.paired-value {
  margin-bottom: 10px; color: ${SOLLA_PALETTE.ink}; text-align: center;
  font-size: 31px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums;
}
.paired-bar { background: ${SOLLA_PALETTE.bar}; }
.paired-bar.recent { background: ${SOLLA_PALETTE.highlight}; }
.paired-label {
  position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%);
  color: ${SOLLA_PALETTE.label}; text-align: center; white-space: nowrap;
  font-size: 30px; line-height: 1; font-weight: 650;
}
.columns { display: grid; justify-content: center; align-items: end; gap: 26px; height: 100%; padding-bottom: 46px; border-bottom: 3px solid ${SOLLA_PALETTE.barStrong}; }
.plot.dual-positive-plot { flex: none; height: 500px; margin-top: 34px; }
.column.positive-a { background: ${SOLLA_PALETTE.highlight}; }
.column.positive-b { background: ${SOLLA_PALETTE.highlight}; }
.column-cell { position: relative; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
.column-value { margin-bottom: 10px; text-align: center; font-size: 31px; font-weight: 800; font-variant-numeric: tabular-nums; }
.column { background: ${SOLLA_PALETTE.bar}; min-height: 6px; }
.column.highlight { background: ${SOLLA_PALETTE.highlight}; }
.column-label { position: absolute; bottom: -40px; left: 0; width: 100%; text-align: center; color: ${SOLLA_PALETTE.label}; font-size: 30px; font-weight: 650; white-space: nowrap; }
.line-plot { height: 100%; display: flex; align-items: center; }
.line-plot svg { width: 100%; height: auto; }
.dual-line-plot { flex: none; }
.dual-line-plot svg { display: block; width: 880px; height: auto; }
.dual-projection-band { fill: ${SOLLA_PALETTE.barStrong}; fill-opacity: 0.16; }
.dual-grid-line { stroke: ${SOLLA_PALETTE.barStrong}; stroke-opacity: 0.32; stroke-width: 2; }
.dual-zero-line { stroke: ${SOLLA_PALETTE.barStrong}; stroke-width: 2; }
.dual-axis-label { fill: ${SOLLA_PALETTE.axis}; font-weight: 650; }
.dual-projection-label { fill: ${SOLLA_PALETTE.axis}; font-weight: 700; }
.dual-end-name { fill: ${SOLLA_PALETTE.ink}; font-weight: 700; }
.dual-end-value { fill: ${SOLLA_PALETTE.ink}; font-weight: 850; font-variant-numeric: tabular-nums; }
.dual-end-valence { font-weight: 850; }
.dual-end-change { fill: ${SOLLA_PALETTE.label}; font-weight: 700; }
.dual-crossing-guide { stroke: ${SOLLA_PALETTE.highlight}; stroke-width: 2; stroke-dasharray: 8 8; opacity: 0.45; }
.dual-crossing-ring { fill: ${SOLLA_PALETTE.paper}; stroke: ${SOLLA_PALETTE.highlight}; stroke-width: 4; }
.dual-crossing-box { fill: ${SOLLA_PALETTE.paper}; stroke: ${SOLLA_PALETTE.barStrong}; stroke-width: 2; }
.dual-crossing-year { fill: ${SOLLA_PALETTE.highlight}; font-weight: 850; }
.dual-crossing-copy { fill: ${SOLLA_PALETTE.ink}; font-weight: 750; }
.triple-line-plot { flex: none; }
.triple-line-plot svg { display: block; width: 880px; height: auto; }
.triple-grid-line { stroke: ${SOLLA_PALETTE.barStrong}; stroke-opacity: 0.32; stroke-width: 2; }
.triple-zero-line { stroke: ${SOLLA_PALETTE.barStrong}; stroke-width: 2; }
.triple-axis-label { fill: ${SOLLA_PALETTE.axis}; font-weight: 650; }
.triple-end-name { fill: ${SOLLA_PALETTE.ink}; font-weight: 700; }
.triple-end-metric { fill: ${SOLLA_PALETTE.ink}; font-weight: 850; font-variant-numeric: tabular-nums; }
.triple-end-valence { font-weight: 850; }
.triple-end-leader { fill: none; stroke-width: 3; stroke-linecap: square; stroke-linejoin: round; }
.triple-projection-band { fill: ${SOLLA_PALETTE.barStrong}; fill-opacity: 0.16; }
.triple-projection-label { fill: ${SOLLA_PALETTE.axis}; font-weight: 700; }
.triple-series-projection { stroke-dasharray: 18 12; }
.triple-marker-projected { fill: ${SOLLA_PALETTE.paper}; stroke-width: 5; stroke-linejoin: round; }
.triple-projected .triple-end-metric { font-size: 30px; }
.triple-projected .source { max-width: 620px; }
.anchor { padding-top: 20px; }
.anchor-number { color: ${SOLLA_PALETTE.highlight}; font-size: 300px; line-height: 0.86; letter-spacing: -0.065em; font-weight: 900; font-variant-numeric: tabular-nums; }
.anchor-copy { max-width: 760px; margin: 40px 0 0; font-size: 52px; line-height: 1.12; font-weight: 750; }
.footer {
  margin-top: auto; padding-top: 25px; border-top: 2px solid ${SOLLA_PALETTE.hairline};
  display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 30px;
  min-height: 171px;
}
.source { margin: 0; color: ${SOLLA_PALETTE.label}; font-size: 27px; line-height: 1.32; }
.source strong { color: ${SOLLA_PALETTE.ink}; font-weight: 750; }
.brand-logo-frame { width: 251px; height: 144px; flex: 0 0 251px; }
.brand-logo-frame img {
  display: block; width: 100%; height: 100%; object-fit: contain;
}`

/** Per-size vertical rhythm of the template (feed 4:5, square, stories 9:16). */
const layoutFor = (size) => {
  if (size === 'story') {
    const { safeTop, safeBottom } = SIZES.story
    return {
      // The content clears the Stories safe bands, plus the template's margin.
      padding: `${safeTop + 56}px 84px ${safeBottom + 60}px`,
      ruleGap: 34,
      gapAfterContext: 18,
      headline: 78,
      subtitle: 32,
      plotGap: 78,
    }
  }
  if (size === 'square') {
    return {
      padding: '64px 84px 56px',
      ruleGap: 28,
      gapAfterContext: 16,
      headline: 62,
      subtitle: 30,
      plotGap: 44,
    }
  }
  return {
    padding: '76px 84px 58px',
    ruleGap: 34,
    gapAfterContext: 18,
    headline: 67,
    subtitle: 31,
    plotGap: 54,
  }
}

/**
 * Full HTML document of the chart, at the exact export size. `spec` must have
 * passed `validateSpec` (the entry does it before rendering). `brandLogo` is
 * the official kit mark as a `data:image/png;base64,` URI (read by the entry
 * with `readKitAssets`); the render fails closed without it — the typographic
 * lockup is never recreated.
 */
export const renderChartHtml = (spec, { brandLogo: brandLogoDataUri } = {}) => {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(brandLogoDataUri ?? '')) {
    throw new Error(
      'marca oficial ausente: passe brandLogo como data:image/png;base64,… do ativo oficial do kit.',
    )
  }
  const sizeKey = SIZES[spec.size] ? spec.size : 'feed'
  const canvas = SIZES[sizeKey]
  const layout = layoutFor(sizeKey)
  const seriesCount = Array.isArray(spec.series) ? spec.series.length : 0
  const dual = seriesCount === 2
  const triple = seriesCount === 3
  const tripleProjected = triple && Boolean(spec.projectedLabel)
  const dualPositive = Boolean(spec.dualPositive)
  const dualPositiveStyles =
    !dualPositive || sizeKey !== 'feed'
      ? ''
      : '.headline { font-size: 60px; max-width: 900px; } .subtitle { margin-top: 18px; font-size: 28px; }'
  const dualStyles =
    !dual && !triple
      ? ''
      : triple
        ? '.headline { font-size: 56px; max-width: 900px; } .subtitle { margin-top: 18px; font-size: 27px; } .source { max-width: 570px; font-size: 25px; } .plot { margin-top: 16px; }'
        : sizeKey === 'feed'
          ? '.headline { font-size: 60px; max-width: 900px; } .subtitle { font-size: 28px; } .source { font-size: 25px; } .plot { margin-top: 28px; }'
          : sizeKey === 'square'
            ? '.inner { padding: 56px 84px 48px; } .headline { font-size: 54px; } .plot { margin-top: 20px; }'
            : '.headline { font-size: 64px; } .plot { margin-top: 28px; }'
  const footerStyles =
    sizeKey === 'square'
      ? '.footer { min-height: 128px; padding-top: 16px; } .source { font-size: 25px; } .brand-logo-frame { width: 192px; height: 110px; flex-basis: 192px; }'
      : sizeKey === 'story'
        ? '.footer { min-height: 190px; padding-top: 28px; gap: 28px; } .brand-logo-frame { width: 279px; height: 160px; flex-basis: 279px; }'
        : ''
  const paired = spec.chartType === 'delta' && Boolean(spec.pairedColumns)
  const delta = spec.chartType === 'delta' && !paired
  // C238: motion is the paired-columns prototype; the schedule lives in
  // chartMotion.mjs and reaches each element as inline --md/--mud vars.
  const motion = spec.motion === true
  const deltaStyles = !delta
    ? ''
    : sizeKey === 'feed'
      ? '.plot { margin-top: 0; } .headline { font-size: 60px; max-width: 900px; } .subtitle { margin-top: 18px; font-size: 28px; } .delta-grade { margin-top: 30px; }'
      : sizeKey === 'square'
        ? '.inner { padding: 56px 84px 48px; } .plot { margin-top: 0; } .headline { font-size: 54px; } .subtitle { font-size: 28px; } .delta-grade { margin-top: 24px; --delta-bar-h: 42px; --delta-gap: 12px; --delta-v1-w: 84px; --delta-v2-w: 104px; } .delta-value { font-size: 30px; }'
        : '.plot { margin-top: 0; } .headline { font-size: 64px; } .delta-grade { margin-top: 40px; --delta-gap: 22px; --delta-bar-h: 52px; }'
  const pairedStyles = !paired
    ? ''
    : sizeKey === 'feed'
      ? '.plot { margin-top: 26px; } .headline { font-size: 60px; max-width: 900px; } .subtitle { margin-top: 18px; font-size: 28px; }'
      : sizeKey === 'square'
        ? '.inner { padding: 56px 84px 48px; } .plot { margin-top: 20px; } .headline { font-size: 54px; } .subtitle { font-size: 28px; } .paired-legend { font-size: 26px; } .paired-value { font-size: 30px; } .paired-label { bottom: -36px; }'
        : '.plot { margin-top: 40px; } .headline { font-size: 60px; } .subtitle { font-size: 30px; }'
  const kicker =
    spec.kicker ??
    (dual || triple ? SERIES_RELATION_LABEL : (RELATION_LABEL[spec.chartType] ?? 'Gráfico'))
  const anchorUsesSubtitle = spec.chartType === 'anchor' && !spec.rows[0]?.label
  const showSubtitle = Boolean(spec.subtitle) && !anchorUsesSubtitle
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <style>${CSS}</style>
    ${motion ? `<style>${MOTION_CSS}</style>` : ''}
    <style>
      .canvas { width: ${canvas.width}px; height: ${canvas.height}px; }
      .inner { padding: ${layout.padding}; }
      .top-rule { margin-bottom: ${layout.ruleGap}px; }
      .context { margin-bottom: ${layout.gapAfterContext}px; }
      .headline { font-size: ${layout.headline}px; max-width: ${canvas.width - 200}px; }
      .subtitle { margin-top: ${Math.round(layout.gapAfterContext * 1.28)}px; font-size: ${layout.subtitle}px; max-width: ${canvas.width - 260}px; }
      .plot { margin-top: ${layout.plotGap}px; }
      ${footerStyles}
      ${dualStyles}
      ${deltaStyles}
      ${pairedStyles}
      ${dualPositiveStyles}
    </style>
  </head>
  <body>
    <article class="canvas${dual ? ' dual-series' : ''}${triple ? ' triple-series' : ''}${tripleProjected ? ' triple-projected' : ''}${motion ? ' motion' : ''}" role="img" aria-label="${htmlEscape(spec.headline)}">
      <div class="inner">
        <div class="top-rule${motionClass(motion, MOTION_STAGES.topRule)}"${styleAttr(motionVars(motion, MOTION_STAGES.topRule))}></div>
        <p class="context${motionClass(motion, MOTION_STAGES.kicker)}"${styleAttr(motionVars(motion, MOTION_STAGES.kicker))}>${htmlEscape(kicker)}</p>
        <h1 class="headline${motionClass(motion, MOTION_STAGES.headline)}"${styleAttr(motionVars(motion, MOTION_STAGES.headline))}>${htmlEscape(spec.headline)}</h1>
        ${showSubtitle ? `<p class="subtitle${motionClass(motion, MOTION_STAGES.subtitle)}"${styleAttr(motionVars(motion, MOTION_STAGES.subtitle))}>${htmlEscape(spec.subtitle)}</p>` : ''}
        <div class="plot${dualPositive ? ' dual-positive-plot' : ''}">${plotBody(spec)}</div>
        ${footer(spec, brandLogoDataUri, motion)}
      </div>
    </article>
  </body>
</html>`
}
