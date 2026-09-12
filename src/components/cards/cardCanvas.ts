/**
 * S13 — browser adapters for the card studio. Kept out of `src/lib` because
 * they touch DOM APIs; the pure geometry stays in `cardRender`/`cardNameFit`/
 * `cardPhotoTransform`. Imports of the model assets are cached so reopening a
 * composer never re-downloads the master.
 */

const CARD_IMAGE_CACHE = new Map<string, Promise<HTMLImageElement>>()

export const loadCardImage = (src: string): Promise<HTMLImageElement> => {
  const cached = CARD_IMAGE_CACHE.get(src)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => {
      CARD_IMAGE_CACHE.delete(src)
      reject(new Error(`card-image-load-failed:${src}`))
    }
    image.src = src
  })

  CARD_IMAGE_CACHE.set(src, promise)
  return promise
}

export const loadCardPhoto = (file: File): Promise<HTMLImageElement> =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('card-photo-load-failed'))
    }
    image.src = url
  })

/**
 * Canvas does not wait for CSS fonts: the family must be loaded before
 * measuring. `next/font` hands a family list (primary + generated fallback),
 * and `document.fonts.check` fails closed on the unloaded fallback — so only
 * the primary family is awaited here.
 */
export const ensureCardFont = async (fontFamily: string): Promise<boolean> => {
  if (typeof document === 'undefined' || !document.fonts) return false

  const primaryFamily = fontFamily.split(',')[0]?.trim() || fontFamily

  try {
    const faces = await document.fonts.load(`700 100px ${primaryFamily}`)
    return faces.length > 0
  } catch {
    return false
  }
}

export const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('card-png-unavailable'))
    }, 'image/png')
  })

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const cardFileName = (modelId: string): string => `card-jorge-solla-${modelId}.png`
