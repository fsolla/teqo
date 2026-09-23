/**
 * S13 — the single canvas renderer shared by the preview and the PNG export:
 * `renderNameCard` draws the master base then the fitted name; `renderPhotoCard`
 * draws the visitor photo full-bleed then the master overlay (the overlay is
 * authoritative — never redraw bands or contra-forms). The context is a
 * structural subset of `CanvasRenderingContext2D` so unit tests drive a fake
 * recorder instead of jsdom canvas.
 */

import {
  COLINHA_CONFIRM_LABEL,
  COLINHA_LAYOUT,
  COLINHA_LEGAL_TEXT,
  colinhaVoteRows,
  fitColinhaCandidate,
} from './cardColinha'
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
import type { StateDeputyCatalogEntry } from './stateDeputyCatalog'

export type CardDrawContext = {
  font: string
  letterSpacing: string
  globalAlpha: number
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
  roundRect(x: number, y: number, width: number, height: number, radii?: number | number[]): void
  clip(): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient
  fill(): void
}

export const createCardMeasure = (
  ctx: Pick<CardDrawContext, 'font' | 'measureText'>,
  fontFamily: string,
  weight = 700,
): CardMeasureText => {
  return (text, fontSize) => {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}, ${BRAND_FALLBACK_FONT}`
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
type TeamCardSubject =
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

export type ColinhaCardRenderArgs = {
  /** Group photo of the top block (`team-card-base.png`). */
  group: CanvasImageSource
  /** Brand lockup of the top-left box (`marca-negativa-completa.png`). */
  lockup: CanvasImageSource
  /** Front art cropped to the red band (`team-card-front.png`). */
  band: CanvasImageSource
  /** The chosen state deputy; `null` draws the empty estadual row. */
  deputy: StateDeputyCatalogEntry | null
  fontFamily: string
  /** The 900-weight measure the colinha draws with. */
  measure: CardMeasureText
}

/** The cap top of the drawn font at `fontSize` (baseline placement of the rows). */
const capAt = (measure: CardMeasureText, fontSize: number): number =>
  measure('X', fontSize).actualBoundingBoxAscent

/**
 * S31 — the top block of the colinha: the group photo cover-cropped, the
 * diagonal two-color brand box with the contained lockup, and the red band
 * cropped from the official front art. Every rect comes from `COLINHA_LAYOUT`
 * (measured from the approved gate).
 */
const drawColinhaTop = (
  ctx: CardDrawContext,
  model: CardModel,
  args: Pick<ColinhaCardRenderArgs, 'group' | 'lockup' | 'band'>,
): void => {
  const { top } = COLINHA_LAYOUT
  const { lockup, band } = top

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, model.width, top.height)
  ctx.clip()

  ctx.fillStyle = top.background
  ctx.fillRect(0, 0, model.width, top.height)
  ctx.drawImage(args.group, 0, top.photoOffsetY, top.photoWidth, top.photoHeight)

  // CSS `linear-gradient(125deg, …)`: the gradient line passes through the box
  // center with the CSS length `|w·sinθ| + |h·cosθ|`.
  const angle = (lockup.gradientAngleDeg * Math.PI) / 180
  const dirX = Math.sin(angle)
  const dirY = -Math.cos(angle)
  const gradientLength = Math.abs(lockup.width * dirX) + Math.abs(lockup.height * dirY)
  const centerX = lockup.x + lockup.width / 2
  const centerY = lockup.y + lockup.height / 2
  const gradient = ctx.createLinearGradient(
    centerX - (dirX * gradientLength) / 2,
    centerY - (dirY * gradientLength) / 2,
    centerX + (dirX * gradientLength) / 2,
    centerY + (dirY * gradientLength) / 2,
  )
  gradient.addColorStop(0, lockup.gradientFrom)
  gradient.addColorStop(lockup.gradientSplit, lockup.gradientFrom)
  gradient.addColorStop(lockup.gradientSplit, lockup.gradientTo)
  gradient.addColorStop(1, lockup.gradientTo)

  ctx.fillStyle = gradient
  ctx.fillRect(lockup.x, lockup.y, lockup.width, lockup.height)

  // `object-fit: contain` inside the box padding (the gate's CSS resolves the
  // percentage padding against the top block, so it is already in pixels here).
  const innerX = lockup.x + lockup.padding
  const innerY = lockup.y + lockup.padding
  const innerWidth = lockup.width - lockup.padding * 2
  const innerHeight = lockup.height - lockup.padding * 2
  const lockupScale = Math.min(innerWidth / lockup.imageWidth, innerHeight / lockup.imageHeight)
  const lockupWidth = lockup.imageWidth * lockupScale
  const lockupHeight = lockup.imageHeight * lockupScale
  ctx.drawImage(
    args.lockup,
    innerX + (innerWidth - lockupWidth) / 2,
    innerY + (innerHeight - lockupHeight) / 2,
    lockupWidth,
    lockupHeight,
  )

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, band.y, model.width, band.height)
  ctx.clip()
  ctx.fillStyle = band.background
  ctx.fillRect(0, band.y, model.width, band.height)
  ctx.drawImage(args.band, 0, band.y - band.sourceY, band.imageWidth, band.imageHeight)
  ctx.restore()
  ctx.restore()
}

/** S31 — the vertical legal line of the left edge (reads bottom-to-top). */
const drawColinhaLegal = (ctx: CardDrawContext, fontFamily: string): void => {
  const { legal } = COLINHA_LAYOUT

  ctx.save()
  ctx.translate(legal.x + legal.width / 2, legal.y + legal.height)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `700 ${legal.fontSize}px ${fontFamily}`
  ctx.letterSpacing = `${legal.letterSpacing}px`
  ctx.fillStyle = legal.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(COLINHA_LEGAL_TEXT, 0, 0)
  ctx.restore()
}

/** S31 — one digit box: the border is the outer rounded rect, the fill the inner one. */
const drawColinhaDigit = (
  ctx: CardDrawContext,
  x: number,
  y: number,
  empty: boolean,
  digit: string,
  fontFamily: string,
): void => {
  const { digit: box } = COLINHA_LAYOUT

  ctx.fillStyle = empty ? box.emptyBorderColor : box.borderColor
  ctx.beginPath()
  ctx.roundRect(x, y, box.width, box.height, box.radius)
  ctx.fill()

  ctx.fillStyle = empty ? box.emptyBackground : box.background
  ctx.beginPath()
  ctx.roundRect(
    x + box.borderWidth,
    y + box.borderWidth,
    box.width - box.borderWidth * 2,
    box.height - box.borderWidth * 2,
    box.radius - box.borderWidth,
  )
  ctx.fill()

  if (empty || !digit) return

  ctx.fillStyle = box.color
  ctx.font = `900 ${box.fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(digit, x + box.width / 2, y + box.height / 2)
}

/** S31 — the green `CONFIRMA` pill, right-aligned on the row. */
const drawColinhaConfirm = (
  ctx: CardDrawContext,
  x: number,
  y: number,
  height: number,
  empty: boolean,
  fontFamily: string,
  measure: CardMeasureText,
): void => {
  const { confirm } = COLINHA_LAYOUT
  const width = measure(COLINHA_CONFIRM_LABEL, confirm.fontSize).width + confirm.paddingX * 2
  const previousAlpha = ctx.globalAlpha

  if (empty) ctx.globalAlpha = confirm.emptyOpacity

  ctx.fillStyle = confirm.background
  ctx.beginPath()
  ctx.roundRect(x - width, y, width, height, height / 2)
  ctx.fill()

  ctx.fillStyle = confirm.color
  ctx.font = `900 ${confirm.fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(COLINHA_CONFIRM_LABEL, x - width / 2, y + height / 2)

  ctx.globalAlpha = previousAlpha
}

/**
 * S31 — the `Minha colinha` slip: white base → top composition (official
 * assets) → vertical legal line → the six vote rows of the gate's grid
 * (`30% | 1fr | auto`, rows of 108, body centered). The estadual row comes from
 * the S30 catalog entry (or the empty placeholder); the five fixed rows are
 * template content and never change.
 */
export const renderColinhaCard = (
  ctx: CardDrawContext,
  model: CardModel,
  args: ColinhaCardRenderArgs,
): void => {
  const { body, row: rowLayout, office, candidate, digit, confirm } = COLINHA_LAYOUT
  const rows = colinhaVoteRows(args.deputy)

  ctx.fillStyle = COLINHA_LAYOUT.background
  ctx.fillRect(0, 0, model.width, model.height)

  drawColinhaTop(ctx, model, args)
  drawColinhaLegal(ctx, args.fontFamily)

  const contentX = body.x + body.paddingX
  const contentWidth = body.width - body.paddingX * 2
  const contentTop = body.y + body.paddingTop
  const contentHeight = body.height - body.paddingTop - body.paddingBottom
  const rowsHeight = rows.length * rowLayout.minHeight + (rows.length - 1) * body.rowGap
  const startY = contentTop + (contentHeight - rowsHeight) / 2
  const officeWidth = contentWidth * rowLayout.officeWidthRatio
  const officeCap = capAt(args.measure, office.fontSize)
  const confirmHeight = confirm.fontSize + confirm.paddingY * 2

  rows.forEach((voteRow, index) => {
    const rowY = startY + index * (rowLayout.minHeight + body.rowGap)
    const candidateFit = fitColinhaCandidate(voteRow.candidate, args.measure, officeWidth)
    const candidateCap = capAt(args.measure, candidateFit.fontSize)
    const officeHeight = voteRow.officeLines.length * office.lineHeight
    const blockHeight =
      officeHeight + candidate.gap + candidateFit.lines.length * candidateFit.fontSize
    const blockTop = rowY + (rowLayout.minHeight - blockHeight) / 2

    ctx.fillStyle = office.color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `900 ${office.fontSize}px ${args.fontFamily}`
    voteRow.officeLines.forEach((line, lineIndex) => {
      ctx.fillText(line, contentX, blockTop + lineIndex * office.lineHeight + officeCap)
    })

    ctx.fillStyle = candidate.color
    ctx.font = `900 ${candidateFit.fontSize}px ${args.fontFamily}`
    candidateFit.lines.forEach((line, lineIndex) => {
      ctx.fillText(
        line,
        contentX,
        blockTop + officeHeight + candidate.gap + candidateCap + lineIndex * candidateFit.fontSize,
      )
    })

    const boxY = rowY + (rowLayout.minHeight - digit.height) / 2
    voteRow.digits.forEach((glyph, digitIndex) => {
      drawColinhaDigit(
        ctx,
        contentX + officeWidth + rowLayout.columnGap + digitIndex * (digit.width + digit.gap),
        boxY,
        voteRow.empty === true,
        glyph,
        args.fontFamily,
      )
    })

    drawColinhaConfirm(
      ctx,
      contentX + contentWidth,
      rowY + (rowLayout.minHeight - confirmHeight) / 2,
      confirmHeight,
      voteRow.empty === true,
      args.fontFamily,
      args.measure,
    )
  })
}
