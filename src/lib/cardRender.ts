/**
 * S13 — the single canvas renderer shared by the preview and the PNG export:
 * `renderNameCard` draws the master base then the fitted name; `renderPhotoCard`
 * draws the visitor photo full-bleed then the master overlay (the overlay is
 * authoritative — never redraw bands or contra-forms). The context is a
 * structural subset of `CanvasRenderingContext2D` so unit tests drive a fake
 * recorder instead of jsdom canvas.
 */

import {
  BRAND_FALLBACK_FONT,
  NAME_CARD_SLOT,
  TEAM_CARD_LABEL,
  TEAM_CARD_NAME_SLOT,
  type CardBanner,
  type CardModel,
  type CardNameBannerSlot,
  type CardNameSlot,
  type CardRect,
} from './cardModels'
import {
  fitCardName,
  resolveFontSizeForCapHeight,
  type CardMeasureText,
  type CardNameFit,
  type CardTextMetrics,
} from './cardNameFit'
import {
  cardPhotoDrawRect,
  clampCardPhotoTransform,
  type CardPhotoSize,
  type CardPhotoTransform,
} from './cardPhotoTransform'

export type CardDrawContext = {
  font: string
  fillStyle: string | CanvasGradient | CanvasPattern
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  drawImage(image: CanvasImageSource, dx: number, dy: number, dWidth: number, dHeight: number): void
  fillRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): CardTextMetrics
  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  beginPath(): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void
  rect(x: number, y: number, width: number, height: number): void
  fill(): void
}

export const createCardMeasure = (
  ctx: Pick<CardDrawContext, 'font' | 'measureText'>,
  fontFamily: string,
): CardMeasureText => {
  return (text, fontSize) => {
    ctx.font = `700 ${fontSize}px ${fontFamily}, ${BRAND_FALLBACK_FONT}`
    const metrics = ctx.measureText(text)

    return {
      width: metrics.width,
      actualBoundingBoxAscent: metrics.actualBoundingBoxAscent ?? 0,
      actualBoundingBoxDescent: metrics.actualBoundingBoxDescent ?? 0,
    }
  }
}

export type NameCardRenderArgs = {
  image: CanvasImageSource
  name: string
  fontFamily: string
  measure: CardMeasureText
  slot?: CardNameSlot
}

export type CardNameDrawArgs = {
  fit: Extract<CardNameFit, { ok: true }>
  fontFamily: string
  slot?: CardNameSlot
}

type CardBannerDrawArgs = {
  banner: CardBanner
  /** S16 — the drawn width: the model width, or the resolved dynamic one. */
  width: number
  text: string
  fill: string
  fontSize: number
  capHeight: number
  fontFamily: string
}

/**
 * S16 — resolves the name banner width from the measured ink: the model's
 * reference width while the ink fits `width - padding` (= 470), then growing
 * with the ink so the model's side padding (`maxWidth - maxInkWidth` = 39) is
 * preserved, never past the ceiling. Assumes `maxWidth >= width` (fixed
 * banners use equal values and resolve to themselves).
 */
export const resolveCardBannerWidth = (
  slot: Pick<CardNameBannerSlot, 'banner' | 'maxInkWidth'>,
  inkWidth: number,
): number => {
  const { banner } = slot
  const padding = banner.maxWidth - slot.maxInkWidth

  return Math.max(banner.width, Math.min(banner.maxWidth, inkWidth + padding))
}

/**
 * S15 — draws one official top banner: the rotated rectangle plus its centered
 * cap-height text. Both team banners (the fixed `TIME DE` label and the fitted
 * name) share this so the measured geometry lives once.
 */
const drawCardBanner = (ctx: CardDrawContext, args: CardBannerDrawArgs): void => {
  const { banner } = args
  const width = args.width ?? banner.width

  ctx.save()
  ctx.translate(banner.centerX, banner.centerY)
  ctx.rotate((banner.rotationDeg * Math.PI) / 180)
  ctx.fillStyle = banner.background
  ctx.fillRect(-width / 2, -banner.height / 2, width, banner.height)
  ctx.font = `700 ${args.fontSize}px ${args.fontFamily}`
  ctx.fillStyle = args.fill
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(args.text, 0, args.capHeight / 2)
  ctx.restore()
}

/**
 * S14/S15 — draws only the fitted name (no base image) so the home tile preview
 * reuses the exact composer geometry. `fit.ok` is the caller's contract: a
 * failed fit never draws (names are never cut silently). Left slots draw on the
 * master's border; the team slot draws the blue banner + centered name.
 */
export const drawCardName = (ctx: CardDrawContext, args: CardNameDrawArgs): void => {
  const slot = args.slot ?? NAME_CARD_SLOT
  const { fit } = args

  if (slot.align === 'center') {
    drawCardBanner(ctx, {
      banner: slot.banner,
      width: resolveCardBannerWidth(slot, fit.inkWidth),
      text: fit.lines[0],
      fill: slot.fill,
      fontSize: fit.fontSize,
      capHeight: fit.capHeight,
      fontFamily: args.fontFamily,
    })
    return
  }

  ctx.font = `700 ${fit.fontSize}px ${args.fontFamily}`
  ctx.fillStyle = slot.fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  if (fit.lines.length === 1) {
    ctx.fillText(fit.lines[0], slot.leftX, slot.capTop + fit.capHeight)
    return
  }

  const availableHeight = slot.maxBlockBottom - slot.capTop
  const blockHeight = fit.lineHeight + fit.capHeight
  const blockTop = slot.capTop + Math.max(0, (availableHeight - blockHeight) / 2)

  fit.lines.forEach((line, index) => {
    ctx.fillText(line, slot.leftX, blockTop + fit.capHeight + index * fit.lineHeight)
  })
}

export const renderNameCard = (
  ctx: CardDrawContext,
  model: CardModel,
  args: NameCardRenderArgs,
): CardNameFit => {
  const slot = args.slot ?? NAME_CARD_SLOT
  ctx.drawImage(args.image, 0, 0, model.width, model.height)

  const fit = fitCardName(args.name, args.measure, slot)
  if (!fit.ok) return fit

  drawCardName(ctx, { fit, fontFamily: args.fontFamily, slot })

  return fit
}

export type PhotoCardRenderArgs = {
  photo: CanvasImageSource
  frame: CanvasImageSource
  photoSize: CardPhotoSize
  frameSize: CardPhotoSize
  window: CardRect
  transform: CardPhotoTransform
}

export const renderPhotoCard = (
  ctx: CardDrawContext,
  args: PhotoCardRenderArgs,
): CardPhotoTransform => {
  const rect = cardPhotoDrawRect(args.transform, args.photoSize, args.window)
  ctx.drawImage(args.photo, rect.x, rect.y, rect.width, rect.height)
  ctx.drawImage(args.frame, 0, 0, args.frameSize.width, args.frameSize.height)

  return clampCardPhotoTransform(args.transform, args.photoSize, args.window)
}

/** S30 — silhouette tone ported from the design gate's visitor placeholder. */
export const CARD_VISITOR_SILHOUETTE_FILL = '#001a42'

/**
 * S30 — the pre-photo state of the state-deputy model: the visitor placeholder
 * of the design gate drawn over the deputy art (head circle + shoulder dome),
 * normalized on the photo window so every art uses the same ruler. The shape
 * mirrors the design's CSS (head = 34% of the window width at the top; shoulders
 * = full width, 72% of the height with their base 3% past the window bottom, so
 * the front overlay covers the seam). The gate's small bottom corner radius
 * (10%) is deliberately omitted: it falls entirely behind the front overlay.
 */
export const drawCardVisitorSilhouette = (ctx: CardDrawContext, window: CardRect): void => {
  const centerX = window.x + window.width / 2
  const headRadius = window.width * 0.17
  const shoulderHeight = window.height * 0.72
  const shoulderBottom = window.y + window.height * 1.03
  const shoulderTop = shoulderBottom - shoulderHeight
  const domeRadiusX = window.width * 0.48
  const domeRadiusY = shoulderHeight * 0.48
  const bodyTop = shoulderTop + domeRadiusY

  ctx.fillStyle = CARD_VISITOR_SILHOUETTE_FILL

  ctx.beginPath()
  ctx.arc(centerX, window.y + headRadius, headRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.rect(window.x, bodyTop, window.width, shoulderBottom - bodyTop)
  ctx.ellipse(centerX, bodyTop, domeRadiusX, domeRadiusY, 0, Math.PI, 0)
  ctx.fill()
}

/** S30 — the foreground subject of a team composition. */
export type TeamCardSubject =
  | {
      kind: 'photo'
      photo: CanvasImageSource
      photoSize: CardPhotoSize
      transform: CardPhotoTransform
    }
  | { kind: 'silhouette' }

export type TeamCardRenderArgs = {
  base: CanvasImageSource
  overlay: CanvasImageSource
  subject: TeamCardSubject
  window: CardRect
  name: string
  fontFamily: string
  measure: CardMeasureText
  slot?: CardNameBannerSlot
}

export type TeamCardRenderResult = {
  fit: CardNameFit
  /** The clamped photo transform; `null` for the silhouette subject. */
  transform: CardPhotoTransform | null
}

/**
 * S15/S30 — the team card composition, in the measured order: master base →
 * foreground subject (the framed cutout photo, or the visitor silhouette of the
 * state-deputy pre-photo state) → master front overlay → `TIME DE` banner →
 * blue name banner (only when the name fits; never cut silently). The two
 * banners are drawn by the renderer because neither master carries them.
 */
export const renderTeamCard = (
  ctx: CardDrawContext,
  model: CardModel,
  args: TeamCardRenderArgs,
): TeamCardRenderResult => {
  ctx.drawImage(args.base, 0, 0, model.width, model.height)

  let transform: CardPhotoTransform | null = null
  if (args.subject.kind === 'photo') {
    const rect = cardPhotoDrawRect(args.subject.transform, args.subject.photoSize, args.window)
    ctx.drawImage(args.subject.photo, rect.x, rect.y, rect.width, rect.height)
    transform = clampCardPhotoTransform(args.subject.transform, args.subject.photoSize, args.window)
  } else {
    drawCardVisitorSilhouette(ctx, args.window)
  }

  ctx.drawImage(args.overlay, 0, 0, model.width, model.height)

  drawCardBanner(ctx, {
    banner: TEAM_CARD_LABEL,
    width: TEAM_CARD_LABEL.width,
    text: TEAM_CARD_LABEL.text,
    fill: TEAM_CARD_LABEL.fill,
    fontSize: resolveFontSizeForCapHeight(args.measure, TEAM_CARD_LABEL.capHeight),
    capHeight: TEAM_CARD_LABEL.capHeight,
    fontFamily: args.fontFamily,
  })

  const slot = args.slot ?? TEAM_CARD_NAME_SLOT
  const fit = fitCardName(args.name, args.measure, slot)
  if (fit.ok) drawCardName(ctx, { fit, fontFamily: args.fontFamily, slot })

  return { fit, transform }
}
