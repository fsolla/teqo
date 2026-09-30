import { describe, expect, it } from 'vitest'

import {
  COLUMN_MOTION,
  columnMotion,
  MOTION_CSS,
  MOTION_DURATION_S,
  MOTION_EASING,
  MOTION_FPS,
  MOTION_FRAMES,
  MOTION_STAGES,
  motionEnd,
  motionFrameTimes,
  motionKindFor,
  motionStages,
  PAIR_MOTION,
  pairMotion,
  validateMotion,
} from '../../scripts/lib/chartMotion.mjs'

// C238/C239: the motion clock is data — the renderer serializes the schedule
// into inline vars and the capture seeks the animations to the grid, so the
// timing is pinned here instead of living inside the stylesheet.

const pairedSpec = (pairCount = 4) => ({
  chartType: 'delta',
  pairedColumns: true,
  startLabel: '2006',
  endLabel: '2026',
  rows: Array.from({ length: pairCount }, (_value, index) => ({
    label: `Tipo ${index}`,
    initial: 1,
    final: 2,
  })),
})

const columnSpec = (count = 2) => ({
  chartType: 'column',
  rows: Array.from({ length: count }, (_value, index) => ({
    label: String(2005 + index),
    value: 100 + index,
  })),
})

const anchorSpec = () => ({
  chartType: 'anchor',
  rows: [{ label: 'leitos privados contratados para o atendimento pelo SUS', value: 1130 }],
})

describe('chartMotion — the deterministic clock', () => {
  it('runs 6s at 30fps on an exact 180-frame grid', () => {
    expect(MOTION_FPS).toBe(30)
    expect(MOTION_DURATION_S).toBe(6)
    expect(MOTION_FRAMES).toBe(180)
    const times = motionFrameTimes()
    expect(times).toHaveLength(MOTION_FRAMES)
    expect(times[0]).toBe(0)
    expect(times[times.length - 1]).toBeCloseTo(((MOTION_FRAMES - 1) * 1000) / MOTION_FPS, 6)
  })

  it('staggers the pairs left to right and lands the values after the bars', () => {
    const first = pairMotion(0)
    const second = pairMotion(1)
    expect(first.bar.delay).toBe(PAIR_MOTION.firstAt)
    expect(second.bar.delay - first.bar.delay).toBeCloseTo(PAIR_MOTION.stagger, 6)
    expect(first.label.delay).toBeCloseTo(first.bar.delay + PAIR_MOTION.labelOffset, 6)
    expect(first.value.delay).toBeCloseTo(first.bar.delay + PAIR_MOTION.valueOffset, 6)
    expect(first.value.delay).toBeGreaterThan(first.bar.delay + first.bar.duration)
  })

  it('grows the two-period columns left to right, values after the bars', () => {
    const first = columnMotion(0)
    const second = columnMotion(1)
    expect(first.bar.delay).toBe(COLUMN_MOTION.firstAt)
    expect(second.bar.delay - first.bar.delay).toBeCloseTo(COLUMN_MOTION.stagger, 6)
    expect(second.label.delay).toBeCloseTo(second.bar.delay + COLUMN_MOTION.labelOffset, 6)
    expect(second.value.delay).toBeGreaterThan(second.bar.delay + second.bar.duration)
  })

  it('maps each motion shape to its variant and refuses the undesigned ones', () => {
    expect(motionKindFor(pairedSpec())).toBe('paired')
    expect(motionKindFor(columnSpec())).toBe('column')
    expect(motionKindFor(anchorSpec())).toBe('anchor')
    expect(motionKindFor({ chartType: 'bar', rows: [] })).toBeNull()
    expect(motionKindFor({ chartType: 'line', rows: [] })).toBeNull()
  })

  it('settles every stage inside the duration, leaving a static tail to cut into', () => {
    const { end, kind } = validateMotion(pairedSpec())
    expect(kind).toBe('paired')
    expect(end).toBeLessThanOrEqual(MOTION_DURATION_S)
    expect(MOTION_DURATION_S - end).toBeGreaterThanOrEqual(2)
    expect(validateMotion(columnSpec())).toMatchObject({ kind: 'column' })
    expect(validateMotion(anchorSpec())).toMatchObject({ kind: 'anchor' })
  })

  it('lists the stages of each shape for the clock guard', () => {
    // Shell (rule, kicker, headline, subtitle, footer) + the marks.
    expect(motionStages(columnSpec())).toHaveLength(5 + 2 * 3)
    expect(motionStages(pairedSpec())).toHaveLength(5 + 1 + 4 * 3) // + legend
    expect(motionStages(anchorSpec())).toHaveLength(5 + 2) // + number + copy
    expect(motionEnd(motionStages(anchorSpec()))).toBeGreaterThan(0)
  })

  it('fails closed when the shape is undesigned, the column is not a pair or the clock overflows', () => {
    expect(() => validateMotion({ chartType: 'bar', rows: [{ label: 'x', value: 1 }] })).toThrow(
      /indisponível/,
    )
    expect(() => validateMotion(columnSpec(3))).toThrow(/2 períodos/)
    expect(() => validateMotion(pairedSpec(20))).toThrow(/reduza os pontos/)
  })

  it('gives the anchor the hero number and the copy, never a counting rule', () => {
    expect(MOTION_STAGES.number.kind).toBe('rise')
    expect(MOTION_STAGES.copy.kind).toBe('fade')
    expect(MOTION_STAGES.copy.delay).toBeGreaterThan(MOTION_STAGES.number.delay)
  })

  it('carries only keyframes and easing; timings travel as inline vars', () => {
    for (const kind of ['sweep', 'rise', 'fade', 'grow']) {
      expect(MOTION_CSS).toContain(`@keyframes motion-${kind}`)
      expect(MOTION_CSS).toContain(`.motion .motion-${kind}`)
    }
    expect(MOTION_CSS).toContain(MOTION_EASING)
    expect(MOTION_CSS).toContain('var(--md, 0s)')
    expect(MOTION_CSS).toContain('var(--mud, 0.5s)')
    expect(MOTION_CSS).toContain('animation-fill-mode: backwards')
  })

  it('uses the same motion vocabulary in the shell and the pairs', () => {
    const kinds = new Set([
      ...Object.values(MOTION_STAGES).map((stage) => stage.kind),
      ...Object.values(pairMotion(3)).map((stage) => stage.kind),
      ...Object.values(columnMotion(1)).map((stage) => stage.kind),
    ])
    for (const kind of kinds) expect(['sweep', 'rise', 'fade', 'grow']).toContain(kind)
  })
})
