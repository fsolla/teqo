/**
 * S15 — on-device background removal for the `Time de você` card. The visitor's
 * photo never leaves the browser: the model + wasm are fetched from our own
 * `/cards` static assets and inference runs locally. Kept out of `src/lib`
 * because it touches DOM/worker APIs; the pure framing math stays in
 * `cardPhotoTransform`.
 *
 * Engine: MediaPipe `@mediapipe/tasks-vision` ImageSegmenter with the Apache-2.0
 * `selfie_segmenter.tflite` (float16, 256×256) — no COOP/COEP, single-threaded
 * wasm, lazily imported only when the visitor picks the team model. The
 * `@imgly` packages stay out of the bundle (AGPL + ~40 MB on mobile).
 *
 * S18 — the same runtime also runs the Apache-2.0 `blaze_face_full_range.tflite`
 * FaceDetector (see `blaze_face_full_range.LICENSE.txt`) on the cutout canvas:
 * the largest face feeds the proportional framing. The detector is a second
 * lazy singleton and every detection failure is swallowed into `face: null` so
 * the card never fails or surfaces an error because of it.
 */

import type { Detection, FaceDetector, ImageSegmenter, MPMask } from '@mediapipe/tasks-vision'

import {
  CARD_CUTOUT_ALPHA_THRESHOLD,
  type CardAlphaBbox,
  type CardFaceBox,
} from '@/lib/cardPhotoTransform'

declare global {
  interface Window {
    /** Test seam: the e2e build stubs the engine through this flag. */
    __cardsCutoutStub?: 'ok' | 'slow' | 'error' | 'noface'
  }
}

const WASM_DIR = '/cards/mediapipe/wasm'
const MODEL_URL = '/cards/selfie_segmenter.tflite'
const FACE_MODEL_URL = '/cards/blaze_face_full_range.tflite'
const FACE_MIN_CONFIDENCE = 0.5
const CUTOUT_MAX_EDGE = 1600
const STUB_ENABLED = process.env.NEXT_PUBLIC_CARDS_CUTOUT_STUB === '1'
const STUB_DELAY_MS = 1500
const STUB_PROGRESS = 0.36
/** Upscale target so the synthetic bbox passes the real cutout checks. */
const STUB_MIN_EDGE = 400
/** Synthetic head box of the stub ellipse, as a fraction of its canvas (S18). */
const STUB_FACE_WIDTH_RATIO = 0.3
const STUB_FACE_TOP_RATIO = 0.18

export type CardCutoutProgress = {
  phase: 'download' | 'process'
  /** 0..1 — real bytes while downloading, a coarse step while processing. */
  ratio: number
}

type CardCutoutFailureReason = 'engine' | 'empty'

export type CardCutoutResult =
  | {
      ok: true
      canvas: HTMLCanvasElement
      width: number
      height: number
      bbox: CardAlphaBbox
      /** S18 — largest detected face in canvas pixels; null falls back to S15. */
      face: CardFaceBox | null
    }
  | { ok: false; reason: CardCutoutFailureReason }

/**
 * Removes the background of `file` on this device. Resolves with the cutout
 * canvas + its alpha bbox + the largest detected face (`face: null` when the
 * detector is unavailable or finds none — the composer falls back to the S15
 * framing in silence), or fails with `engine` (decode/inference/asset failure)
 * or `empty` (blank segmentation) — both recoverable in the composer.
 */
export const removeCardPhotoBackground = async (
  file: File,
  onProgress: (progress: CardCutoutProgress) => void,
): Promise<CardCutoutResult> => {
  const report = createProgressReporter(onProgress)

  try {
    return STUB_ENABLED ? await stubCutout(file, report) : await engineCutout(file, report)
  } catch {
    return { ok: false, reason: 'engine' }
  }
}

const PROGRESS_MIN_INTERVAL_MS = 100

/**
 * Streaming a ~12 MB wasm fires a progress event per chunk; without throttle
 * that is hundreds of React updates in one microtask chain (the dev build
 * reports "Maximum update depth exceeded"). One report per 100 ms — always
 * emitting phase changes and completion — keeps the bar honest and the UI calm.
 */
const createProgressReporter = (onProgress: (progress: CardCutoutProgress) => void) => {
  let lastAt = 0
  let lastPhase: CardCutoutProgress['phase'] | null = null

  return (progress: CardCutoutProgress) => {
    const now = Date.now()
    const phaseChanged = progress.phase !== lastPhase
    const finished = progress.ratio >= 1
    if (!phaseChanged && !finished && now - lastAt < PROGRESS_MIN_INTERVAL_MS) return

    lastAt = now
    lastPhase = progress.phase
    onProgress(progress)
  }
}

let segmenterPromise: Promise<ImageSegmenter> | null = null

const loadSegmenter = (onProgress: (progress: CardCutoutProgress) => void) => {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter(onProgress).catch((error: unknown) => {
      segmenterPromise = null
      throw error
    })
  }

  return segmenterPromise
}

const createSegmenter = async (onProgress: (progress: CardCutoutProgress) => void) => {
  const wasmFiles = supportsWasmSimd()
    ? ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']
    : ['vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']
  await prefetchAssets([...wasmFiles.map((name) => `${WASM_DIR}/${name}`), MODEL_URL], onProgress)

  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_DIR)
  const modelAssetBuffer = await fetchModelBuffer(MODEL_URL, 'card-cutout-model')

  return vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer },
    runningMode: 'IMAGE',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
}

const fetchModelBuffer = async (url: string, errorPrefix: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${errorPrefix}:${response.status}`)

  return new Uint8Array(await response.arrayBuffer())
}

let faceDetectorPromise: Promise<FaceDetector> | null = null

const loadFaceDetector = () => {
  if (!faceDetectorPromise) {
    faceDetectorPromise = createFaceDetector().catch((error: unknown) => {
      faceDetectorPromise = null
      throw error
    })
  }

  return faceDetectorPromise
}

const createFaceDetector = async () => {
  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_DIR)
  const modelAssetBuffer = await fetchModelBuffer(FACE_MODEL_URL, 'card-face-model')

  return vision.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer },
    runningMode: 'IMAGE',
    minDetectionConfidence: FACE_MIN_CONFIDENCE,
  })
}

/**
 * S18 — largest face of the cutout canvas, or `null`. Every failure (model
 * fetch, detector creation, inference) is swallowed here on purpose: the
 * proportional framing is an enhancement, so the card must never fail nor show
 * an error because of it — the composer falls back to the S15 framing.
 */
const detectCardFace = async (canvas: HTMLCanvasElement): Promise<CardFaceBox | null> => {
  try {
    const detector = await loadFaceDetector()
    return readLargestFaceBox(detector.detect(canvas).detections)
  } catch {
    return null
  }
}

/**
 * S18 — the visitor's face: the largest detected box, or `null`. Exported for
 * unit tests (the adapter itself is DOM-bound); MediaPipe may omit the box of a
 * degenerate detection, so those are dropped.
 */
export const readLargestFaceBox = (detections: Detection[]): CardFaceBox | null => {
  let largest: CardFaceBox | null = null

  for (const detection of detections) {
    const box = detection.boundingBox
    if (!box || !(box.width > 0) || !(box.height > 0)) continue
    if (!largest || box.width * box.height > largest.width * largest.height) {
      largest = { x: box.originX, y: box.originY, width: box.width, height: box.height }
    }
  }

  return largest
}

/**
 * Streams each asset once so the progress bar reflects real bytes — and warms
 * the HTTP cache for the runtimes that later fetch the same URLs themselves.
 */
const prefetchAssets = async (
  urls: string[],
  onProgress: (progress: CardCutoutProgress) => void,
) => {
  let loadedFiles = 0

  for (const url of urls) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`card-cutout-asset:${response.status}`)
    const size = Number(response.headers.get('content-length')) || 0

    if (!response.body) {
      await response.arrayBuffer()
      loadedFiles += 1
      onProgress({ phase: 'download', ratio: Math.min(1, loadedFiles / urls.length) })
      continue
    }

    const reader = response.body.getReader()
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value?.length ?? 0
      const fileRatio = size > 0 ? Math.min(1, received / size) : 0.5
      onProgress({ phase: 'download', ratio: Math.min(1, (loadedFiles + fileRatio) / urls.length) })
    }
    loadedFiles += 1
    onProgress({ phase: 'download', ratio: Math.min(1, loadedFiles / urls.length) })
  }
}

const engineCutout = async (
  file: File,
  onProgress: (progress: CardCutoutProgress) => void,
): Promise<CardCutoutResult> => {
  const segmenter = await loadSegmenter(onProgress)
  onProgress({ phase: 'process', ratio: 0.5 })

  const bitmap = await createImageBitmap(file)
  const { width, height } = cappedSize(bitmap.width, bitmap.height)

  // Let the processing state paint before the synchronous inference.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const result = segmenter.segment(bitmap)
  let mask: MPMask | null = null
  try {
    mask = result.confidenceMasks?.[0] ?? null
    if (!mask) return { ok: false, reason: 'engine' }

    const canvas = composeCutout(bitmap, width, height, mask)
    const bbox = readAlphaBbox(canvas)
    if (!bbox) return { ok: false, reason: 'empty' }

    const face = await detectCardFace(canvas)
    onProgress({ phase: 'process', ratio: 1 })
    return { ok: true, canvas, width, height, bbox, face }
  } finally {
    mask?.close()
    result.close()
    bitmap.close()
  }
}

const composeCutout = (
  image: ImageBitmap,
  width: number,
  height: number,
  mask: MPMask,
): HTMLCanvasElement => {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = mask.width
  maskCanvas.height = mask.height
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) throw new Error('card-cutout-mask-context')

  const confidence = mask.getAsFloat32Array()
  const maskImage = maskCtx.createImageData(mask.width, mask.height)
  for (let index = 0, alpha = 3; index < confidence.length; index += 1, alpha += 4) {
    const value = confidence[index] ?? 0
    maskImage.data[alpha] = value <= 0 ? 0 : value >= 1 ? 255 : Math.round(value * 255)
  }
  maskCtx.putImageData(maskImage, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('card-cutout-context')

  ctx.drawImage(image, 0, 0, width, height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskCanvas, 0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

const readAlphaBbox = (canvas: HTMLCanvasElement): CardAlphaBbox | null => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { width, height } = canvas
  const pixels = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3] > CARD_CUTOUT_ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

const cappedSize = (width: number, height: number) => {
  const longest = Math.max(width, height)
  const scale = longest > CUTOUT_MAX_EDGE ? CUTOUT_MAX_EDGE / longest : 1

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const supportsWasmSimd = (): boolean => {
  // Minimal wasm module using `v128.const` — validates only where SIMD exists.
  const probe = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
    0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0x1a, 0x0b,
  ])

  try {
    return WebAssembly.validate(probe)
  } catch {
    return false
  }
}

const readStubMode = (): 'ok' | 'slow' | 'error' | 'noface' => {
  if (typeof window === 'undefined') return 'ok'
  const mode = window.__cardsCutoutStub
  return mode === 'slow' || mode === 'error' || mode === 'noface' ? mode : 'ok'
}

/**
 * Test seam (`NEXT_PUBLIC_CARDS_CUTOUT_STUB=1`, e2e builds only): a
 * deterministic cutout with the same shape as the engine result. `slow` keeps
 * the processing state visible; `error` exercises the retry path; `noface`
 * returns no detected face so the S15 fallback framing runs.
 */
const stubCutout = async (
  file: File,
  onProgress: (progress: CardCutoutProgress) => void,
): Promise<CardCutoutResult> => {
  const mode = readStubMode()
  onProgress({ phase: 'download', ratio: mode === 'slow' ? STUB_PROGRESS : 1 })
  await new Promise((resolve) => setTimeout(resolve, mode === 'slow' ? STUB_DELAY_MS : 20))
  if (mode === 'error') return { ok: false, reason: 'engine' }
  onProgress({ phase: 'process', ratio: 0.8 })

  const bitmap = await createImageBitmap(file)
  const capped = cappedSize(bitmap.width, bitmap.height)
  const stubScale = Math.max(1, STUB_MIN_EDGE / Math.max(capped.width, capped.height))
  const width = Math.round(capped.width * stubScale)
  const height = Math.round(capped.height * stubScale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('card-cutout-context')

  ctx.drawImage(bitmap, 0, 0, width, height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.ellipse(width / 2, height / 2, width * 0.45, height * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  bitmap.close()

  const stubFaceSize = Math.round(width * STUB_FACE_WIDTH_RATIO)

  return {
    ok: true,
    canvas,
    width,
    height,
    bbox: { x: 0, y: 0, width, height },
    face:
      mode === 'noface'
        ? null
        : {
            x: Math.round((width - stubFaceSize) / 2),
            y: Math.round(height * STUB_FACE_TOP_RATIO),
            width: stubFaceSize,
            height: stubFaceSize,
          },
  }
}
