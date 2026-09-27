/**
 * C234 — the on-device engine of the selfie search. The visitor's photo never
 * leaves the browser: it is decoded here, resized and run through the SAME
 * face-api nets the CLI uses (same model ids, same detector options), and only
 * the 128-float descriptor is ever sent. The engine is lazily imported — the
 * ~2.6 MB of JS plus the ~7 MB of same-origin models are fetched only when the
 * visitor actually starts the flow.
 *
 * Fail-closed probes come before the download: the bundled TFJS runs on the
 * WebGL backend for speed, and a browser with WebGL disabled would silently
 * crawl on the CPU backend (or blank) — the flow says so up front instead of
 * blaming the selfie. The e2e build replaces the engine with a deterministic
 * stub (`NEXT_PUBLIC_FACE_SEARCH_STUB=1`, `window.__faceSearchStub`), same
 * contract as the card cutout.
 */
import { loadCardPhoto } from '@/components/cards/cardCanvas'
import { supportsWebgl } from '@/components/cards/cardCutout'
import {
  FACE_DETECTOR_INPUT_SIZE,
  FACE_DETECTOR_SCORE_THRESHOLD,
  FACE_MODEL_DIR,
  faceStubDescriptorFromBytes,
} from '@/lib/faceSearch'

declare global {
  interface Window {
    /** Test seam: the e2e build stubs the engine through this flag. */
    __faceSearchStub?: 'ok' | 'slow' | 'error'
  }
}

const STUB_ENABLED = process.env.NEXT_PUBLIC_FACE_SEARCH_STUB === '1'
const STUB_DELAY_MS = 1500

/** Longest edge sent to the engine; the full-resolution photo never goes in. */
const SELFIE_MAX_EDGE = 1024

export type SelfieDescriptorResult =
  | { ok: true; descriptor: number[] }
  | { ok: false; reason: 'unsupported' | 'engine' | 'empty' }

/**
 * Whether this browser can run the local engine. The caller must invoke it on
 * the client (the probe needs `document`); the stub build is always "supported"
 * so the e2e suite exercises the flow, not the capability.
 */
export const supportsFaceSearchEngine = (): boolean => {
  if (STUB_ENABLED) return true

  return supportsWebgl()
}

type FaceApi = typeof import('@vladmandic/face-api')

let facadePromise: Promise<FaceApi> | null = null

/**
 * Loads the three nets once per page: `tinyFaceDetector` finds the faces,
 * `faceLandmark68Net` aligns them and `faceRecognitionNet` produces the 128-d
 * descriptor — the exact trio the CLI loads. A failed load is not cached, so a
 * retry re-attempts the download.
 */
const loadFaceApi = (): Promise<FaceApi> => {
  if (!facadePromise) {
    facadePromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_DIR),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_DIR),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_DIR),
      ])
      return faceapi
    })().catch((error: unknown) => {
      facadePromise = null
      throw error
    })
  }

  return facadePromise
}

const cappedSize = (width: number, height: number) => {
  const longest = Math.max(width, height)
  const scale = longest > SELFIE_MAX_EDGE ? SELFIE_MAX_EDGE / longest : 1

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Descriptor of the LARGEST face in the photo (the person taking the selfie is
 * the one closest to the camera). Resolves `empty` when no face is found — the
 * flow has an honest state for that, never a generic engine error.
 */
export const computeSelfieDescriptor = async (file: File): Promise<SelfieDescriptorResult> => {
  if (STUB_ENABLED) return stubDescriptor(file)

  if (!supportsWebgl()) return { ok: false, reason: 'unsupported' }

  try {
    const faceapi = await loadFaceApi()
    const photo = await loadCardPhoto(file)
    const { width, height } = cappedSize(photo.naturalWidth, photo.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return { ok: false, reason: 'engine' }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(photo, 0, 0, width, height)

    // Let the processing state paint before the synchronous inference.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const results = await faceapi
      .detectAllFaces(
        canvas,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: FACE_DETECTOR_INPUT_SIZE,
          scoreThreshold: FACE_DETECTOR_SCORE_THRESHOLD,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors()
    if (results.length === 0) return { ok: false, reason: 'empty' }

    const largest = results.reduce((best, current) =>
      current.detection.box.area > best.detection.box.area ? current : best,
    )

    return { ok: true, descriptor: Array.from(largest.descriptor) }
  } catch {
    return { ok: false, reason: 'engine' }
  }
}

const readStubMode = (): 'ok' | 'slow' | 'error' => {
  if (typeof window === 'undefined') return 'ok'
  const mode = window.__faceSearchStub

  return mode === 'slow' || mode === 'error' ? mode : 'ok'
}

/**
 * Test seam (`NEXT_PUBLIC_FACE_SEARCH_STUB=1`, e2e builds only): the same bytes
 * always derive the same descriptor, so the spec seeds a subject whose vector
 * equals the fixture's without ever loading a model.
 */
const stubDescriptor = async (file: File): Promise<SelfieDescriptorResult> => {
  const mode = readStubMode()
  await new Promise((resolve) => setTimeout(resolve, mode === 'slow' ? STUB_DELAY_MS : 20))
  if (mode === 'error') return { ok: false, reason: 'engine' }

  const bytes = new Uint8Array(await file.arrayBuffer())
  return { ok: true, descriptor: faceStubDescriptorFromBytes(bytes) }
}
