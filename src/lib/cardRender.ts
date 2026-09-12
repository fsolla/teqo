/**
 * S13 — the single canvas renderer shared by the preview and the PNG export:
 * `renderNameCard` draws the master base then the fitted name; `renderPhotoCard`
 * draws the visitor photo full-bleed then the master overlay (the overlay is
 * authoritative — never redraw bands or contra-forms). The context is a
 * structural subset of `CanvasRenderingContext2D` so unit tests drive a fake
 * recorder instead of jsdom canvas.
 */

import { BRAND_FALLBACK_FONT, NAME_CARD_SLOT, type CardModel, type CardRect } from './cardModels'
import {
  fitCardName,
  type CardMeasureText,
  type CardNameFit,
  type CardNameSlot,
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
  fillText(text: string, x: number, y: number): void
  measureText(text: string): CardTextMetrics
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

/**
 * S14 — draws only the fitted name (no base image) so the home tile preview
 * reuses the exact composer geometry. `fit.ok` is the caller's contract: a
 * failed fit never draws (names are never cut silently).
 */
export const drawCardName = (ctx: CardDrawContext, args: CardNameDrawArgs): void => {
  const slot = args.slot ?? NAME_CARD_SLOT
  const { fit } = args

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
