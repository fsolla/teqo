#!/usr/bin/env node
/**
 * C234 — copies the `@vladmandic/face-api` model weights into
 * `public/fotos/modelos/` so the selfie search runs 100% same-origin (no CDN
 * executing in the visitor's browser; the e2e suite never touches the network).
 *
 * Same contract as `copy-card-vision-assets.mjs` (S15): the models are a
 * gitignored build artifact — this script runs in `pnpm dev` (preflight), in
 * `pnpm build` (npm `prebuild`) and in the Docker builder before `next build`.
 * Idempotent and cheap: a file already present with the same byte size is
 * skipped. The list must match the nets `faceSearchEngine.ts` (browser) and
 * `scripts/lib/faceEngine.mjs` (CLI) load.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const FACE_MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
]

export const copyFaceVisionAssets = async (repoRoot) => {
  const sourceDir = path.join(repoRoot, 'node_modules/@vladmandic/face-api/model')
  const targetDir = path.join(repoRoot, 'public/fotos/modelos')
  await mkdir(targetDir, { recursive: true })

  for (const name of FACE_MODEL_FILES) {
    const source = path.join(sourceDir, name)
    const target = path.join(targetDir, name)

    try {
      const [sourceStat, targetStat] = await Promise.all([
        stat(source),
        stat(target).catch(() => null),
      ])
      if (targetStat && targetStat.size === sourceStat.size) continue
      await writeFile(target, await readFile(source))
      console.log(`[copy-face-vision-assets] ${name}`)
    } catch (error) {
      throw new Error(
        `[copy-face-vision-assets] failed to copy ${name}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  await copyFaceVisionAssets(repoRoot)
}
