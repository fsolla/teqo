/**
 * S17 — pure tone math for the `Time de você` card: brings the visitor's cutout
 * photo closer to the official candidate photos in brightness, contrast and
 * saturation. No DOM here (the browser adapter lives in
 * `components/cards/cardPhotoHarmonyCanvas`), no hue/white balance and no skin
 * retouch — only the three measured channels, clamped to a mild range so the
 * result never reads as a preset filter. The alpha channel is always copied
 * byte-for-byte: the cutout mask is untouchable.
 */

import { CARD_CUTOUT_ALPHA_THRESHOLD } from './cardPhotoTransform'

export type CardPhotoTone = {
  /** Rec.709 luma mean (0..1) over the pixels above the alpha threshold. */
  meanLuma: number
  /** Population standard deviation of the luma (0..1). */
  sdLuma: number
  /** Mean HSV saturation `(max-min)/max` (0..1); 0 when a pixel is black. */
  meanSaturation: number
  /** Sampled pixel count; 0 when every pixel is below the alpha threshold. */
  samples: number
}

export type CardHarmonyAdjustment = {
  brightness: number
  contrast: number
  saturation: number
}

/** Fixed mild deltas (≤ 12%): the adjustment harmonizes, it does not filter. */
export const CARD_HARMONY_LIMITS = {
  brightness: { min: 0.94, max: 1.08 },
  contrast: { min: 0.94, max: 1.08 },
  saturation: { min: 0.9, max: 1.12 },
} as const

/** Inside this band the adjustment is a no-op: the photo is already on tone. */
export const CARD_HARMONY_IDENTITY_EPSILON = 0.02

const IDENTITY_ADJUSTMENT: CardHarmonyAdjustment = Object.freeze({
  brightness: 1,
  contrast: 1,
  saturation: 1,
})

const LUMA_RED = 0.2126
const LUMA_GREEN = 0.7152
const LUMA_BLUE = 0.0722

const MID_RANGE = 127.5

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const lumaOf = (red: number, green: number, blue: number): number =>
  LUMA_RED * red + LUMA_GREEN * green + LUMA_BLUE * blue

/**
 * S17 — measures the tone of an RGBA buffer. Fully transparent pixels are not
 * evidence of tone, so they stay out of the sample (same alpha floor as the
 * cutout bbox): a blank segmentation measures `samples: 0` instead of black.
 */
export const measureCardPhotoTone = (data: Uint8ClampedArray): CardPhotoTone => {
  let samples = 0
  let lumaSum = 0
  let lumaSquaredSum = 0
  let saturationSum = 0

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= CARD_CUTOUT_ALPHA_THRESHOLD) continue

    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const luma = lumaOf(red, green, blue) / 255
    const max = Math.max(red, green, blue)

    samples += 1
    lumaSum += luma
    lumaSquaredSum += luma * luma
    saturationSum += max === 0 ? 0 : (max - Math.min(red, green, blue)) / max
  }

  if (samples === 0) return { meanLuma: 0, sdLuma: 0, meanSaturation: 0, samples: 0 }

  const meanLuma = lumaSum / samples
  return {
    meanLuma,
    sdLuma: Math.sqrt(Math.max(0, lumaSquaredSum / samples - meanLuma * meanLuma)),
    meanSaturation: saturationSum / samples,
    samples,
  }
}

const factorFrom = (
  reference: number,
  source: number,
  limit: { min: number; max: number },
): number => {
  if (!Number.isFinite(reference) || !Number.isFinite(source) || source <= 0) return 1

  const factor = reference / source
  return Number.isFinite(factor) ? clamp(factor, limit.min, limit.max) : 1
}

/**
 * S17 — the three factors that bring `source` toward `reference`, each clamped.
 * A degenerate source stat (flat tone, zero saturation, empty sample) keeps its
 * factor at 1 instead of amplifying noise; an empty reference is identity.
 */
export const computeCardHarmonyAdjustment = (
  source: CardPhotoTone,
  reference: CardPhotoTone,
): CardHarmonyAdjustment => {
  if (source.samples === 0 || reference.samples === 0) return IDENTITY_ADJUSTMENT

  return {
    brightness: factorFrom(reference.meanLuma, source.meanLuma, CARD_HARMONY_LIMITS.brightness),
    contrast: factorFrom(reference.sdLuma, source.sdLuma, CARD_HARMONY_LIMITS.contrast),
    saturation: factorFrom(
      reference.meanSaturation,
      source.meanSaturation,
      CARD_HARMONY_LIMITS.saturation,
    ),
  }
}

export const isCardHarmonyIdentity = (adjustment: CardHarmonyAdjustment): boolean =>
  Math.abs(adjustment.brightness - 1) <= CARD_HARMONY_IDENTITY_EPSILON &&
  Math.abs(adjustment.contrast - 1) <= CARD_HARMONY_IDENTITY_EPSILON &&
  Math.abs(adjustment.saturation - 1) <= CARD_HARMONY_IDENTITY_EPSILON

/**
 * S17 — applies the adjustment in one pass, in a fixed order (brightness →
 * contrast → saturation) and with the pixel luma recomputed after the first two
 * so saturation pivots on the corrected color. Returns a new buffer; `alpha`
 * bytes are copied untouched.
 */
export const applyCardPhotoHarmony = (
  data: Uint8ClampedArray,
  adjustment: CardHarmonyAdjustment,
): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(data.length)
  const { brightness, contrast, saturation } = adjustment

  for (let index = 0; index < data.length; index += 4) {
    output[index + 3] = data[index + 3]

    const brightRed = data[index] * brightness
    const brightGreen = data[index + 1] * brightness
    const brightBlue = data[index + 2] * brightness
    const correctedRed = (brightRed - MID_RANGE) * contrast + MID_RANGE
    const correctedGreen = (brightGreen - MID_RANGE) * contrast + MID_RANGE
    const correctedBlue = (brightBlue - MID_RANGE) * contrast + MID_RANGE
    const luma = lumaOf(correctedRed, correctedGreen, correctedBlue)

    output[index] = Math.round(luma + (correctedRed - luma) * saturation)
    output[index + 1] = Math.round(luma + (correctedGreen - luma) * saturation)
    output[index + 2] = Math.round(luma + (correctedBlue - luma) * saturation)
  }

  return output
}
