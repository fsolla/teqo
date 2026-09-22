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

import { assertPageCount, emitHtmlSinglePdf } from '../../scripts/lib/buildPdf.mjs'

// C210: the briefing emits a single four-sheet document. The count guard is the
// hard cap (`.sheet{overflow:hidden}` would hide a cut sheet), so it is pinned
// as a pure function; the emitter itself is Chromium plumbing, like the pair.

describe('assertPageCount (C210 briefing cap)', () => {
  it('passes at or under the cap', () => {
    expect(() => assertPageCount(4, 4, 'O briefing', 'hint')).not.toThrow()
  })

  it('fails closed above the cap with the count and the hint', () => {
    expect(() => assertPageCount(5, 4, 'O briefing', 'encurte as listas')).toThrow(
      /O briefing tem 5 folhas \(> 4\).*encurte as listas/s,
    )
  })
})

describe('emitHtmlSinglePdf', () => {
  it('is exported as the additive single-document emit contract', () => {
    expect(typeof emitHtmlSinglePdf).toBe('function')
  })

  // The four-sheet cap is the product promise, so the emitter's fail-closed
  // paths are pinned with a fake page — no Chromium launch in the unit suite.
  type EmitScript = { anchors: string[][]; overflows: { page: string; height: number }[][] }

  const fakeEmitBrowser = (script: EmitScript) => {
    const calls: string[] = []
    const page = {
      setViewportSize: async () => calls.push('viewport'),
      setContent: async () => calls.push('content'),
      emulateMedia: async () => calls.push('emulate'),
      evaluate: async (fn: unknown) =>
        String(fn).includes('scrollHeight')
          ? (script.overflows.shift() ?? [])
          : (script.anchors.shift() ?? []),
      pdf: async () => calls.push('pdf'),
      close: async () => calls.push('close'),
    }
    return { browser: { newPage: async () => page }, calls }
  }

  const sheetAnchors = ['essencial', 'defesas', 'qa', 'evitar']

  it('fails closed when a required sheet anchor is missing', async () => {
    const { browser, calls } = fakeEmitBrowser({
      anchors: [['essencial', 'defesas', 'qa']],
      overflows: [],
    })
    await expect(
      emitHtmlSinglePdf(browser, {
        html: '<html></html>',
        pdf: '/tmp/never.pdf',
        requiredAnchors: sheetAnchors,
        label: 'O briefing',
      }),
    ).rejects.toThrow(/folha "evitar" ausente/)
    expect(calls).not.toContain('pdf')
    expect(calls.at(-1)).toBe('close')
  })

  it('fails closed above the page cap', async () => {
    const { browser, calls } = fakeEmitBrowser({
      anchors: [[...sheetAnchors, 'extra']],
      overflows: [],
    })
    await expect(
      emitHtmlSinglePdf(browser, {
        html: '<html></html>',
        pdf: '/tmp/never.pdf',
        maxPages: 4,
        label: 'O briefing',
      }),
    ).rejects.toThrow(/tem 5 folhas \(> 4\)/)
    expect(calls).not.toContain('pdf')
  })

  it('rebuilds through onOverflow until the sheet fits and then prints', async () => {
    const { browser, calls } = fakeEmitBrowser({
      anchors: [sheetAnchors, sheetAnchors],
      overflows: [[{ page: 'qa', height: A4_PAGE_BUDGET_PX + 100 }], []],
    })
    let rebuilds = 0
    await emitHtmlSinglePdf(browser, {
      html: '<html>v1</html>',
      pdf: '/tmp/out.pdf',
      maxPages: 4,
      requiredAnchors: sheetAnchors,
      label: 'O briefing',
      onOverflow: async () => {
        rebuilds += 1
        return '<html>v2</html>'
      },
    })
    expect(rebuilds).toBe(1)
    expect(calls.filter((call) => call === 'content')).toHaveLength(2)
    expect(calls).toContain('pdf')
    expect(calls.at(-1)).toBe('close')
  })

  it('fails closed on overflow when there is nothing left to shed', async () => {
    const { browser, calls } = fakeEmitBrowser({
      anchors: [sheetAnchors],
      overflows: [[{ page: 'qa', height: A4_PAGE_BUDGET_PX + 100 }]],
    })
    await expect(
      emitHtmlSinglePdf(browser, {
        html: '<html></html>',
        pdf: '/tmp/never.pdf',
        maxPages: 4,
        requiredAnchors: sheetAnchors,
        label: 'O briefing',
        onOverflow: async () => null,
      }),
    ).rejects.toThrow(/estourou o A4/)
    expect(calls).not.toContain('pdf')
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
