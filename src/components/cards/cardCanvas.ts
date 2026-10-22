/**
 * S13/S47 — browser adapters kept out of `src/lib` because they touch DOM
 * APIs. The public card studio is gone (S47); the remaining consumers are the
 * selfie search (`loadCardPhoto`/`supportsWebgl`) and the `/potencial` story
 * canvas (`canvasToPngBlob`/`downloadBlob`). The pure geometry lives in
 * `cardPhotoTransform`.
 */

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
