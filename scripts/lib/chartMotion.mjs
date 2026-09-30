/**
 * Chart motion (C238/C239): the deterministic timeline that animates the
 * pieces without touching the approved static design. The schedule is data,
 * not CSS — the renderer serializes each stage into `--md` (delay) and `--mud`
 * (duration) custom properties on the element and the stylesheet carries only
 * the keyframes and the easing, so the clock is pinned here and tested
 * directly.
 *
 * Variants: the paired columns (C238 prototype) and, in the C239 extension,
 * the two-period column and the anchor number. The capture never records in
 * real time: every CSS animation is seeked to the frame time (30fps grid, 6s),
 * screenshotted, and the MP4 is encoded offline from those exact timestamps
 * (see `chartMotionRender.mjs`).
 */

export const MOTION_FPS = 30
export const MOTION_DURATION_S = 6
export const MOTION_FRAMES = MOTION_DURATION_S * MOTION_FPS
export const MOTION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Shell stages (seconds). The card is already composed for reading: the rule,
 * kicker, headline and subtitle enter first, then the data marks grow, and the
 * footer (source + brand) lands last — right before the static hold. `legend`
 * belongs to the paired variant; `number`/`copy` belong to the anchor.
 */
export const MOTION_STAGES = {
  topRule: { kind: 'sweep', delay: 0, duration: 0.45 },
  kicker: { kind: 'rise', delay: 0.2, duration: 0.45 },
  headline: { kind: 'rise', delay: 0.35, duration: 0.55 },
  subtitle: { kind: 'rise', delay: 0.65, duration: 0.45 },
  legend: { kind: 'fade', delay: 0.8, duration: 0.4 },
  number: { kind: 'rise', delay: 1.05, duration: 0.6 },
  copy: { kind: 'fade', delay: 1.7, duration: 0.45 },
  footer: { kind: 'fade', delay: 3.1, duration: 0.5 },
}

/**
 * Per-mark stages of the bar variants: the mark grows, the label enters with
 * the growth and the value lands after the bar settles. The paired columns
 * stagger by pair (the two columns of a pair grow together); the two-period
 * column staggers per column, left to right (the recent red one last).
 */
export const PAIR_MOTION = {
  firstAt: 1.1,
  stagger: 0.3,
  barDuration: 0.75,
  labelOffset: 0.15,
  labelDuration: 0.3,
  valueOffset: 0.8,
  valueDuration: 0.3,
}

export const COLUMN_MOTION = {
  firstAt: 1.1,
  stagger: 0.35,
  barDuration: 0.75,
  labelOffset: 0.15,
  labelDuration: 0.3,
  valueOffset: 0.8,
  valueDuration: 0.3,
}

/** Milliseconds-rounded seconds: the inline CSS vars must read `1.4s`, not `1.4000000000000001s`. */
const round3 = (value) => Math.round(value * 1000) / 1000

const markMotion = (config, index) => {
  const barAt = round3(config.firstAt + index * config.stagger)
  return {
    bar: { kind: 'grow', delay: barAt, duration: config.barDuration },
    label: {
      kind: 'fade',
      delay: round3(barAt + config.labelOffset),
      duration: config.labelDuration,
    },
    value: {
      kind: 'rise',
      delay: round3(barAt + config.valueOffset),
      duration: config.valueDuration,
    },
  }
}

/** @param {number} index pair position, left to right (0-based) */
export const pairMotion = (index) => markMotion(PAIR_MOTION, index)

/** @param {number} index column position, left to right (0-based) */
export const columnMotion = (index) => markMotion(COLUMN_MOTION, index)

/**
 * Motion variant of a spec — `null` means the shape has no certified motion
 * yet (the builder refuses instead of animating something undesigned).
 */
export const motionKindFor = (spec) => {
  if (spec.pairedColumns) return 'paired'
  if (spec.chartType === 'anchor') return 'anchor'
  if (spec.chartType === 'column') return 'column'
  return null
}

const SHELL_STAGES = ['topRule', 'kicker', 'headline', 'subtitle', 'footer']

/** Every stage a spec animates — the clock guard reads this list. */
export const motionStages = (spec) => {
  const kind = motionKindFor(spec)
  const shell = SHELL_STAGES.map((name) => MOTION_STAGES[name])
  if (kind === 'anchor') return [...shell, MOTION_STAGES.number, MOTION_STAGES.copy]
  const rows = Array.isArray(spec.rows) ? spec.rows : []
  const marks = rows.flatMap((_row, index) =>
    Object.values(kind === 'column' ? columnMotion(index) : pairMotion(index)),
  )
  return kind === 'paired' ? [...shell, MOTION_STAGES.legend, ...marks] : [...shell, ...marks]
}

/** Last stage end (seconds) of a stage list. */
export const motionEnd = (stages) =>
  Math.max(...stages.map((stage) => stage.delay + stage.duration))

/**
 * Fail-closed: the shape must have a certified motion, the column motion is
 * certified for the two-period pair (C239) and the piece must be fully settled
 * inside the exported duration (the tail is a static hold the editor can cut
 * into).
 */
export const validateMotion = (spec) => {
  const kind = motionKindFor(spec)
  if (!kind) {
    throw new Error(
      'motion indisponível para esta variante: o protótipo cobre as colunas emparelhadas, a coluna de 2 períodos e o número-âncora.',
    )
  }
  if (kind === 'column' && (!Array.isArray(spec.rows) || spec.rows.length !== 2)) {
    throw new Error(
      `o motion da coluna está certificado para 2 períodos (${spec.rows?.length ?? 0} recebidos): o protótipo C239 cobre o par de períodos.`,
    )
  }
  const end = motionEnd(motionStages(spec))
  if (end > MOTION_DURATION_S) {
    throw new Error(
      `motion termina em ${end}s (> ${MOTION_DURATION_S}s): reduza os pontos antes de gerar.`,
    )
  }
  return { kind, end, duration: MOTION_DURATION_S }
}

/** Deterministic 30fps grid (ms): the capture seeks every animation to these. */
export const motionFrameTimes = () =>
  Array.from({ length: MOTION_FRAMES }, (_value, index) => (index * 1000) / MOTION_FPS)

/**
 * Keyframes and the generic animated classes. Timings never live here: each
 * element carries `--md`/`--mud` from the schedule above. `backwards` fill
 * means the from-state holds through the delay and the element ends on its
 * natural (static) styles — the last frame is exactly the approved PNG.
 */
export const MOTION_CSS = `@keyframes motion-sweep { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes motion-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes motion-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes motion-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.motion .motion-sweep,
.motion .motion-rise,
.motion .motion-fade,
.motion .motion-grow {
  animation-fill-mode: backwards;
  animation-timing-function: ${MOTION_EASING};
  animation-duration: var(--mud, 0.5s);
  animation-delay: var(--md, 0s);
}
.motion .motion-sweep { animation-name: motion-sweep; transform-origin: left center; }
.motion .motion-rise { animation-name: motion-rise; }
.motion .motion-fade { animation-name: motion-fade; }
.motion .motion-grow { animation-name: motion-grow; transform-origin: bottom center; }`
