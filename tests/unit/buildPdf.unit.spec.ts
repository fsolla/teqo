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

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { screenshotHtmlPng } from '../../scripts/lib/buildPdf.mjs'

// C191: the PNG path is additive to the Chromium owner. The guard is on the
// critical path (a >8 MB export must fail closed), so it is pinned with a fake
// browser — no real Chromium launch in the unit suite.

const fakeBrowser = (calls: string[]) => ({
  newPage: async () => ({
    setViewportSize: async (size: { width: number; height: number }) =>
      calls.push(`viewport:${size.width}x${size.height}`),
    setContent: async () => calls.push('content'),
    evaluate: async () => calls.push('fonts'),
    screenshot: async (options: { clip: { width: number; height: number } }) =>
      calls.push(`shot:${options.clip.width}x${options.clip.height}`),
    close: async () => calls.push('close'),
  }),
})

describe('screenshotHtmlPng', () => {
  it('sets the exact viewport, clips the canvas and closes the page', async () => {
    const calls: string[] = []
    const outPath = join(await mkdtemp(join(tmpdir(), 'c191-')), 'out.png')
    await writeFile(outPath, 'x')
    const result = await screenshotHtmlPng(fakeBrowser(calls), {
      html: '<html></html>',
      width: 1080,
      height: 1350,
      outPath,
    })
    expect(result.size).toBe(1)
    expect(calls).toContain('viewport:1080x1350')
    expect(calls).toContain('shot:1080x1350')
    expect(calls.at(-1)).toBe('close')
  })

  it('fails closed when the PNG exceeds maxBytes', async () => {
    const outPath = join(await mkdtemp(join(tmpdir(), 'c191-')), 'big.png')
    await writeFile(outPath, 'x'.repeat(10))
    await expect(
      screenshotHtmlPng(fakeBrowser([]), {
        html: '',
        width: 1080,
        height: 1080,
        outPath,
        maxBytes: 4,
      }),
    ).rejects.toThrow(/> 4/)
  })
})
