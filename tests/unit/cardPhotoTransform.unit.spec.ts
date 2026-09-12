import { describe, expect, it } from 'vitest'

import type { CardRect } from '@/lib/cardModels'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  cardPhotoDrawRect,
  centerCardPhotoTransform,
  clampCardPhotoTransform,
  coverScale,
  panCardPhotoTransform,
  zoomCardPhotoTransform,
  type CardPhotoSize,
} from '@/lib/cardPhotoTransform'

const WINDOW: CardRect = { x: 0, y: 0, width: 1000, height: 740 }
const LANDSCAPE: CardPhotoSize = { width: 2000, height: 1000 }
const PORTRAIT: CardPhotoSize = { width: 900, height: 1600 }

const coversWindow = (rect: CardRect, window: CardRect) =>
  rect.x <= window.x &&
  rect.y <= window.y &&
  rect.x + rect.width >= window.x + window.width &&
  rect.y + rect.height >= window.y + window.height

describe('coverScale', () => {
  it('covers the window on the tighter axis', () => {
    expect(coverScale(LANDSCAPE, WINDOW)).toBeCloseTo(0.74, 5)
    expect(coverScale(PORTRAIT, WINDOW)).toBeCloseTo(1000 / 900, 5)
  })

  it('degrades to 1 for empty sizes instead of dividing by zero', () => {
    expect(coverScale({ width: 0, height: 0 }, WINDOW)).toBe(1)
  })
})

describe('centerCardPhotoTransform', () => {
  it('covers the window and centers the photo on it', () => {
    const transform = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const rect = cardPhotoDrawRect(transform, LANDSCAPE, WINDOW)

    expect(transform).toEqual({ zoom: 1, offsetX: -240, offsetY: 0 })
    expect(coversWindow(rect, WINDOW)).toBe(true)
  })

  it('centers a portrait photo with vertical slack', () => {
    const transform = centerCardPhotoTransform(PORTRAIT, WINDOW)
    const rect = cardPhotoDrawRect(transform, PORTRAIT, WINDOW)

    expect(rect.height).toBeGreaterThan(WINDOW.height)
    expect(rect.y).toBeLessThan(0)
    expect(coversWindow(rect, WINDOW)).toBe(true)
  })
})

describe('clampCardPhotoTransform', () => {
  it('clamps the zoom to [1, 4]', () => {
    expect(
      clampCardPhotoTransform({ zoom: 0.2, offsetX: 0, offsetY: 0 }, LANDSCAPE, WINDOW).zoom,
    ).toBe(CARD_PHOTO_MIN_ZOOM)
    expect(
      clampCardPhotoTransform({ zoom: 9, offsetX: 0, offsetY: 0 }, LANDSCAPE, WINDOW).zoom,
    ).toBe(CARD_PHOTO_MAX_ZOOM)
  })

  it('pins the offsets so no gap can open at the window edges', () => {
    const tooFarRight = clampCardPhotoTransform(
      { zoom: 1, offsetX: 9999, offsetY: 9999 },
      LANDSCAPE,
      WINDOW,
    )
    const tooFarLeft = clampCardPhotoTransform(
      { zoom: 1, offsetX: -9999, offsetY: -9999 },
      LANDSCAPE,
      WINDOW,
    )

    expect(tooFarRight).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
    expect(tooFarLeft).toEqual({ zoom: 1, offsetX: -480, offsetY: 0 })
    expect(coversWindow(cardPhotoDrawRect(tooFarLeft, LANDSCAPE, WINDOW), WINDOW)).toBe(true)
  })
})

describe('panCardPhotoTransform', () => {
  it('nudges the offset and stays clamped', () => {
    const start = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const panned = panCardPhotoTransform(start, LANDSCAPE, WINDOW, 100, -40)

    expect(panned.offsetX).toBe(-140)
    expect(panned.offsetY).toBe(0)

    const overPanned = panCardPhotoTransform(panned, LANDSCAPE, WINDOW, 9999, 9999)
    expect(overPanned).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
  })
})

describe('zoomCardPhotoTransform', () => {
  it('keeps the anchor point stable while zooming', () => {
    const start = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const zoomed = zoomCardPhotoTransform(start, LANDSCAPE, WINDOW, 2, { x: 500, y: 370 })
    const scale = coverScale(LANDSCAPE, WINDOW) * 2

    expect((500 - zoomed.offsetX) / scale).toBeCloseTo((500 - start.offsetX) / (scale / 2), 5)
    expect(coversWindow(cardPhotoDrawRect(zoomed, LANDSCAPE, WINDOW), WINDOW)).toBe(true)
  })

  it('clamps above the max zoom and never opens a gap', () => {
    const zoomed = zoomCardPhotoTransform(
      centerCardPhotoTransform(PORTRAIT, WINDOW),
      PORTRAIT,
      WINDOW,
      99,
    )

    expect(zoomed.zoom).toBe(CARD_PHOTO_MAX_ZOOM)
    expect(coversWindow(cardPhotoDrawRect(zoomed, PORTRAIT, WINDOW), WINDOW)).toBe(true)
  })

  it('returns the clamped transform untouched when the zoom does not change', () => {
    const start = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const same = zoomCardPhotoTransform(start, LANDSCAPE, WINDOW, start.zoom)

    expect(same).toEqual(start)
  })
})
