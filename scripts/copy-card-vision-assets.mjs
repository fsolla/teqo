#!/usr/bin/env node
/**
 * S15 — copies the MediaPipe Vision wasm runtime into `public/cards/mediapipe/`
 * so the card cutout runs 100% same-origin (no CDN executing JS in the
 * visitor's browser; the e2e suite never touches the network).
 *
 * The wasm is a gitignored build artifact: this script runs in `pnpm dev`
 * (preflight), in `pnpm build` (npm `prebuild`) and in the Docker builder
 * before `next build`, so both the dev server and the standalone image serve
 * the files. Idempotent and cheap: a file already present with the same byte
 * size is skipped.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

export const copyCardVisionAssets = async (repoRoot) => {
  const sourceDir = path.join(repoRoot, 'node_modules/@mediapipe/tasks-vision/wasm')
  const targetDir = path.join(repoRoot, 'public/cards/mediapipe/wasm')
  await mkdir(targetDir, { recursive: true })

  for (const name of WASM_FILES) {
    const source = path.join(sourceDir, name)
    const target = path.join(targetDir, name)

    try {
      const [sourceStat, targetStat] = await Promise.all([
        stat(source),
        stat(target).catch(() => null),
      ])
      if (targetStat && targetStat.size === sourceStat.size) continue
      await writeFile(target, await readFile(source))
      console.log(`[copy-card-vision-assets] ${name}`)
    } catch (error) {
      throw new Error(
        `[copy-card-vision-assets] failed to copy ${name}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  await copyCardVisionAssets(repoRoot)
}
