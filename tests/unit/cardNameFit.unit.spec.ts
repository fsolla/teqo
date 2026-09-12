import { describe, expect, it } from 'vitest'

import { NAME_CARD_SLOT } from '@/lib/cardModels'
import {
  fitCardName,
  normalizeCardName,
  resolveFontSizeForCapHeight,
  type CardMeasureText,
} from '@/lib/cardNameFit'

/** Deterministic fake: 0.6em per char, 0.72em cap, 0.2em descent. */
const measure: CardMeasureText = (text, fontSize) => ({
  width: text.length * fontSize * 0.6,
  actualBoundingBoxAscent: fontSize * 0.72,
  actualBoundingBoxDescent: fontSize * 0.2,
})

const inkWidth = (text: string, fontSize: number) => measure(text, fontSize).width
const minFontSize = resolveFontSizeForCapHeight(measure, NAME_CARD_SLOT.minCapHeight)

describe('normalizeCardName', () => {
  it('trims, collapses spaces and uppercases with the pt-BR locale', () => {
    expect(normalizeCardName('  joão   conceição ')).toBe('JOÃO CONCEIÇÃO')
  })
})

describe('resolveFontSizeForCapHeight', () => {
  it('calibrates the font size from the measured cap, not the raw cap value', () => {
    expect(resolveFontSizeForCapHeight(measure, 106)).toBeCloseTo(106 / 0.72, 5)
  })

  it('falls back to the cap value when the probe has no ascent', () => {
    const broken: CardMeasureText = () => ({
      width: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
    })
    expect(resolveFontSizeForCapHeight(broken, 106)).toBe(106)
  })
})

describe('fitCardName', () => {
  it('keeps the master cap height for a short name', () => {
    const fit = fitCardName('João', measure)

    expect(fit).toMatchObject({ ok: true, lines: ['JOÃO'] })
    if (fit.ok) {
      expect(fit.capHeight).toBeCloseTo(NAME_CARD_SLOT.capHeight, 5)
      expect(inkWidth(fit.lines[0], fit.fontSize)).toBeLessThanOrEqual(NAME_CARD_SLOT.maxInkWidth)
    }
  })

  it('shrinks a long single line to the ink width instead of cutting it', () => {
    const fit = fitCardName('Conceição', measure)

    expect(fit).toMatchObject({ ok: true, lines: ['CONCEIÇÃO'] })
    if (fit.ok) {
      expect(fit.fontSize).toBeLessThan(resolveFontSizeForCapHeight(measure, 106))
      expect(inkWidth(fit.lines[0], fit.fontSize)).toBeLessThanOrEqual(NAME_CARD_SLOT.maxInkWidth)
      expect(fit.fontSize).toBeGreaterThanOrEqual(minFontSize)
    }
  })

  it('wraps into two balanced lines when single-line would fall under the minimum', () => {
    const fit = fitCardName('Jorge Solla da Bahia', measure)

    expect(fit.ok).toBe(true)
    if (fit.ok) {
      expect(fit.lines).toEqual(['JORGE SOLLA', 'DA BAHIA'])
      expect(fit.fontSize).toBeGreaterThanOrEqual(minFontSize)
      for (const line of fit.lines) {
        expect(inkWidth(line, fit.fontSize)).toBeLessThanOrEqual(NAME_CARD_SLOT.maxInkWidth)
      }
      const blockHeight = fit.lineHeight + fit.capHeight
      expect(blockHeight).toBeLessThanOrEqual(NAME_CARD_SLOT.maxBlockBottom - NAME_CARD_SLOT.capTop)
    }
  })

  it('does not split a single word in the middle', () => {
    const fit = fitCardName('Bartolomeucostajunior', measure)

    expect(fit).toEqual({ ok: false, reason: 'too-long' })
  })

  it('fails closed for an empty name', () => {
    expect(fitCardName('   ', measure)).toEqual({ ok: false, reason: 'empty' })
  })

  it('preserves Portuguese accents in the fitted lines', () => {
    const fit = fitCardName('Coração', measure)

    expect(fit.ok).toBe(true)
    if (fit.ok) expect(fit.lines[0]).toBe('CORAÇÃO')
  })
})
