import { describe, expect, it } from 'vitest'

import {
  A4_HEIGHT_PX,
  A4_PAGE_BUDGET_PX,
  A4_WIDTH_PX,
  assertPageFits,
  PAGE_FIT_TOLERANCE_PX,
} from '../../scripts/lib/buildPdf.mjs'

// C187 extracted the A4 print plumbing so the institution builder (third
// consumer) shares one owner with the C186 dossiê. Pins the mm→px budget and
// the overflow guard that turns a cut page into a hard failure.

describe('A4 print budget', () => {
  it('derives height/width from 297×210mm at 96dpi with rounding slack', () => {
    expect(A4_HEIGHT_PX).toBe(Math.round(297 * (96 / 25.4)))
    expect(A4_WIDTH_PX).toBe(Math.round(210 * (96 / 25.4)))
    expect(A4_PAGE_BUDGET_PX).toBe(A4_HEIGHT_PX + PAGE_FIT_TOLERANCE_PX)
  })
})

describe('assertPageFits', () => {
  it('passes when no page overflows', () => {
    expect(() => assertPageFits([], 'O dossiê', 'hint')).not.toThrow()
  })

  it('throws listing the overflowing page and its height', () => {
    expect(() =>
      assertPageFits(
        [{ page: 'resumo', height: A4_PAGE_BUDGET_PX + 50 }],
        'O dossiê',
        'corte copy',
      ),
    ).toThrow(/resumo: \d+px.*corte copy/s)
  })
})

import { emitHtmlPairPdf } from '../../scripts/lib/buildPdf.mjs'

describe('emitHtmlPairPdf', () => {
  it('is exported as the single owner of the two-document emit contract', () => {
    expect(typeof emitHtmlPairPdf).toBe('function')
  })
})
