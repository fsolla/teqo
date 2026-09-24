import { describe, expect, it } from 'vitest'

import { COLINHA_ESTADUAL_LABEL, COLINHA_ROW_LAYOUT } from '@/lib/cardColinha'
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
  createCardMeasure,
  drawCardName,
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
type TextState = { align: CanvasTextAlign; fill: string; font: string; letterSpacing: string }
type RectCall = { x: number; y: number; width: number; height: number }
type OpCall = { op: string; args: number[] }

const fontSizeFrom = (font: string): number => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font)
  return match ? Number(match[1]) : 0
}

const createFakeContext = () => {
  const drawCalls: DrawCall[] = []
  const textCalls: TextCall[] = []
  const textStates: TextState[] = []
  const rectCalls: RectCall[] = []
  const ops: OpCall[] = []

  const ctx: CardDrawContext = {
    font: '',
    letterSpacing: '',
    globalAlpha: 1,
    fillStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: (image, dx, dy, dw, dh) => {
      drawCalls.push({ image, dx, dy, dw, dh })
    },
    fillRect: (x, y, width, height) => {
      rectCalls.push({ x, y, width, height })
    },
    fillText: (text, x, y) => {
      textCalls.push({ text, x, y })
      textStates.push({
        align: ctx.textAlign,
        fill: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '',
        font: ctx.font,
        letterSpacing: ctx.letterSpacing,
      })
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

  return { ctx, drawCalls, textCalls, textStates, rectCalls, ops }
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
      subject: { photo, photoSize, transform },
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
      subject: { photo, photoSize, transform: outOfBounds },
      window,
      name: 'Maria',
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter'),
    })

    expect(clamped.transform).toEqual({ zoom: 1, offsetX: 10_000, offsetY: -10_000 })
    // The drawing follows the same free policy (second drawImage is the photo).
    expect(fake.drawCalls[1]).toMatchObject({ dx: 10_000, dy: -10_000 })
  })

  it('leaves the window empty instead of drawing a subject when no photo is ready (S40)', () => {
    const fake = createFakeContext()
    const base = { id: 'base' } as unknown as CanvasImageSource
    const overlay = { id: 'overlay' } as unknown as CanvasImageSource
    const result = renderTeamCard(fake.ctx, teamModel, {
      base,
      overlay,
      subject: null,
      window,
      name: 'Maria',
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter'),
    })

    expect(result.transform).toBeNull()
    expect(result.fit).toMatchObject({ ok: true, lines: ['MARIA'] })
    // Base + overlay only: nothing is drawn inside the photo window.
    expect(fake.drawCalls.map((call) => call.image)).toEqual([base, overlay])
    expect(
      fake.ops.filter((op) => ['beginPath', 'arc', 'ellipse', 'rect', 'fill'].includes(op.op)),
    ).toEqual([])
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

describe('renderColinhaCard (S34)', () => {
  const colinhaModel = getCardModel('minha-colinha')!
  const art = { id: 'art' } as unknown as CanvasImageSource
  const deputy = getStateDeputyCard('julio')!

  const render = (chosen: StateDeputyCatalogEntry | null) => {
    const fake = createFakeContext()
    renderColinhaCard(fake.ctx, colinhaModel, {
      image: art,
      deputy: chosen,
      fontFamily: 'Brexter',
      measure: createCardMeasure(fake.ctx, 'Brexter', 900),
    })

    return fake
  }

  // The fake face is conservative (0.84em per char): JULIO PINHEIRO shrinks
  // from 36.72 to floor(36.72 × 195.83 / 431.83) = 16 to fit the mask band.
  const nameFontSize = 16
  const baseline = COLINHA_ROW_LAYOUT.copy.top + nameFontSize * 0.72
  const nameWidth = 'JULIO PINHEIRO'.length * nameFontSize * 0.84

  it('draws the approved art whole at 1080×1920 with high smoothing', () => {
    const { ctx, drawCalls, ops } = render(deputy)

    expect(drawCalls).toEqual([{ image: art, dx: 0, dy: 0, dw: 1080, dh: 1920 }])
    expect(ctx.imageSmoothingEnabled).toBe(true)
    expect(ctx.imageSmoothingQuality).toBe('high')
    // None of the S31 composition survives: no clip/save/gradient/roundRect.
    expect(ops).toHaveLength(0)
  })

  it('leaves the art exactly as delivered before a pick (no text, no rect)', () => {
    const { drawCalls, rectCalls, textCalls, ops } = render(null)

    expect(drawCalls).toEqual([{ image: art, dx: 0, dy: 0, dw: 1080, dh: 1920 }])
    expect(rectCalls).toHaveLength(0)
    expect(textCalls).toHaveLength(0)
    expect(ops).toHaveLength(0)
  })

  it('fills the estadual line: mask, label at the left, name at the right and five digits', () => {
    const { ctx, rectCalls, textCalls, textStates } = render(deputy)

    expect(rectCalls).toEqual([
      {
        x: COLINHA_ROW_LAYOUT.mask.x,
        y: COLINHA_ROW_LAYOUT.mask.y,
        width: COLINHA_ROW_LAYOUT.mask.width,
        height: COLINHA_ROW_LAYOUT.mask.height,
      },
    ])
    expect(textCalls.map((call) => call.text)).toEqual([
      COLINHA_ESTADUAL_LABEL,
      'JULIO PINHEIRO',
      '1',
      '3',
      '9',
      '9',
      '9',
    ])

    const label = textCalls[0]!
    expect(label.x).toBeCloseTo(
      COLINHA_ROW_LAYOUT.copy.right - nameWidth - COLINHA_ROW_LAYOUT.gap,
      5,
    )
    expect(label.y).toBeCloseTo(baseline, 5)
    expect(textStates[0]).toMatchObject({
      align: 'right',
      fill: COLINHA_ROW_LAYOUT.office.color,
      font: `400 ${COLINHA_ROW_LAYOUT.office.fontSize}px Brexter`,
      letterSpacing: '0px',
    })

    const name = textCalls[1]!
    expect(name.x).toBeCloseTo(COLINHA_ROW_LAYOUT.copy.right, 5)
    expect(name.y).toBeCloseTo(baseline, 5)
    expect(textStates[1]).toMatchObject({
      align: 'right',
      fill: COLINHA_ROW_LAYOUT.name.color,
      font: `900 ${nameFontSize}px Brexter`,
      letterSpacing: `${COLINHA_ROW_LAYOUT.name.letterSpacingEm * nameFontSize}px`,
    })

    const { digit } = COLINHA_ROW_LAYOUT
    const centerY = digit.top + digit.height / 2
    textCalls.slice(2).forEach((call, index) => {
      expect(call.x).toBeCloseTo(digit.left + digit.width / 2 + index * digit.step, 5)
      expect(call.y).toBeCloseTo(centerY, 5)
      expect(textStates[2 + index]).toMatchObject({
        align: 'center',
        fill: digit.color,
        font: `900 ${digit.fontSize}px Arial Black, Arial, Helvetica, sans-serif`,
      })
    })

    // The tracking set for the name never leaks to the next paint.
    expect(ctx.letterSpacing).toBe('0px')
    expect(ctx.globalAlpha).toBe(1)
  })
})
