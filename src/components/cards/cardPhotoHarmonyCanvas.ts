/**
 * S17 — browser adapter for the on-device tone harmony of the `Time de você`
 * cutout. Reads the reference tone from the official master (already cached by
 * `loadCardImage`) and the photo's tone through an offscreen canvas — the photo
 * still never leaves the device. The pixel math is pure (`lib/cardPhotoHarmony`);
 * this module only touches canvas/DOM and never mutates the cutout canvas, so
 * toggling the control can always bring the original back.
 */

import { loadCardImage } from '@/components/cards/cardCanvas'
import {
  applyCardPhotoHarmony,
  computeCardHarmonyAdjustment,
  isCardHarmonyIdentity,
  measureCardPhotoTone,
  type CardPhotoTone,
} from '@/lib/cardPhotoHarmony'

const REFERENCE_TONE_CACHE = new WeakMap<HTMLImageElement, CardPhotoTone>()

const measureImageTone = (image: HTMLImageElement): CardPhotoTone | null => {
  const cached = REFERENCE_TONE_CACHE.get(image)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(image, 0, 0)
  const tone = measureCardPhotoTone(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  REFERENCE_TONE_CACHE.set(image, tone)

  return tone
}

/**
 * Returns the harmonized variant of `cutout` (same size, same alpha) or `null`
 * when the reference cannot be read. A photo already on the reference tone
 * returns the `cutout` itself: the identity band means "nothing to adjust".
 */
export const harmonizeCardCutout = async (
  cutout: HTMLCanvasElement,
  referenceSrc: string,
): Promise<HTMLCanvasElement | null> => {
  try {
    const referenceTone = measureImageTone(await loadCardImage(referenceSrc))
    if (!referenceTone) return null

    const ctx = cutout.getContext('2d')
    if (!ctx) return null

    const source = ctx.getImageData(0, 0, cutout.width, cutout.height)
    const adjustment = computeCardHarmonyAdjustment(
      measureCardPhotoTone(source.data),
      referenceTone,
    )
    if (isCardHarmonyIdentity(adjustment)) return cutout

    const harmonized = applyCardPhotoHarmony(source.data, adjustment)
    const canvas = document.createElement('canvas')
    canvas.width = cutout.width
    canvas.height = cutout.height
    const outputCtx = canvas.getContext('2d')
    if (!outputCtx) return null

    const image = outputCtx.createImageData(cutout.width, cutout.height)
    image.data.set(harmonized)
    outputCtx.putImageData(image, 0, 0)

    return canvas
  } catch {
    // Fail closed: the composer hides the control instead of showing a switch
    // with no effect. The pixel math is pure and covered by unit tests.
    return null
  }
}
