import { describe, expect, it } from 'vitest'

import type { CardRect } from '@/lib/cardModels'
import {
  CARD_PHOTO_MAX_ZOOM,
  CARD_PHOTO_MIN_ZOOM,
  CARD_TEAM_PHOTO_MIN_ZOOM,
  cardPhotoDrawRect,
  centerCardPhotoTransform,
  clampCardPhotoTransform,
  coverScale,
  frameCardPhotoOnBbox,
  frameCardPhotoOnFace,
  panCardPhotoTransform,
  resolveCardPhotoAnchor,
  zoomCardPhotoTransform,
  type CardAlphaBbox,
  type CardFaceBox,
  type CardPhotoClamp,
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

describe('frameCardPhotoOnFace', () => {
  const TEAM_WINDOW: CardRect = { x: 286, y: 439, width: 592, height: 577 }
  const SOURCE: CardPhotoSize = { width: 1000, height: 1250 }
  const BBOX: CardAlphaBbox = { x: 200, y: 100, width: 600, height: 900 }
  const REFERENCE = 103

  it('scales the detected face to the reference, centered and on the window top', () => {
    const face: CardFaceBox = { x: 400, y: 200, width: 60, height: 60 }

    const transform = frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, face, REFERENCE)
    expect(transform).not.toBeNull()
    if (!transform) return

    const rect = cardPhotoDrawRect(transform, SOURCE, TEAM_WINDOW)
    const scale = rect.width / SOURCE.width

    expect(transform.zoom).toBeCloseTo(
      REFERENCE / (face.width * coverScale(SOURCE, TEAM_WINDOW)),
      5,
    )
    // the face lands exactly on the candidates' reference size
    expect(face.width * scale).toBeCloseTo(REFERENCE, 5)
    // face center on the window center, bbox top on the window top
    expect(rect.x + (face.x + face.width / 2) * scale).toBeCloseTo(
      TEAM_WINDOW.x + TEAM_WINDOW.width / 2,
      5,
    )
    expect(rect.y + BBOX.y * scale).toBeCloseTo(TEAM_WINDOW.y, 5)
    // the face itself stays inside the window
    expect(rect.x + face.x * scale).toBeGreaterThanOrEqual(TEAM_WINDOW.x - 1e-6)
    expect(rect.x + (face.x + face.width) * scale).toBeLessThanOrEqual(
      TEAM_WINDOW.x + TEAM_WINDOW.width + 1e-6,
    )
    expect(rect.y + face.y * scale).toBeGreaterThanOrEqual(TEAM_WINDOW.y - 1e-6)
    expect(rect.y + (face.y + face.height) * scale).toBeLessThanOrEqual(
      TEAM_WINDOW.y + TEAM_WINDOW.height + 1e-6,
    )
  })

  it('scales a large face down below the S13 cover floor onto the reference size', () => {
    const face: CardFaceBox = { x: 380, y: 180, width: 220, height: 220 }

    const transform = frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, face, REFERENCE)
    expect(transform).not.toBeNull()
    if (!transform) return

    // the proportional framing wins over the S13 cover floor...
    expect(transform.zoom).toBeLessThan(CARD_PHOTO_MIN_ZOOM)
    expect(transform.zoom).toBeGreaterThanOrEqual(CARD_TEAM_PHOTO_MIN_ZOOM)

    const rect = cardPhotoDrawRect(transform, SOURCE, TEAM_WINDOW, {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
    })
    const scale = rect.width / SOURCE.width
    // ...and still lands the face exactly on the reference size
    expect(face.width * scale).toBeCloseTo(REFERENCE, 5)
    // per axis: contained where the photo is smaller, covering where it is bigger
    expect(rect.x).toBeGreaterThanOrEqual(TEAM_WINDOW.x - 1e-6)
    expect(rect.x + rect.width).toBeLessThanOrEqual(TEAM_WINDOW.x + TEAM_WINDOW.width + 1e-6)
    expect(rect.y).toBeLessThanOrEqual(TEAM_WINDOW.y + 1e-6)
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(TEAM_WINDOW.y + TEAM_WINDOW.height - 1e-6)
    // the face itself stays inside the window
    expect(rect.y + (face.y + face.height) * scale).toBeLessThanOrEqual(
      TEAM_WINDOW.y + TEAM_WINDOW.height + 1e-6,
    )
  })

  it('clamps an extreme face at the team floor and keeps it within +15%', () => {
    const face: CardFaceBox = { x: 40, y: 100, width: 900, height: 900 }

    const transform = frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, face, REFERENCE)
    expect(transform).not.toBeNull()
    if (!transform) return

    expect(transform.zoom).toBe(CARD_TEAM_PHOTO_MIN_ZOOM)

    const rect = cardPhotoDrawRect(transform, SOURCE, TEAM_WINDOW, {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
    })
    const scale = rect.width / SOURCE.width
    const achieved = face.width * scale

    expect(achieved).toBeCloseTo(face.width * coverScale(SOURCE, TEAM_WINDOW) * 0.2, 5)
    expect(achieved).toBeLessThanOrEqual(REFERENCE * 1.15)
  })

  it('delegates to the S15 framing on non-finite face or reference values', () => {
    const expected = frameCardPhotoOnBbox(SOURCE, TEAM_WINDOW, BBOX)

    expect(
      frameCardPhotoOnFace(
        SOURCE,
        TEAM_WINDOW,
        BBOX,
        { x: 0, y: 0, width: Number.NaN, height: 40 },
        REFERENCE,
      ),
    ).toEqual(expected)
    expect(frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, null, Number.POSITIVE_INFINITY)).toEqual(
      expected,
    )
  })

  it('delegates to the S15 framing when there is no usable face', () => {
    const expected = frameCardPhotoOnBbox(SOURCE, TEAM_WINDOW, BBOX)

    expect(frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, null, REFERENCE)).toEqual(expected)
    expect(
      frameCardPhotoOnFace(
        SOURCE,
        TEAM_WINDOW,
        BBOX,
        { x: 0, y: 0, width: 0, height: 0 },
        REFERENCE,
      ),
    ).toEqual(expected)
    expect(
      frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, { x: 400, y: 200, width: 60, height: 60 }, 0),
    ).toEqual(expected)
  })

  it('fails closed on a degenerate bbox, with or without a face', () => {
    const emptyBbox: CardAlphaBbox = { x: 0, y: 0, width: 0, height: 0 }
    const face: CardFaceBox = { x: 10, y: 10, width: 50, height: 50 }

    expect(frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, emptyBbox, face, REFERENCE)).toBeNull()
    expect(frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, emptyBbox, null, REFERENCE)).toBeNull()
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

  it('accepts the team floor and keeps a smaller photo contained by the window', () => {
    const shrunk = clampCardPhotoTransform(
      { zoom: 0.1, offsetX: 9999, offsetY: -9999 },
      LANDSCAPE,
      WINDOW,
      { minZoom: CARD_TEAM_PHOTO_MIN_ZOOM },
    )

    expect(shrunk.zoom).toBe(CARD_TEAM_PHOTO_MIN_ZOOM)
    const rect = cardPhotoDrawRect(shrunk, LANDSCAPE, WINDOW, {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
    })
    expect(rect.x).toBeGreaterThanOrEqual(WINDOW.x)
    expect(rect.y).toBeGreaterThanOrEqual(WINDOW.y)
    expect(rect.x + rect.width).toBeLessThanOrEqual(WINDOW.x + WINDOW.width)
    expect(rect.y + rect.height).toBeLessThanOrEqual(WINDOW.y + WINDOW.height)
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

  it('keeps a sub-1 team zoom while panning the contained photo', () => {
    const panned = panCardPhotoTransform(
      { zoom: 0.3, offsetX: 0, offsetY: 0 },
      LANDSCAPE,
      WINDOW,
      40,
      30,
      { minZoom: CARD_TEAM_PHOTO_MIN_ZOOM },
    )

    expect(panned).toEqual({ zoom: 0.3, offsetX: 40, offsetY: 30 })
  })
})

describe('resolveCardPhotoAnchor', () => {
  const BBOX: CardAlphaBbox = { x: 10, y: 20, width: 300, height: 400 }

  it('prefers a usable face over the silhouette', () => {
    const face: CardFaceBox = { x: 40, y: 50, width: 60, height: 60 }

    expect(resolveCardPhotoAnchor(BBOX, face)).toEqual(face)
    expect(resolveCardPhotoAnchor(BBOX, { ...face, width: Number.NaN })).toEqual(BBOX)
    expect(resolveCardPhotoAnchor(BBOX, { ...face, width: 0 })).toEqual(BBOX)
    expect(resolveCardPhotoAnchor(BBOX, { ...face, height: -1 })).toEqual(BBOX)
    expect(resolveCardPhotoAnchor(BBOX, null)).toEqual(BBOX)
  })
})

describe('S20 anchor clamp', () => {
  const TEAM_WINDOW: CardRect = { x: 286, y: 439, width: 592, height: 577 }
  const SOURCE: CardPhotoSize = { width: 1000, height: 1250 }
  const BBOX: CardAlphaBbox = { x: 200, y: 100, width: 600, height: 900 }
  const REFERENCE = 103
  // Big enough that the face lands on the reference below the cover floor:
  // the drawn photo is smaller than the window horizontally (contain regime).
  const FACE: CardFaceBox = { x: 400, y: 200, width: 200, height: 200 }
  const anchor = resolveCardPhotoAnchor(BBOX, FACE)

  it('lets the anchor box reach both window edges from the initial framing', () => {
    const initial = frameCardPhotoOnFace(SOURCE, TEAM_WINDOW, BBOX, FACE, REFERENCE)
    expect(initial).not.toBeNull()
    if (!initial) return

    const clampOptions: CardPhotoClamp = {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      anchorBox: anchor,
    }
    const scale = coverScale(SOURCE, TEAM_WINDOW) * initial.zoom
    const toTheLeft = panCardPhotoTransform(initial, SOURCE, TEAM_WINDOW, -9999, 0, clampOptions)
    const toTheRight = panCardPhotoTransform(initial, SOURCE, TEAM_WINDOW, 9999, 0, clampOptions)
    // course = window − face drawn on the reference size, split evenly around
    // the initial framing: the design's ≈±244px per side
    const halfCourse = (TEAM_WINDOW.width - REFERENCE) / 2

    expect(initial.offsetX - toTheLeft.offsetX).toBeCloseTo(halfCourse, 5)
    expect(toTheRight.offsetX - initial.offsetX).toBeCloseTo(halfCourse, 5)
    // the anchor box touches each edge and never leaves the window
    expect(toTheLeft.offsetX + anchor.x * scale).toBeCloseTo(TEAM_WINDOW.x, 5)
    expect(toTheRight.offsetX + (anchor.x + anchor.width) * scale).toBeCloseTo(
      TEAM_WINDOW.x + TEAM_WINDOW.width,
      5,
    )
  })

  it('accepts on the anchor side what the S18 clamp rejects, without touching Y', () => {
    const zoom = REFERENCE / (FACE.width * coverScale(SOURCE, TEAM_WINDOW))
    const scale = coverScale(SOURCE, TEAM_WINDOW) * zoom
    const clampOptions: CardPhotoClamp = {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      anchorBox: anchor,
    }

    const todayRight = panCardPhotoTransform(
      { zoom, offsetX: 0, offsetY: 0 },
      SOURCE,
      TEAM_WINDOW,
      9999,
      9999,
      { minZoom: CARD_TEAM_PHOTO_MIN_ZOOM },
    )
    const anchoredRight = panCardPhotoTransform(
      { zoom, offsetX: 0, offsetY: 0 },
      SOURCE,
      TEAM_WINDOW,
      9999,
      9999,
      clampOptions,
    )

    expect(anchoredRight.offsetX).toBeGreaterThan(todayRight.offsetX)
    expect(anchoredRight.offsetY).toBe(todayRight.offsetY)
    expect(anchoredRight.offsetX + (anchor.x + anchor.width) * scale).toBeCloseTo(
      TEAM_WINDOW.x + TEAM_WINDOW.width,
      5,
    )
  })

  it('never rejects a transform that the S18 clamp accepts (grid of zooms and anchors)', () => {
    const anchors: CardAlphaBbox[] = [
      anchor,
      { x: 40, y: 60, width: 300, height: 300 },
      { x: 0, y: 0, width: 900, height: 900 },
      { x: -400, y: 0, width: 500, height: 500 },
    ]

    for (const zoom of [0.3, 0.87, 1, 1.6, 2.5]) {
      for (const anchorBox of anchors) {
        for (const offset of [-2000, -500, 0, 300, 900, 2000]) {
          const today = clampCardPhotoTransform(
            { zoom, offsetX: offset, offsetY: offset },
            SOURCE,
            TEAM_WINDOW,
            { minZoom: CARD_TEAM_PHOTO_MIN_ZOOM },
          )
          const anchored = clampCardPhotoTransform(today, SOURCE, TEAM_WINDOW, {
            minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
            anchorBox,
          })

          expect(anchored).toEqual(today)
        }
      }
    }
  })

  it('falls back to the S18 range when the anchor lies outside the photo', () => {
    // zoom 1 draws the source exactly on the window width: today's X is pinned,
    // while a face box at x = -100 would anchor entirely to its right
    const clampOptions: CardPhotoClamp = {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      anchorBox: { x: -100, y: 0, width: 100, height: 100 },
    }
    const today = clampCardPhotoTransform(
      { zoom: 1, offsetX: 9999, offsetY: 9999 },
      SOURCE,
      TEAM_WINDOW,
      {
        minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      },
    )

    expect(
      clampCardPhotoTransform(
        { zoom: 1, offsetX: 9999, offsetY: 9999 },
        SOURCE,
        TEAM_WINDOW,
        clampOptions,
      ),
    ).toEqual(today)
  })

  it('falls back to the S18 rule when the drawn anchor is wider than the window', () => {
    const wideAnchor: CardAlphaBbox = { x: 0, y: 0, width: 600, height: 600 }
    // zoom 2: the 600px anchor draws 710px wide, wider than the 592px window
    const transform = { zoom: 2, offsetX: 9999, offsetY: 9999 }
    const clampOptions: CardPhotoClamp = {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      anchorBox: wideAnchor,
    }

    expect(clampCardPhotoTransform(transform, SOURCE, TEAM_WINDOW, clampOptions)).toEqual(
      clampCardPhotoTransform(transform, SOURCE, TEAM_WINDOW, {
        minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
      }),
    )
  })

  it('is idempotent with an anchor in both regimes', () => {
    const transforms = [
      { zoom: 0.5, offsetX: -9999, offsetY: -9999 },
      { zoom: 0.87, offsetX: 9999, offsetY: 9999 },
      { zoom: 2.5, offsetX: -400, offsetY: 120 },
    ]

    for (const transform of transforms) {
      const once = clampCardPhotoTransform(transform, SOURCE, TEAM_WINDOW, {
        minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
        anchorBox: anchor,
      })
      const twice = clampCardPhotoTransform(once, SOURCE, TEAM_WINDOW, {
        minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
        anchorBox: anchor,
      })

      expect(twice).toEqual(once)
    }
  })
})

describe('zoomCardPhotoTransform', () => {
  it('keeps the anchor point stable while zooming', () => {
    const start = centerCardPhotoTransform(LANDSCAPE, WINDOW)
    const zoomed = zoomCardPhotoTransform(start, LANDSCAPE, WINDOW, 2, {
      anchor: { x: 500, y: 370 },
    })
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

  it('honors the team floor and preserves a sub-1 escape zoom', () => {
    const start = { zoom: 0.3, offsetX: 0, offsetY: 0 }
    const floored = zoomCardPhotoTransform(start, LANDSCAPE, WINDOW, 0.05, {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
    })
    const adjusted = zoomCardPhotoTransform(start, LANDSCAPE, WINDOW, 0.5, {
      minZoom: CARD_TEAM_PHOTO_MIN_ZOOM,
    })

    expect(floored.zoom).toBe(CARD_TEAM_PHOTO_MIN_ZOOM)
    expect(adjusted.zoom).toBe(0.5)
  })
})
