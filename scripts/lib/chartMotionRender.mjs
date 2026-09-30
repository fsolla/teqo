/**
 * C238 chart motion render: deterministic frame capture (one page, every CSS
 * animation seeked to the frame time and paused) plus the offline H.264 encode
 * with the packaged ffmpeg. Frames live in the gitignored `data/` workdir and
 * are removed after the encode — the MP4 is the only artifact. Real-time
 * recording is never used: the same reasoning of the reel capture applies (a
 * fixed-rate recorder drifts from the clock; here the clock is exact anyway).
 */

import { mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { MOTION_FPS, MOTION_FRAMES } from './chartMotion.mjs'
import { encodeFrames, REEL_CRF, REEL_PRESET, resolveFfmpeg } from './reelFfmpeg.mjs'

/**
 * Numbered PNG frames of the motion document: after `load` every CSS animation
 * is seeked to the frame timestamp and paused, so the frame is exact no matter
 * how fast Chromium renders it.
 *
 * @param {any} browser Chromium from `launchPdfBrowser`
 * @param {{ html: string, width: number, height: number, dir: string, frames?: number, fps?: number }} options
 */
const captureMotionFrames = async (
  browser,
  { html, width, height, dir, frames = MOTION_FRAMES, fps = MOTION_FPS },
) => {
  const page = await browser.newPage()
  try {
    await page.setViewportSize({ width, height })
    await page.setContent(html, { waitUntil: 'load' })
    // Freeze the timeline before anything else: Chromium drops finished CSS
    // animations, and a slow font load would make the first stages unseekable.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.currentTime = 0
        animation.pause()
      }
    })
    await page.evaluate(() => document.fonts.ready)
    const captured = []
    for (let index = 0; index < frames; index += 1) {
      const captureMs = (index * 1000) / fps
      await page.evaluate((time) => {
        for (const animation of document.getAnimations()) {
          animation.currentTime = time
          animation.pause()
        }
      }, captureMs)
      const file = join(dir, `frame-${String(index).padStart(4, '0')}.png`)
      await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width, height } })
      captured.push({ file, captureMs })
    }
    return captured
  } finally {
    await page.close()
  }
}

/**
 * Full local render of one animated chart: resolve ffmpeg (`FFMPEG_PATH` →
 * PATH → packaged), capture the frames into `workDir`, encode and clean up.
 * `resolveFfmpegImpl`/`encodeImpl` are injectable so the CLI spec runs without
 * a real binary.
 *
 * @returns {Promise<{ size: number, source: string }>}
 */
export const renderChartMotion = async ({
  browser,
  html,
  width,
  height,
  outPath,
  workDir,
  frames = MOTION_FRAMES,
  fps = MOTION_FPS,
  resolveFfmpegImpl = resolveFfmpeg,
  encodeImpl = encodeFrames,
}) => {
  await mkdir(workDir, { recursive: true })
  let source = ''
  try {
    const ffmpeg = await resolveFfmpegImpl()
    source = ffmpeg.source
    const captured = await captureMotionFrames(browser, {
      html,
      width,
      height,
      dir: workDir,
      frames,
      fps,
    })
    await encodeImpl({
      ffmpegBin: ffmpeg.bin,
      frames: captured,
      listPath: join(workDir, 'frames.txt'),
      output: outPath,
      fps,
      preset: REEL_PRESET,
      crf: REEL_CRF,
    })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
  const { size } = await stat(outPath)
  return { size, source }
}
