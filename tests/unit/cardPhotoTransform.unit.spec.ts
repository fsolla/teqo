import { describe, expect, it } from 'vitest'

import type { CardRect } from '@/lib/cardModels'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  cardPhotoDrawRect,
  centerCardPhotoTransform,
  clampCardPhotoTransform,
  coverScale,
  frameCardPhotoOnBbox,
  panCardPhotoTransform,
  zoomCardPhotoTransform,
  type CardAlphaBbox,
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

describe('frameCardPhotoOnBbox', () => {
  const TEAM_WINDOW: CardRect = { x: 286, y: 439, width: 592, height: 577 }

  it('anchors the bbox top on the window top and centers it horizontally', () => {
    const source: CardPhotoSize = { width: 900, height: 1200 }
    const bbox: CardAlphaBbox = { x: 260, y: 140, width: 380, height: 520 }

    const transform = frameCardPhotoOnBbox(source, TEAM_WINDOW, bbox)
    expect(transform).not.toBeNull()
    if (!transform) return

    const rect = cardPhotoDrawRect(transform, source, TEAM_WINDOW)
    const scale = rect.width / source.width
    // bbox top lands exactly on the window top, bbox center on the window center
    expect(rect.y + bbox.y * scale).toBeCloseTo(TEAM_WINDOW.y, 5)
    expect(rect.x + (bbox.x + bbox.width / 2) * scale).toBeCloseTo(
      TEAM_WINDOW.x + TEAM_WINDOW.width / 2,
      5,
    )
    // the cutout itself covers the whole slot
    expect(bbox.width * scale).toBeGreaterThanOrEqual(TEAM_WINDOW.width - 1e-6)
    expect(bbox.height * scale).toBeGreaterThanOrEqual(TEAM_WINDOW.height - 1e-6)
    expect(coversWindow(rect, TEAM_WINDOW)).toBe(true)
  })

  it('keeps the bottom of a full-height bbox visible when the zoom allows it', () => {
    const source: CardPhotoSize = { width: 800, height: 1200 }
    const bbox: CardAlphaBbox = { x: 200, y: 0, width: 400, height: 1000 }

    const transform = frameCardPhotoOnBbox(source, TEAM_WINDOW, bbox)
    expect(transform).not.toBeNull()
    if (!transform) return

    const rect = cardPhotoDrawRect(transform, source, TEAM_WINDOW)
    const scale = rect.width / source.width
    expect(rect.y + (bbox.y + bbox.height) * scale).toBeGreaterThanOrEqual(
      TEAM_WINDOW.y + TEAM_WINDOW.height,
    )
  })

  it('fails closed on a degenerate bbox (empty segmentation)', () => {
    const source: CardPhotoSize = { width: 900, height: 1200 }
    expect(
      frameCardPhotoOnBbox(source, TEAM_WINDOW, { x: 0, y: 0, width: 0, height: 0 }),
    ).toBeNull()
    expect(
      frameCardPhotoOnBbox(source, TEAM_WINDOW, { x: 10, y: 10, width: 10, height: 30 }),
    ).toBeNull()
  })

  it('fails closed when the bbox is so small it would need more than the max zoom', () => {
    const source: CardPhotoSize = { width: 4000, height: 4000 }
    const bbox: CardAlphaBbox = { x: 100, y: 100, width: 80, height: 80 }

    expect(frameCardPhotoOnBbox(source, TEAM_WINDOW, bbox)).toBeNull()
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

describe('free position (S33 — position: free)', () => {
  const outside = { zoom: 1, offsetX: 9999, offsetY: -9999 }

  it('keeps the offsets outside the window and still clamps the zoom to [1, 4]', () => {
    expect(
      clampCardPhotoTransform({ ...outside, zoom: 9 }, LANDSCAPE, WINDOW, { position: 'free' }),
    ).toEqual({ ...outside, zoom: CARD_PHOTO_MAX_ZOOM })
    expect(
      clampCardPhotoTransform({ ...outside, zoom: 0.2 }, LANDSCAPE, WINDOW, { position: 'free' }),
    ).toEqual({ ...outside, zoom: CARD_PHOTO_MIN_ZOOM })
    // Idempotent: a settled free transform never drifts on a second pass.
    const free = clampCardPhotoTransform(outside, LANDSCAPE, WINDOW, { position: 'free' })
    expect(clampCardPhotoTransform(free, LANDSCAPE, WINDOW, { position: 'free' })).toEqual(free)
  })

  it('draws the photo at the sent offsets, only the cover scale applied', () => {
    expect(cardPhotoDrawRect(outside, LANDSCAPE, WINDOW, { position: 'free' })).toEqual({
      x: 9999,
      y: -9999,
      width: 1480,
      height: 740,
    })
  })

  it('lets the pan leave the window on both axes', () => {
    const start = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const panned = panCardPhotoTransform(start, LANDSCAPE, WINDOW, 9999, 9999, {
      position: 'free',
    })

    expect(panned).toEqual({ zoom: 1, offsetX: 9759, offsetY: 9999 })
  })

  it('keeps the free position when the zoom does not change (anti snap-back)', () => {
    // The bounded default pulls the photo back to the window (S13/S14)…
    expect(zoomCardPhotoTransform(outside, LANDSCAPE, WINDOW, outside.zoom)).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    })
    // …while the free team policy normalizes only the zoom.
    expect(
      zoomCardPhotoTransform(outside, LANDSCAPE, WINDOW, outside.zoom, undefined, {
        position: 'free',
      }),
    ).toEqual(outside)
  })

  it('clamps the zoom but never pulls the free position back', () => {
    const zoomed = zoomCardPhotoTransform(outside, LANDSCAPE, WINDOW, 99, undefined, {
      position: 'free',
    })

    expect(zoomed).toEqual({
      zoom: CARD_PHOTO_MAX_ZOOM,
      offsetX: 500 - (500 - 9999) * CARD_PHOTO_MAX_ZOOM,
      offsetY: 370 - (370 + 9999) * CARD_PHOTO_MAX_ZOOM,
    })
  })
})
