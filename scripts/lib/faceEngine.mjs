/**
 * C234 — the Node face engine of the maintenance CLIs: the SAME face-api nets
 * the visitor's browser loads (`tinyFaceDetector` + `faceLandmark68Net` +
 * `faceRecognitionNet`), with the same options, so a descriptor computed by the
 * enrollment/index CLI is comparable with the one computed on the device. The
 * wasm backend is the package's own Node pairing (`face-api.node-wasm.js` +
 * `@tensorflow/tfjs-backend-wasm`) — no native `tfjs-node` build, no headless
 * browser, no network.
 *
 * The engine only turns prepared pixels into descriptors; the caller owns the
 * image preparation (`prepareFaceImage`) and the distance math
 * (`src/lib/faceSearch.ts`). It is a manual smoke dependency, never in the
 * test suite (the suites inject a stub analyzer).
 */
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

/**
 * Loads the nets once per process. Throws a named error when the wasm assets or
 * the models are missing — a broken install must fail before any DB write.
 *
 * @param {string} repoRoot
 */
export const createNodeFaceEngine = async (repoRoot) => {
  const { FACE_DETECTOR_INPUT_SIZE, FACE_DETECTOR_SCORE_THRESHOLD } =
    await import('../../src/lib/faceSearch.ts')

  let faceapi
  try {
    // The tfjs runtime is required explicitly first: it is the exact instance
    // the node-wasm build and the wasm backend register against (same module
    // cache), and it keeps the dependency honest for the static checks.
    require('@tensorflow/tfjs')
    faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js')
    const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm')
    setWasmPaths(path.join(repoRoot, 'node_modules/@tensorflow/tfjs-backend-wasm/dist/'))
  } catch (error) {
    throw new Error(
      `engine indisponível (instale @vladmandic/face-api e @tensorflow/tfjs-backend-wasm): ${
        error instanceof Error ? error.message : error
      }`,
    )
  }

  const tf = faceapi.tf
  await tf.setBackend('wasm')
  await tf.ready()

  const modelDir = path.join(repoRoot, 'node_modules/@vladmandic/face-api/model')
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir)

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: FACE_DETECTOR_INPUT_SIZE,
    scoreThreshold: FACE_DETECTOR_SCORE_THRESHOLD,
  })

  return {
    /**
     * Descriptors of every detected face, in detection order.
     * @param {{ pixels: Uint8Array, width: number, height: number }} image
     * @returns {Promise<number[][]>}
     */
    detectPixels: async ({ pixels, width, height }) => {
      const tensor = tf.tensor3d(
        new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
        [height, width, 3],
        'int32',
      )
      try {
        const results = await faceapi
          .detectAllFaces(tensor, options)
          .withFaceLandmarks()
          .withFaceDescriptors()
        return results.map((result) => Array.from(result.descriptor))
      } finally {
        tensor.dispose()
      }
    },
  }
}
