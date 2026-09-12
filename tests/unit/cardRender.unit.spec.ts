import { describe, expect, it } from 'vitest'

import { NAME_CARD_SLOT, getCardModel, type CardRect } from '@/lib/cardModels'
import { centerCardPhotoTransform, type CardPhotoSize } from '@/lib/cardPhotoTransform'
import {
  createCardMeasure,
  renderNameCard,
  renderPhotoCard,
  type CardDrawContext,
} from '@/lib/cardRender'

type DrawCall = { image: unknown; dx: number; dy: number; dw: number; dh: number }
type TextCall = { text: string; x: number; y: number }

const fontSizeFrom = (font: string): number => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font)
  return match ? Number(match[1]) : 0
}

const createFakeContext = () => {
  const drawCalls: DrawCall[] = []
  const textCalls: TextCall[] = []

  const ctx: CardDrawContext = {
    font: '',
    fillStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    drawImage: (image, dx, dy, dw, dh) => {
      drawCalls.push({ image, dx, dy, dw, dh })
    },
    fillText: (text, x, y) => {
      textCalls.push({ text, x, y })
    },
    measureText: (text) => {
      const size = fontSizeFrom(ctx.font)
      return {
        width: text.length * size * 0.6,
        actualBoundingBoxAscent: size * 0.72,
        actualBoundingBoxDescent: size * 0.2,
      }
    },
  }

  return { ctx, drawCalls, textCalls }
}

const nameModel = getCardModel('eu-sou-solla')!
const squareModel = getCardModel('perfil-quadrado')!

describe('renderNameCard', () => {
  it('draws the master base first and then the centered name', () => {
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
    expect(textCalls[0]!.x).toBe(NAME_CARD_SLOT.centerX)
    expect(textCalls[0]!.y).toBeCloseTo(NAME_CARD_SLOT.capTop + NAME_CARD_SLOT.capHeight, 5)
    expect(ctx.fillStyle).toBe(NAME_CARD_SLOT.fill)
    expect(ctx.textAlign).toBe('center')
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
})
