/**
 * C196 — Playwright rendering of the reel assets: downloads the site's own
 * Inter/Brexter `@font-face` rules (extracted during the capture) and embeds
 * them as data URIs, renders the transparent caption/chrome overlays and the
 * cover PNG, and records the graphic scenes (hook/CTA) with the same
 * timestamped screencast recorder used for the site capture.
 *
 * No database, no app: the site is visited as an anonymous reader.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { REEL_DEVICE_SCALE, REEL_VIEWPORT, sleep, startFrameRecorder } from './reelCapture.mjs'
import { encodeFrames, PREVIEW_CRF, PREVIEW_PRESET } from './reelFfmpeg.mjs'
import { REEL } from './reelTimeline.mjs'

export const openRenderContext = (browser) =>
  browser.newContext({ viewport: REEL_VIEWPORT, deviceScaleFactor: REEL_DEVICE_SCALE })

/** `@font-face` rules of the loaded site page (URL sources only, no local()). */
export const extractFontFaces = (page) =>
  page.evaluate(() => {
    const faces = []
    for (const sheet of document.styleSheets) {
      let rules
      try {
        rules = [...sheet.cssRules]
      } catch {
        continue
      }
      for (const rule of rules) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        const src = rule.style.getPropertyValue('src')
        if (!src.includes('url(')) continue
        faces.push({
          family: rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, ''),
          weight: rule.style.getPropertyValue('font-weight') || '400',
          style: rule.style.getPropertyValue('font-style') || 'normal',
          unicodeRange: rule.style.getPropertyValue('unicode-range'),
          src,
        })
      }
    }
    return faces
  })

const FONT_FORMATS = [
  ['.woff2', 'woff2'],
  ['.woff', 'woff'],
  ['.ttf', 'truetype'],
]

const formatOf = (url) =>
  FONT_FORMATS.find(([extension]) => url.includes(extension))?.[1] ?? 'woff2'

const remapFamily = (family) => {
  if (/brexter/i.test(family)) return 'ReelBrexter'
  if (/inter/i.test(family)) return 'ReelInter'
  return null
}

const downloadFont = async ({ url, cacheDir, fetchImpl }) => {
  const name = url.split('/').pop().split('?')[0]
  const path = join(cacheDir, name)
  if (existsSync(path)) return readFile(path)
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`fonte ${url} respondeu ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return bytes
}

/**
 * Builds the `@font-face` CSS with the site's own font files embedded as data
 * URIs (relative font URLs resolve against the captured page URL). The brand
 * faces are part of the product surface: if the site serves no Brexter or no
 * Inter face, the render fails closed instead of silently changing the type.
 */
export const loadFontCss = async ({
  fontFaces,
  cacheDir,
  pageUrl,
  fetchImpl = fetch,
  warn = console.warn,
}) => {
  const css = []
  const embedded = new Set()
  for (const face of fontFaces) {
    const family = remapFamily(face.family)
    if (!family) continue
    const src = face.src.match(/url\((?:"|')?([^"')]+)(?:"|')?\)/)?.[1]
    if (!src) continue
    const url = pageUrl ? new URL(src, pageUrl).toString() : src
    try {
      const bytes = await downloadFont({ url, cacheDir, fetchImpl })
      embedded.add(family)
      css.push(
        `@font-face{font-family:${family};font-style:${face.style};font-weight:${face.weight};` +
          `${face.unicodeRange ? `unicode-range:${face.unicodeRange};` : ''}` +
          `src:url(data:font/${formatOf(url)};base64,${bytes.toString('base64')}) format('${formatOf(url)}')}`,
      )
    } catch (error) {
      warn(
        `Reel: falha ao embutir a fonte ${face.family} (${url.split('/').pop()}): ${error.message}`,
      )
    }
  }
  const missing = ['ReelBrexter', 'ReelInter'].filter((family) => !embedded.has(family))
  if (missing.length > 0) {
    throw new Error(
      `O site não serviu as fontes de marca do reel (${missing.join(', ')}). ` +
        'A superfície gráfica depende da Brexter/Inter oficiais; verifique o site e regenere.',
    )
  }
  return css.join('\n')
}

const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  await sleep(80)
}

const renderPng = async ({ page, html, output, transparent = true }) => {
  await page.setContent(html, { waitUntil: 'load' })
  await settle(page)
  await page.screenshot({ path: output, omitBackground: transparent })
  return output
}

/** Transparent PNG asset (captions, chrome) at the physical 1080×1920. */
export const renderOverlay = (options) => renderPng(options)

/** Opaque PNG asset (cover) at the physical 1080×1920. */
export const renderCover = (options) => renderPng({ ...options, transparent: false })

/**
 * Records a graphic scene (hook/CTA): sets the content, waits for the fonts,
 * starts the CSS animation by adding `.play` and records `durationMs`.
 */
export const recordGraphicScene = async ({
  context,
  template,
  html,
  durationMs,
  output,
  framesDir,
  ffmpegBin,
  fps = REEL.fps,
  preset = PREVIEW_PRESET,
  crf = PREVIEW_CRF,
}) => {
  const page = await context.newPage()
  try {
    const recorder = await startFrameRecorder({ context, page, framesDir })
    await page.setContent(html, { waitUntil: 'load' })
    await settle(page)
    await page.evaluate(() => document.body.classList.add('play'))
    const readyAtMs = Date.now()
    await sleep(durationMs)
    const stats = await recorder.stop()
    await encodeFrames({
      ffmpegBin,
      frames: stats.frames,
      listPath: join(framesDir, 'frames.txt'),
      output,
      fps,
      preset,
      crf,
    })
    return { template, output, readyAtMs, stats }
  } finally {
    await page.close()
  }
}
