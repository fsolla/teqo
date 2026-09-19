/**
 * S13 — pure cover/pan/zoom math for the photo card models. The visitor photo
 * is drawn full-bleed under the master overlay and must always cover the
 * transparent window: `clampCardPhotoTransform` keeps the zoom inside
 * [1, 4] and pins the offsets so no gap can open at the window edges.
 *
 * `centerCardPhotoTransform` is the initial framing (cover on the window, not
 * on the whole card) so the face lands on the visible area of the frame.
 */

import type { CardRect } from './cardModels'

export const CARD_PHOTO_MIN_ZOOM = 1
export const CARD_PHOTO_MAX_ZOOM = 4

/**
 * S15 — a cutout smaller than this (in source pixels) is treated as an empty
 * segmentation: the card would show a speck, so the composer fails closed and
 * offers a retry instead.
 */
const CARD_CUTOUT_MIN_BBOX = 24

/**
 * Alpha noise floor of a cutout (matches the mask's soft edge): the bbox read
 * ignores it and the S17 tone sample ignores it too, so both see the same photo.
 */
export const CARD_CUTOUT_ALPHA_THRESHOLD = 32

export type CardPhotoSize = {
  width: number
  height: number
}

export type CardPhotoTransform = {
  zoom: number
  offsetX: number
  offsetY: number
}

/** Alpha bounding box of a cutout photo, in source pixels. */
export type CardAlphaBbox = {
  x: number
  y: number
  width: number
  height: number
}

export const cardPhotoTransformsEqual = (a: CardPhotoTransform, b: CardPhotoTransform): boolean =>
  a.zoom === b.zoom && a.offsetX === b.offsetX && a.offsetY === b.offsetY

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const coverScale = (source: CardPhotoSize, window: CardRect): number => {
  if (source.width <= 0 || source.height <= 0 || window.width <= 0 || window.height <= 0) return 1

  return Math.max(window.width / source.width, window.height / source.height)
}

export const cardPhotoDrawRect = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
): CardRect => {
  const clamped = clampCardPhotoTransform(transform, source, window)
  const scale = coverScale(source, window) * clamped.zoom

  return {
    x: clamped.offsetX,
    y: clamped.offsetY,
    width: source.width * scale,
    height: source.height * scale,
  }
}

export const clampCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
): CardPhotoTransform => {
  const zoom = clamp(transform.zoom, CARD_PHOTO_MIN_ZOOM, CARD_PHOTO_MAX_ZOOM)
  const scale = coverScale(source, window) * zoom
  const width = source.width * scale
  const height = source.height * scale

  return {
    zoom,
    offsetX: clamp(transform.offsetX, window.x + window.width - width, window.x),
    offsetY: clamp(transform.offsetY, window.y + window.height - height, window.y),
  }
}

export const centerCardPhotoTransform = (
  source: CardPhotoSize,
  window: CardRect,
): CardPhotoTransform => {
  const scale = coverScale(source, window)
  const width = source.width * scale
  const height = source.height * scale

  return {
    zoom: CARD_PHOTO_MIN_ZOOM,
    offsetX: window.x + (window.width - width) / 2,
    offsetY: window.y + (window.height - height) / 2,
  }
}

/**
 * S15 — initial framing for a cutout photo: the alpha bbox is scaled to cover
 * the window, anchored at the bbox top (head against the top of the slot) and
 * centered horizontally on it. Returns `null` when the bbox is degenerate
 * (empty segmentation) or would demand more than the max zoom — the composer
 * fails closed instead of drawing an invisible or speck-sized photo.
 */
export const frameCardPhotoOnBbox = (
  source: CardPhotoSize,
  window: CardRect,
  bbox: CardAlphaBbox,
): CardPhotoTransform | null => {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    window.width <= 0 ||
    window.height <= 0 ||
    bbox.width < CARD_CUTOUT_MIN_BBOX ||
    bbox.height < CARD_CUTOUT_MIN_BBOX
  ) {
    return null
  }

  const scale = coverScale(source, window)
  const requiredZoom = Math.max(
    window.width / bbox.width / scale,
    window.height / bbox.height / scale,
  )
  if (!Number.isFinite(requiredZoom) || requiredZoom > CARD_PHOTO_MAX_ZOOM) return null

  const zoom = Math.max(CARD_PHOTO_MIN_ZOOM, requiredZoom)
  const applied = scale * zoom

  return clampCardPhotoTransform(
    {
      zoom,
      offsetX: window.x + window.width / 2 - (bbox.x + bbox.width / 2) * applied,
      offsetY: window.y - bbox.y * applied,
    },
    source,
    window,
  )
}

/** Nudges the offset by a step in card pixels, clamped to the window. */
export const panCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
  dx: number,
  dy: number,
): CardPhotoTransform =>
  clampCardPhotoTransform(
    { ...transform, offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy },
    source,
    window,
  )

/**
 * Rescales around a window anchor (used by the zoom control): keeps the point
 * under `anchor` stable from old to new zoom, then clamps.
 */
export const zoomCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
  nextZoom: number,
  anchor: { x: number; y: number } = {
    x: window.x + window.width / 2,
    y: window.y + window.height / 2,
  },
): CardPhotoTransform => {
  const zoom = clamp(nextZoom, CARD_PHOTO_MIN_ZOOM, CARD_PHOTO_MAX_ZOOM)
  if (zoom === transform.zoom) return clampCardPhotoTransform(transform, source, window)

  const ratio = zoom / transform.zoom

  return clampCardPhotoTransform(
    {
      zoom,
      offsetX: anchor.x - (anchor.x - transform.offsetX) * ratio,
      offsetY: anchor.y - (anchor.y - transform.offsetY) * ratio,
    },
    source,
    window,
  )
}
