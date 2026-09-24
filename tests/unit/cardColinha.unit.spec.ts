// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  COLINHA_DIGIT_FONT_FAMILY,
  COLINHA_ESTADUAL_LABEL,
  COLINHA_FONT_FAMILY,
  COLINHA_ROW_LAYOUT,
  fitColinhaRowName,
} from '@/lib/cardColinha'
import { stateDeputyCatalog } from '@/lib/stateDeputyCatalog'

const publicFile = (src: string) => fileURLToPath(new URL(`../../public${src}`, import.meta.url))

const APPROVED_TILE_SRC = fileURLToPath(
  new URL('../../docs/plans/cards-colinha-ui-design-assets/modelo-colinha.jpeg', import.meta.url),
)

/** Frozen identity of the approved model art (byte-for-byte copy of the tile). */
const TILE_SHA256 = '76505492fb243c67313d237e58926afbd4d0847c00ab3bb43c090859cbdf18c8'

describe('colinha estadual row layout (S34 — measured from the design gate)', () => {
  it('resolves the gate percentages against the 1080×1920 output (the 1.2× of the art)', () => {
    const { mask, copy, office, name, gap, digit } = COLINHA_ROW_LAYOUT

    expect(mask.fill).toBe('#ffffff')
    expect(mask.x).toBeCloseTo(0.245 * 1080, 5)
    expect(mask.y).toBeCloseTo(0.559 * 1920, 5)
    expect(mask.width).toBeCloseTo(0.574 * 1080, 5)
    expect(mask.height).toBeCloseTo(0.029 * 1920, 5)

    expect(copy.left).toBeCloseTo(0.269 * 1080, 5)
    expect(copy.top).toBeCloseTo(0.5646 * 1920, 2)
    expect(copy.width).toBeCloseTo(0.528 * 1080, 5)
    expect(copy.right).toBeCloseTo(copy.left + copy.width, 5)

    // The label is sized to the art's printed cap height (19.2px), not to the
    // design gate's 2.15cqw — designer critique (c) adjustment.
    expect(office.fontSize).toBeCloseTo(26.9, 5)
    expect(name.fontSize).toBeCloseTo(0.034 * 1080, 5)
    expect(gap).toBeCloseTo(0.015 * 1080, 5)

    expect(digit.left).toBeCloseTo(0.259 * 1080, 5)
    expect(digit.step).toBeCloseTo(0.069 * 1080, 5)
    expect(digit.width).toBeCloseTo(0.061 * 1080, 5)
    expect(digit.height).toBeCloseTo(0.0435 * 1920, 5)
    expect(digit.top).toBeCloseTo(0.584 * 1920, 5)
    expect(digit.fontSize).toBeCloseTo(0.0425 * 1080, 5)
  })

  it('pins the mask, the copy band and the row typography of the gate', () => {
    expect(COLINHA_ROW_LAYOUT.mask).toEqual({
      x: 264.6,
      y: 1073.28,
      width: 619.92,
      height: 55.68,
      fill: '#ffffff',
    })
    expect(COLINHA_ROW_LAYOUT.copy).toEqual({
      left: 290.52,
      top: 1084.03,
      width: 570.24,
      right: 860.76,
    })
    expect(COLINHA_ROW_LAYOUT.office).toEqual({
      fontSize: 26.9,
      weight: 400,
      color: '#202020',
    })
    expect(COLINHA_ROW_LAYOUT.name).toEqual({
      fontSize: 36.72,
      weight: 900,
      color: '#e4102f',
      letterSpacingEm: -0.04,
    })
    expect(COLINHA_ROW_LAYOUT.digit).toEqual({
      left: 279.72,
      step: 74.52,
      width: 65.88,
      height: 83.52,
      top: 1121.28,
      fontSize: 45.9,
      weight: 900,
      color: '#171717',
    })
  })

  it('keeps the label literal and the gate font stacks (NEEDS ASSET proof on the PR)', () => {
    expect(COLINHA_ESTADUAL_LABEL).toBe('DEPUTADO ESTADUAL')
    expect(COLINHA_FONT_FAMILY).toBe('Arial, Helvetica, sans-serif')
    expect(COLINHA_DIGIT_FONT_FAMILY).toBe('Arial Black, Arial, Helvetica, sans-serif')
  })
})

describe('fitColinhaRowName (S34)', () => {
  // Same conservative face as the render unit fake: 0.84em per char, above the
  // real Arial/Arial Black uppercase average.
  const measure = (text: string, fontSize: number) => ({ width: text.length * fontSize * 0.84 })
  const officeWidth = measure(COLINHA_ESTADUAL_LABEL, COLINHA_ROW_LAYOUT.office.fontSize).width
  const pairMaxWidth = COLINHA_ROW_LAYOUT.copy.right - COLINHA_ROW_LAYOUT.mask.x
  const nameMaxWidth = pairMaxWidth - officeWidth - COLINHA_ROW_LAYOUT.gap

  it('keeps the ideal size on one line while the name fits the mask band', () => {
    expect(fitColinhaRowName('JACÓ', measure, nameMaxWidth)).toEqual({
      fontSize: COLINHA_ROW_LAYOUT.name.fontSize,
      text: 'JACÓ',
    })
  })

  it('shrinks the canonical name on one line instead of wrapping or cutting it', () => {
    const fit = fitColinhaRowName('JULIO PINHEIRO', measure, nameMaxWidth)

    expect(fit.fontSize).toBeLessThan(COLINHA_ROW_LAYOUT.name.fontSize)
    expect(fit.text).toBe('JULIO PINHEIRO')
    expect(measure(fit.text, fit.fontSize).width).toBeLessThanOrEqual(nameMaxWidth)
  })

  it('shrinks a long name on one line instead of wrapping or cutting it', () => {
    const fit = fitColinhaRowName('ARTUR BARACHISIO LISBÔA', measure, nameMaxWidth)

    expect(fit.fontSize).toBeLessThan(COLINHA_ROW_LAYOUT.name.fontSize)
    expect(fit.text).toBe('ARTUR BARACHISIO LISBÔA')
    expect(measure(fit.text, fit.fontSize).width).toBeLessThanOrEqual(nameMaxWidth)
  })

  it('keeps the right-aligned pair (label + gap + name) inside the mask for the whole catalog', () => {
    for (const deputy of stateDeputyCatalog) {
      const fit = fitColinhaRowName(deputy.name.toLocaleUpperCase('pt-BR'), measure, nameMaxWidth)
      const pairWidth = officeWidth + COLINHA_ROW_LAYOUT.gap + measure(fit.text, fit.fontSize).width

      expect(fit.fontSize).toBeGreaterThan(0)
      expect(fit.fontSize).toBeLessThanOrEqual(COLINHA_ROW_LAYOUT.name.fontSize)
      expect(pairWidth).toBeLessThanOrEqual(pairMaxWidth)
      // The pair starts at or after the mask's left edge.
      expect(COLINHA_ROW_LAYOUT.copy.right - pairWidth).toBeGreaterThanOrEqual(
        COLINHA_ROW_LAYOUT.mask.x,
      )
    }
  })
})

describe('colinha tile asset (S34)', () => {
  it('ships the exact approved model art (byte-for-byte, 900×1600)', async () => {
    const shipped = readFileSync(publicFile('/cards/modelo-colinha.jpeg'))
    const approved = readFileSync(APPROVED_TILE_SRC)

    expect(createHash('sha256').update(shipped).digest('hex')).toBe(TILE_SHA256)
    expect(createHash('sha256').update(shipped).digest('hex')).toBe(
      createHash('sha256').update(approved).digest('hex'),
    )

    const metadata = await sharp(publicFile('/cards/modelo-colinha.jpeg')).metadata()
    expect(`${metadata.width}x${metadata.height}`).toBe('900x1600')
  })
})
