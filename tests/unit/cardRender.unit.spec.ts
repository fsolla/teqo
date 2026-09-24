import { describe, expect, it } from 'vitest'

import {
  COLINHA_CONFIRM_LABEL,
  COLINHA_ESTADUAL_PLACEHOLDER,
  COLINHA_LAYOUT,
  COLINHA_LEGAL_TEXT,
} from '@/lib/cardColinha'
import {
  NAME_CARD_SLOT,
  TEAM_CARD_LABEL,
  TEAM_CARD_NAME_BANNER,
  TEAM_CARD_NAME_SLOT,
  getCardModel,
  type CardRect,
} from '@/lib/cardModels'
import { fitCardName } from '@/lib/cardNameFit'
import {
  centerCardPhotoTransform,
  frameCardPhotoOnBbox,
  type CardPhotoSize,
} from '@/lib/cardPhotoTransform'
import {
  CARD_VISITOR_SILHOUETTE_FILL,
  createCardMeasure,
  drawCardName,
  drawCardVisitorSilhouette,
  renderColinhaCard,
  renderNameCard,
  renderPhotoCard,
  renderTeamCard,
  resolveCardBannerWidth,
  type CardDrawContext,
} from '@/lib/cardRender'
import { getStateDeputyCard, type StateDeputyCatalogEntry } from '@/lib/stateDeputyCatalog'

type DrawCall = { image: unknown; dx: number; dy: number; dw: number; dh: number }
type TextCall = { text: string; x: number; y: number }
type RectCall = { x: number; y: number; width: number; height: number }
type OpCall = { op: string; args: number[] }

const fontSizeFrom = (font: string): number => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font)
  return match ? Number(match[1]) : 0
}

const createFakeContext = () => {
  const drawCalls: DrawCall[] = []
  const textCalls: TextCall[] = []
  const rectCalls: RectCall[] = []
  const ops: OpCall[] = []

  const ctx: CardDrawContext = {
    font: '',
    letterSpacing: '',
    globalAlpha: 1,
    fillStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    drawImage: (image, dx, dy, dw, dh) => {
      drawCalls.push({ image, dx, dy, dw, dh })
    },
    fillRect: (x, y, width, height) => {
      rectCalls.push({ x, y, width, height })
    },
    fillText: (text, x, y) => {
      textCalls.push({ text, x, y })
    },
    measureText: (text) => {
      const size = fontSizeFrom(ctx.font)
      return {
        width: text.length * size * 0.84,
        actualBoundingBoxAscent: size * 0.72,
        actualBoundingBoxDescent: size * 0.2,
      }
    },
    save: () => {
      ops.push({ op: 'save', args: [] })
    },
    restore: () => {
      ops.push({ op: 'restore', args: [] })
    },
    translate: (x, y) => {
      ops.push({ op: 'translate', args: [x, y] })
    },
    rotate: (angle) => {
      ops.push({ op: 'rotate', args: [angle] })
    },
    beginPath: () => {
      ops.push({ op: 'beginPath', args: [] })
    },
    arc: (x, y, radius, startAngle, endAngle) => {
      ops.push({ op: 'arc', args: [x, y, radius, startAngle, endAngle] })
    },
    ellipse: (x, y, radiusX, radiusY, rotation, startAngle, endAngle) => {
      ops.push({ op: 'ellipse', args: [x, y, radiusX, radiusY, rotation, startAngle, endAngle] })
    },
    rect: (x, y, width, height) => {
      ops.push({ op: 'rect', args: [x, y, width, height] })
    },
    roundRect: (x, y, width, height, radii) => {
      ops.push({
        op: 'roundRect',
        args: [x, y, width, height, typeof radii === 'number' ? radii : -1],
      })
    },
    clip: () => {
      ops.push({ op: 'clip', args: [] })
    },
    createLinearGradient: (x0, y0, x1, y1) => {
      ops.push({ op: 'createLinearGradient', args: [x0, y0, x1, y1] })
      return {
        addColorStop: (offset: number) => {
          ops.push({ op: 'addColorStop', args: [offset] })
        },
      }
    },
    fill: () => {
      ops.push({ op: 'fill', args: [] })
    },
  }

  return { ctx, drawCalls, textCalls, rectCalls, ops }
}

const nameModel = getCardModel('eu-sou-solla')!
const squareModel = getCardModel('perfil-quadrado')!
const teamModel = getCardModel('time-de-voce')!

describe('renderNameCard', () => {
  it('draws the master base first and then the name on the left border', () => {
    const { ctx, drawCalls, textCalls } = createFakeContext()
    const image = { id: 'base' } as unknown as CanvasImageSource
    const fit = renderNameCard(ctx, nameModel, {
      image,
      name: 'João',
      fontFamily: 'Brexter',
      measure: createCardMeasure(ctx, 'Brexter'),
    })

    expect(fit.ok).toBe(true)
    expect(drawCalls).toEqual([{ image, dx: 0, dy: 0, dw: 1080, dh: 1440 }])
    expect(textCalls).toHaveLength(1)
    expect(textCalls[0]!.text).toBe('JOÃO')
    expect(textCalls[0]!.x).toBe(NAME_CARD_SLOT.leftX)
    expect(textCalls[0]!.y).toBeCloseTo(NAME_CARD_SLOT.capTop + NAME_CARD_SLOT.capHeight, 5)
    expect(ctx.fillStyle).toBe(NAME_CARD_SLOT.fill)
    expect(ctx.textAlign).toBe('left')
  })

  it('wraps long names into two lines with baselines inside the free band', () => {
    const { ctx, textCalls } = createFakeContext()
    const fit = renderNameCard(ctx, nameModel, {
      image: { id: 'base' } as unknown as CanvasImageSource,
      name: 'Jorge Solla da Bahia',
      fontFamily: 'Brexter',
      measure: createCardMeasure(ctx, 'Brexter'),
    })

    expect(fit.ok).toBe(true)
    expect(textCalls.map((call) => call.text)).toEqual(['JORGE SOLLA', 'DA BAHIA'])
    expect(textCalls[0]!.y).toBeLessThan(textCalls[1]!.y)
    expect(textCalls[1]!.y).toBeLessThanOrEqual(NAME_CARD_SLOT.maxBlockBottom)
  })

  it('draws the base but no text when the name cannot fit (never cuts silently)', () => {
    const { ctx, drawCalls, textCalls } = createFakeContext()
    const fit = renderNameCard(ctx, nameModel, {
      image: { id: 'base' } as unknown as CanvasImageSource,
      name: 'Bartolomeucostajunior',
      fontFamily: 'Brexter',
      measure: createCardMeasure(ctx, 'Brexter'),
    })

    expect(fit).toEqual({ ok: false, reason: 'too-long' })
    expect(drawCalls).toHaveLength(1)
    expect(textCalls).toHaveLength(0)
  })
})

describe('drawCardName', () => {
  it('draws only the fitted name (no base) on the left border', () => {
    const { ctx, drawCalls, textCalls } = createFakeContext()
    const fit = fitCardName('João', createCardMeasure(ctx, 'Brexter'))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return

    drawCardName(ctx, { fit, fontFamily: 'Brexter' })

    expect(drawCalls).toHaveLength(0)
    expect(textCalls).toEqual([
      { text: 'JOÃO', x: NAME_CARD_SLOT.leftX, y: NAME_CARD_SLOT.capTop + fit.capHeight },
    ])
    expect(ctx.textAlign).toBe('left')
    expect(ctx.fillStyle).toBe(NAME_CARD_SLOT.fill)
  })

  it('left-aligns both wrapped lines inside the free band', () => {
    const { ctx, textCalls } = createFakeContext()
    const fit = fitCardName('Jorge Solla da Bahia', createCardMeasure(ctx, 'Brexter'))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return

    drawCardName(ctx, { fit, fontFamily: 'Brexter' })

    expect(textCalls.map((call) => call.text)).toEqual(['JORGE SOLLA', 'DA BAHIA'])
    expect(textCalls.every((call) => call.x === NAME_CARD_SLOT.leftX)).toBe(true)
    expect(textCalls[0]!.y).toBeLessThan(textCalls[1]!.y)
    expect(textCalls[1]!.y).toBeLessThanOrEqual(NAME_CARD_SLOT.maxBlockBottom)
  })
})

describe('renderTeamCard', () => {
  const window = teamModel.photoWindow!
  const photoSize: CardPhotoSize = { width: 400, height: 600 }
  const transform = frameCardPhotoOnBbox(photoSize, window, {
    x: 80,
    y: 40,
    width: 240,
    height: 420,
  })!

  const render = (name: string) => {
    const fake = createFakeContext()
    const base = { id: 'base' } as unknown as CanvasImageSource
    const overlay = { id: 'overlay' } as unknown as CanvasImageSource
    const photo = { id: 'photo' } as unknown as CanvasImageSource
    const result = renderTeamCard(fake.ctx, teamModel, {
      base,
      overlay,
      subject: { kind: 'photo', photo, photoSize, transform },
      window,
      name,
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter'),
    })

    return { ...fake, result, base, overlay, photo }
  }

  it('draws base → framed photo → overlay, then the label and the name banner', () => {
    const { drawCalls, textCalls, rectCalls, ops, result, base, overlay, photo } = render('Maria')

    expect(result.fit).toMatchObject({ ok: true, lines: ['MARIA'] })
    expect(drawCalls.map((call) => call.image)).toEqual([base, photo, overlay])
    expect(drawCalls[0]).toEqual({ image: base, dx: 0, dy: 0, dw: 1080, dh: 1440 })
    expect(drawCalls[2]).toEqual({ image: overlay, dx: 0, dy: 0, dw: 1080, dh: 1440 })

    // Both banners are drawn as rotated rectangles: two save/restore pairs.
    expect(rectCalls).toHaveLength(2)
    expect(rectCalls[0]).toMatchObject({
      width: TEAM_CARD_LABEL.width,
      height: TEAM_CARD_LABEL.height,
    })
    // S16 — `MARIA` at the ideal cap (130/0.72) with the 0.84em fake measures
    // ≈758.33 of ink; the banner grows by the model's 39px padding: ≈797.33.
    expect(rectCalls[1]).toMatchObject({
      y: -TEAM_CARD_NAME_BANNER.height / 2,
      height: TEAM_CARD_NAME_BANNER.height,
    })
    expect(rectCalls[1]!.width).toBeCloseTo(797.33, 1)
    expect(rectCalls[1]!.x).toBeCloseTo(-797.33 / 2, 1)
    expect(ops.filter((op) => op.op === 'save')).toHaveLength(2)
    expect(ops.filter((op) => op.op === 'restore')).toHaveLength(2)
    expect(ops.map((op) => op.op)).toEqual([
      'save',
      'translate',
      'rotate',
      'restore',
      'save',
      'translate',
      'rotate',
      'restore',
    ])
    expect(ops[1]!.args).toEqual([TEAM_CARD_LABEL.centerX, TEAM_CARD_LABEL.centerY])
    expect(ops[5]!.args).toEqual([TEAM_CARD_NAME_BANNER.centerX, TEAM_CARD_NAME_BANNER.centerY])

    expect(textCalls.map((call) => call.text)).toEqual(['TIME DE', 'MARIA'])
    expect(textCalls.every((call) => call.x === 0)).toBe(true)
  })

  it('draws the label but no name banner when the name cannot fit (never cuts silently)', () => {
    const { textCalls, rectCalls, result } = render('Bartolomeucostajunior')

    expect(result.fit).toEqual({ ok: false, reason: 'too-long' })
    expect(rectCalls).toHaveLength(1)
    expect(textCalls.map((call) => call.text)).toEqual(['TIME DE'])
  })

  it('returns the photo transform with the zoom clamped and the free position kept (S33)', () => {
    const { result, photo } = render('Maria')

    expect(result.transform).toEqual(transform)

    // S33 — `time-de-voce` is `free`: the zoom still clamps to [1, 4] but the
    // position comes back exactly as sent; a re-clamp here would snap the photo
    // back on the next paint (drawing and return share the model's policy).
    const fake = createFakeContext()
    const outOfBounds = { zoom: 0.5, offsetX: 10_000, offsetY: -10_000 }
    const clamped = renderTeamCard(fake.ctx, teamModel, {
      base: { id: 'base' } as unknown as CanvasImageSource,
      overlay: { id: 'overlay' } as unknown as CanvasImageSource,
      subject: { kind: 'photo', photo, photoSize, transform: outOfBounds },
      window,
      name: 'Maria',
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter'),
    })

    expect(clamped.transform).toEqual({ zoom: 1, offsetX: 10_000, offsetY: -10_000 })
    // The drawing follows the same free policy (second drawImage is the photo).
    expect(fake.drawCalls[1]).toMatchObject({ dx: 10_000, dy: -10_000 })
  })

  it('draws the visitor silhouette instead of the photo when no cutout is ready (S30)', () => {
    const fake = createFakeContext()
    const base = { id: 'base' } as unknown as CanvasImageSource
    const overlay = { id: 'overlay' } as unknown as CanvasImageSource
    const result = renderTeamCard(fake.ctx, teamModel, {
      base,
      overlay,
      subject: { kind: 'silhouette' },
      window,
      name: 'Maria',
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter'),
    })

    expect(result.transform).toBeNull()
    expect(result.fit).toMatchObject({ ok: true, lines: ['MARIA'] })
    expect(fake.drawCalls.map((call) => call.image)).toEqual([base, overlay])
    // Head circle + shoulder dome (rect + upper-half ellipse), both filled.
    expect(fake.ops.filter((op) => op.op === 'fill')).toHaveLength(2)
  })
})

describe('drawCardVisitorSilhouette (S30)', () => {
  const window = teamModel.photoWindow!

  it('normalizes the head and shoulders on the photo window', () => {
    const { ctx, ops } = createFakeContext()

    drawCardVisitorSilhouette(ctx, window)

    const shoulderHeight = window.height * 0.72
    const shoulderBottom = window.y + window.height * 1.03
    const bodyTop = shoulderBottom - shoulderHeight + shoulderHeight * 0.48
    const rect = ops.find((op) => op.op === 'rect')!
    const ellipse = ops.find((op) => op.op === 'ellipse')!

    expect(rect.args).toEqual([window.x, bodyTop, window.width, shoulderBottom - bodyTop])
    expect(ellipse.args).toEqual([
      window.x + window.width / 2,
      bodyTop,
      window.width * 0.48,
      shoulderHeight * 0.48,
      0,
      Math.PI,
      0,
    ])
    // The shoulders never grow wider than the window they sit in.
    expect(window.x + window.width / 2 - ellipse.args[2]!).toBeGreaterThanOrEqual(window.x)
    expect(window.x + window.width / 2 + ellipse.args[2]!).toBeLessThanOrEqual(
      window.x + window.width,
    )
    expect(ctx.fillStyle).toBe(CARD_VISITOR_SILHOUETTE_FILL)
  })
})

describe('resolveCardBannerWidth (S16)', () => {
  const slot = TEAM_CARD_NAME_SLOT
  const maxInkWidth = slot.maxInkWidth

  it('pins the design table pairs (ink = width − 39: reference 509 → ceiling 1000)', () => {
    const designPairs: [ink: number, width: number][] = [
      [470, 509],
      [527, 566],
      [807, 846],
      [925, 964],
      [951, 990],
      [952, 991],
      [961, 1000],
    ]

    for (const [ink, width] of designPairs) {
      expect(resolveCardBannerWidth(slot, ink)).toBe(width)
    }
  })

  it('keeps the reference width for short names and clamps past the ceiling', () => {
    expect(resolveCardBannerWidth(slot, 0)).toBe(slot.banner.width)
    expect(resolveCardBannerWidth(slot, 200)).toBe(slot.banner.width)
    expect(resolveCardBannerWidth(slot, 2000)).toBe(slot.banner.maxWidth)
  })

  it('never grows a fixed banner (the red TIME DE label)', () => {
    const labelSlot = { banner: TEAM_CARD_LABEL, maxInkWidth }
    expect(resolveCardBannerWidth(labelSlot, 0)).toBe(TEAM_CARD_LABEL.width)
    expect(resolveCardBannerWidth(labelSlot, 5000)).toBe(TEAM_CARD_LABEL.width)
  })
})

describe('drawCardName (centered team slot)', () => {
  it('draws the blue banner with the centered name through the same banner helper', () => {
    const { ctx, textCalls, rectCalls, ops } = createFakeContext()
    const fit = fitCardName('Maria', createCardMeasure(ctx, 'Brexter'), TEAM_CARD_NAME_SLOT)
    expect(fit.ok).toBe(true)
    if (!fit.ok) return

    drawCardName(ctx, { fit, fontFamily: 'Brexter', slot: TEAM_CARD_NAME_SLOT })

    // S16 — dynamic width resolved from the fitted ink (same ≈797.33 as above).
    expect(rectCalls).toHaveLength(1)
    expect(rectCalls[0]).toMatchObject({
      y: -TEAM_CARD_NAME_BANNER.height / 2,
      height: TEAM_CARD_NAME_BANNER.height,
    })
    expect(rectCalls[0]!.width).toBeCloseTo(797.33, 1)
    expect(rectCalls[0]!.x).toBeCloseTo(-797.33 / 2, 1)
    expect(ops).toEqual([
      { op: 'save', args: [] },
      { op: 'translate', args: [TEAM_CARD_NAME_BANNER.centerX, TEAM_CARD_NAME_BANNER.centerY] },
      { op: 'rotate', args: [(TEAM_CARD_NAME_BANNER.rotationDeg * Math.PI) / 180] },
      { op: 'restore', args: [] },
    ])
    expect(textCalls).toEqual([{ text: 'MARIA', x: 0, y: fit.capHeight / 2 }])
    expect(ctx.fillStyle).toBe('#ffffff')
  })
})

describe('renderPhotoCard', () => {
  it('draws the photo full-bleed under the official overlay', () => {
    const { ctx, drawCalls } = createFakeContext()
    const photo = { id: 'photo' } as unknown as CanvasImageSource
    const frame = { id: 'frame' } as unknown as CanvasImageSource
    const size: CardPhotoSize = { width: 2000, height: 1000 }
    const window: CardRect = squareModel.photoWindow!
    const transform = centerCardPhotoTransform(size, window)

    const clamped = renderPhotoCard(ctx, {
      photo,
      frame,
      photoSize: size,
      frameSize: { width: squareModel.width, height: squareModel.height },
      window,
      transform,
    })

    expect(clamped).toEqual(transform)
    expect(drawCalls).toHaveLength(2)
    expect(drawCalls[0]!.image).toBe(photo)
    expect(drawCalls[1]).toEqual({ image: frame, dx: 0, dy: 0, dw: 1000, dh: 1000 })
    expect(drawCalls[0]!.dx).toBeLessThanOrEqual(window.x)
    expect(drawCalls[0]!.dy).toBeLessThanOrEqual(window.y)
    expect(drawCalls[0]!.dx + drawCalls[0]!.dw).toBeGreaterThanOrEqual(window.x + window.width)
    expect(drawCalls[0]!.dy + drawCalls[0]!.dh).toBeGreaterThanOrEqual(window.y + window.height)
  })

  it('still clamps the visitor adjustment on the bounded photo models (S13/S14)', () => {
    const { ctx, drawCalls } = createFakeContext()
    const photo = { id: 'photo' } as unknown as CanvasImageSource
    const frame = { id: 'frame' } as unknown as CanvasImageSource
    const size: CardPhotoSize = { width: 2000, height: 1000 }
    const window: CardRect = squareModel.photoWindow!

    const clamped = renderPhotoCard(ctx, {
      photo,
      frame,
      photoSize: size,
      frameSize: { width: squareModel.width, height: squareModel.height },
      window,
      transform: { zoom: 1, offsetX: 9999, offsetY: 9999 },
    })

    expect(clamped).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    expect(drawCalls[0]).toEqual({ image: photo, dx: 0, dy: 0, dw: 1480, dh: 740 })
  })
})

describe('renderColinhaCard (S31)', () => {
  const colinhaModel = getCardModel('minha-colinha')!
  const group = { id: 'group' } as unknown as CanvasImageSource
  const lockup = { id: 'lockup' } as unknown as CanvasImageSource
  const band = { id: 'band' } as unknown as CanvasImageSource
  const deputy = getStateDeputyCard('julio')!

  const render = (chosen: StateDeputyCatalogEntry | null) => {
    const fake = createFakeContext()
    renderColinhaCard(fake.ctx, colinhaModel, {
      group,
      lockup,
      band,
      deputy: chosen,
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter', 900),
    })

    return fake
  }

  it('draws the white slip, the composed top and the legal line before the rows', () => {
    const { ctx, drawCalls, rectCalls, textCalls, ops } = render(deputy)

    expect(rectCalls[0]).toEqual({ x: 0, y: 0, width: 1080, height: 1920 })
    expect(drawCalls.map((call) => call.image)).toEqual([group, lockup, band])
    expect(drawCalls[0]).toEqual({ image: group, dx: 0, dy: -335.62, dw: 1080, dh: 1440 })
    expect(drawCalls[1]!.dx).toBeCloseTo(226.44, 1)
    expect(drawCalls[1]!.dy).toBeCloseTo(48.29, 2)
    expect(drawCalls[1]!.dw).toBeCloseTo(141.12, 1)
    expect(drawCalls[1]!.dh).toBeCloseTo(80.97, 1)
    expect(drawCalls[2]!.dy).toBeCloseTo(
      COLINHA_LAYOUT.top.band.y - COLINHA_LAYOUT.top.band.sourceY,
      5,
    )

    // Top clip + band clip; one save/restore pair per clipped composition and the legal line.
    expect(ops.filter((op) => op.op === 'clip')).toHaveLength(2)
    expect(ops.filter((op) => op.op === 'save')).toHaveLength(3)
    expect(ops.filter((op) => op.op === 'restore')).toHaveLength(3)
    // CSS 125° gradient with the 52% hard stop: red 0→52, blue 52→100.
    expect(ops.filter((op) => op.op === 'addColorStop').map((op) => op.args[0])).toEqual([
      0, 0.52, 0.52, 1,
    ])
    expect(textCalls[0]).toEqual({ text: COLINHA_LEGAL_TEXT, x: 0, y: 0 })
    expect(ctx.globalAlpha).toBe(1)
  })

  it('draws the six rows with one glyph per box and the filled estadual from the catalog', () => {
    const { ctx, textCalls, ops } = render(deputy)

    const candidates = [
      'Jorge Solla',
      'JULIO PINHEIRO',
      'Jaques Wagner',
      'Rui Costa',
      'Jerônimo',
      'Lula',
    ]
    for (const candidate of candidates) {
      expect(textCalls.some((call) => call.text === candidate)).toBe(true)
    }

    // One glyph per box, in row order: 4 + 5 + 3 + 3 + 2 + 2.
    expect(textCalls.filter((call) => call.text.length === 1).map((call) => call.text)).toEqual([
      '1',
      '3',
      '1',
      '3',
      '1',
      '3',
      '9',
      '9',
      '9',
      '1',
      '3',
      '0',
      '1',
      '3',
      '3',
      '1',
      '3',
      '1',
      '3',
    ])
    expect(textCalls.filter((call) => call.text === COLINHA_CONFIRM_LABEL)).toHaveLength(6)

    // 19 digit boxes (border + fill pair) + 6 single-fill pills.
    expect(ops.filter((op) => op.op === 'roundRect')).toHaveLength(19 * 2 + 6)

    // First box: content x (51.83 + 35.64) + the 30% office column + the 21.6 gap.
    const firstBox = ops.find((op) => op.op === 'roundRect')!
    expect(firstBox.args[0]).toBeCloseTo(396.14, 1)
    expect(firstBox.args[1]).toBeCloseTo(923.16, 1)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('draws the empty estadual row: placeholder, five empty boxes and no glyph there', () => {
    const { textCalls, ops } = render(null)

    expect(textCalls.some((call) => call.text === COLINHA_ESTADUAL_PLACEHOLDER)).toBe(true)
    expect(textCalls.filter((call) => call.text.length === 1).map((call) => call.text)).toEqual([
      '1',
      '3',
      '1',
      '3',
      '1',
      '3',
      '0',
      '1',
      '3',
      '3',
      '1',
      '3',
      '1',
      '3',
    ])
    expect(textCalls.filter((call) => call.text === COLINHA_CONFIRM_LABEL)).toHaveLength(6)
    // The five empty boxes are still drawn (19 boxes total) + the 6 pills.
    expect(ops.filter((op) => op.op === 'roundRect')).toHaveLength(19 * 2 + 6)
  })
})
