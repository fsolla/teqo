/**
 * S13 — pure fit math for the name card. The visitor's name must never be cut
 * silently: it starts at the master's cap height (106px), shrinks and — when a
 * single line would drop below the readable minimum — wraps into two lines
 * before shrinking further. Past `minCapHeight` the fit fails and the composer
 * asks for a shorter name.
 *
 * Text measurement is injected (`CardMeasureText`) so the module stays free of
 * DOM and unit-testable with a deterministic fake.
 */

import { NAME_CARD_SLOT, type CardNameBlockSlot, type CardNameSlot } from './cardModels'

export type CardTextMetrics = {
  width: number
  actualBoundingBoxAscent: number
  actualBoundingBoxDescent: number
}

export type CardMeasureText = (text: string, fontSize: number) => CardTextMetrics

export type CardNameFit =
  | {
      ok: true
      lines: string[]
      fontSize: number
      lineHeight: number
      capHeight: number
    }
  | { ok: false; reason: 'empty' | 'too-long' }

const CAP_PROBE = 'X'
const LINE_HEIGHT_RATIO = 1.25
const MEASURE_PROBE_SIZE = 100

export const normalizeCardName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')

export const resolveFontSizeForCapHeight = (
  measure: CardMeasureText,
  capHeight: number,
): number => {
  const probe = measure(CAP_PROBE, MEASURE_PROBE_SIZE)
  if (probe.actualBoundingBoxAscent <= 0) return capHeight

  return (capHeight / probe.actualBoundingBoxAscent) * MEASURE_PROBE_SIZE
}

const widthAt = (measure: CardMeasureText, text: string, fontSize: number): number =>
  Math.max(0, measure(text, fontSize).width)

const capAt = (measure: CardMeasureText, fontSize: number): number =>
  Math.max(0, measure(CAP_PROBE, fontSize).actualBoundingBoxAscent)

const fitSingleLine = (
  text: string,
  measure: CardMeasureText,
  slot: CardNameSlot,
): number | null => {
  const idealSize = resolveFontSizeForCapHeight(measure, slot.capHeight)
  const idealWidth = widthAt(measure, text, idealSize)
  if (idealWidth <= slot.maxInkWidth) return idealSize

  const shrunk = Math.floor((idealSize * slot.maxInkWidth) / idealWidth)
  if (shrunk <= 0) return null
  if (widthAt(measure, text, shrunk) > slot.maxInkWidth) return null

  return shrunk
}

const fitTwoLines = (
  words: string[],
  measure: CardMeasureText,
  slot: CardNameBlockSlot,
): { fontSize: number; lines: [string, string] } | null => {
  const idealSize = resolveFontSizeForCapHeight(measure, slot.capHeight)
  const maxBlockHeight = slot.maxBlockBottom - slot.capTop
  let best: { fontSize: number; lines: [string, string] } | null = null

  for (let split = 1; split < words.length; split++) {
    const lines: [string, string] = [words.slice(0, split).join(' '), words.slice(split).join(' ')]
    const widest = Math.max(
      widthAt(measure, lines[0], idealSize),
      widthAt(measure, lines[1], idealSize),
    )
    if (widest <= 0) continue

    let size = Math.min(idealSize, (idealSize * slot.maxInkWidth) / widest)
    const capHeight = capAt(measure, size)
    const blockHeight = size * LINE_HEIGHT_RATIO + capHeight
    if (blockHeight > maxBlockHeight) {
      size *= maxBlockHeight / blockHeight
    }

    size = Math.floor(size)
    if (size <= 0) continue

    const lineWidths = [widthAt(measure, lines[0], size), widthAt(measure, lines[1], size)]
    const sizeCap = capAt(measure, size)
    const sizeBlock = size * LINE_HEIGHT_RATIO + sizeCap
    if (lineWidths.some((width) => width > slot.maxInkWidth)) continue
    if (sizeBlock > maxBlockHeight) continue
    if (best === null || size > best.fontSize) best = { fontSize: size, lines }
  }

  return best
}

/**
 * Fits `name` to the master slot honoring `maxLines`. The returned geometry is
 * what `renderNameCard` draws: `capHeight` is the measured cap at the chosen
 * size and `lineHeight` is the baseline-to-baseline distance.
 */
export const fitCardName = (
  name: string,
  measure: CardMeasureText,
  slot: CardNameSlot = NAME_CARD_SLOT,
): CardNameFit => {
  const normalized = normalizeCardName(name)
  if (!normalized) return { ok: false, reason: 'empty' }

  const minFontSize = resolveFontSizeForCapHeight(measure, slot.minCapHeight)
  const singleSize = fitSingleLine(normalized, measure, slot)
  if (singleSize !== null && singleSize >= minFontSize) {
    return {
      ok: true,
      lines: [normalized],
      fontSize: singleSize,
      lineHeight: singleSize * LINE_HEIGHT_RATIO,
      capHeight: capAt(measure, singleSize),
    }
  }

  const words = normalized.split(' ')
  if (slot.align === 'left' && slot.maxLines >= 2 && words.length > 1) {
    const twoLines = fitTwoLines(words, measure, slot)
    if (twoLines !== null && twoLines.fontSize >= minFontSize) {
      return {
        ok: true,
        lines: twoLines.lines,
        fontSize: twoLines.fontSize,
        lineHeight: twoLines.fontSize * LINE_HEIGHT_RATIO,
        capHeight: capAt(measure, twoLines.fontSize),
      }
    }
  }

  return { ok: false, reason: 'too-long' }
}
