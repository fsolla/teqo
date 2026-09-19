/**
 * S13 — pure cover/pan/zoom math for the photo card models. The visitor photo
 * is drawn full-bleed under the master overlay and must always cover the
 * transparent window: `clampCardPhotoTransform` keeps the zoom inside
 * [1, 4] and pins the offsets so no gap can open at the window edges.
 *
 * S18 — the team model may frame the head below the cover floor
 * (`CARD_TEAM_PHOTO_MIN_ZOOM`), so its clamp keeps the drawn photo *inside* the
 * window when it is smaller than it instead of pinning it to the edge.
 *
 * `centerCardPhotoTransform` is the initial framing (cover on the window, not
 * on the whole card) so the face lands on the visible area of the frame.
 */

import type { CardRect } from './cardModels'

export const CARD_PHOTO_MIN_ZOOM = 1
export const CARD_PHOTO_MAX_ZOOM = 4

/**
 * S18 — floor for the team model's proportional framing. At 0.2 the drawn photo
 * can sit inside the window, which is what the design's "proporcional" scene
 * asks for; the floor also bounds a runaway zoom-out (a face box can span the
 * whole source at most, so the achieved face never exceeds the reference by
 * more than the ~15% the window's tighter axis implies).
 */
export const CARD_TEAM_PHOTO_MIN_ZOOM = 0.2

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

/** Detected face box of a source photo, in the same source pixels (S18). */
export type CardFaceBox = {
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
  minZoom: number = CARD_PHOTO_MIN_ZOOM,
): CardRect => {
  const clamped = clampCardPhotoTransform(transform, source, window, minZoom)
  const scale = coverScale(source, window) * clamped.zoom

  return {
    x: clamped.offsetX,
    y: clamped.offsetY,
    width: source.width * scale,
    height: source.height * scale,
  }
}

/**
 * Keeps the drawn photo covering the window when it is at least as big as it
 * (the S13 rule) and fully inside it when it is smaller (the S18 team framing,
 * where the visitor no longer fills the slot).
 */
const clampPhotoOffset = (value: number, start: number, size: number, drawn: number): number =>
  drawn >= size
    ? clamp(value, start + size - drawn, start)
    : clamp(value, start, start + size - drawn)

export const clampCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
  minZoom: number = CARD_PHOTO_MIN_ZOOM,
): CardPhotoTransform => {
  const zoom = clamp(transform.zoom, minZoom, CARD_PHOTO_MAX_ZOOM)
  const scale = coverScale(source, window) * zoom
  const width = source.width * scale
  const height = source.height * scale

  return {
    zoom,
    offsetX: clampPhotoOffset(transform.offsetX, window.x, window.width, width),
    offsetY: clampPhotoOffset(transform.offsetY, window.y, window.height, height),
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

/**
 * S18 — initial framing for the team cutout oriented by the visitor's face: the
 * detected face box is scaled to `referenceSize` (the candidates' face box
 * measured once over the master art) so the visitor's head lands on the team's
 * scale. The zoom may sit below the S13 cover floor (down to
 * `CARD_TEAM_PHOTO_MIN_ZOOM`), which is the design's proportional framing: the
 * visitor keeps the team's scale and the master art shows around them. With the
 * pinned reference (103px) the framed face never exceeds ~118px (the floor
 * times the window's tighter axis), so it fits well inside the 592×577 window;
 * the placement centers it horizontally and keeps the bbox top on the window
 * top. Without a usable face (or with a degenerate bbox) the S15 framing
 * (`frameCardPhotoOnBbox`) applies unchanged.
 */
export const frameCardPhotoOnFace = (
  source: CardPhotoSize,
  window: CardRect,
  bbox: CardAlphaBbox,
  face: CardFaceBox | null,
  referenceSize: number,
): CardPhotoTransform | null => {
  const baseFraming = frameCardPhotoOnBbox(source, window, bbox)
  if (!baseFraming) return null
  if (!face || !(face.width > 0) || !(face.height > 0) || !(referenceSize > 0)) return baseFraming

  const scale = coverScale(source, window)
  const faceSize = Math.max(face.width, face.height)
  const zoom = clamp(
    referenceSize / (faceSize * scale),
    CARD_TEAM_PHOTO_MIN_ZOOM,
    CARD_PHOTO_MAX_ZOOM,
  )
  const applied = scale * zoom

  return clampCardPhotoTransform(
    {
      zoom,
      offsetX: window.x + window.width / 2 - (face.x + face.width / 2) * applied,
      offsetY: window.y - bbox.y * applied,
    },
    source,
    window,
    CARD_TEAM_PHOTO_MIN_ZOOM,
  )
}

/** Nudges the offset by a step in card pixels, clamped to the window. */
export const panCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
  dx: number,
  dy: number,
  minZoom: number = CARD_PHOTO_MIN_ZOOM,
): CardPhotoTransform =>
  clampCardPhotoTransform(
    { ...transform, offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy },
    source,
    window,
    minZoom,
  )

/**
 * Rescales around a window anchor (used by the zoom control): keeps the point
 * under `anchor` stable from old to new zoom, then clamps. The team model
 * passes its own `minZoom` so the visitor can fine-tune below the cover floor.
 */
export const zoomCardPhotoTransform = (
  transform: CardPhotoTransform,
  source: CardPhotoSize,
  window: CardRect,
  nextZoom: number,
  {
    anchor,
    minZoom = CARD_PHOTO_MIN_ZOOM,
  }: { anchor?: { x: number; y: number }; minZoom?: number } = {},
): CardPhotoTransform => {
  const resolvedAnchor = anchor ?? {
    x: window.x + window.width / 2,
    y: window.y + window.height / 2,
  }
  const zoom = clamp(nextZoom, minZoom, CARD_PHOTO_MAX_ZOOM)
  if (zoom === transform.zoom) return clampCardPhotoTransform(transform, source, window, minZoom)

  const ratio = zoom / transform.zoom

  return clampCardPhotoTransform(
    {
      zoom,
      offsetX: resolvedAnchor.x - (resolvedAnchor.x - transform.offsetX) * ratio,
      offsetY: resolvedAnchor.y - (resolvedAnchor.y - transform.offsetY) * ratio,
    },
    source,
    window,
    minZoom,
  )
}
