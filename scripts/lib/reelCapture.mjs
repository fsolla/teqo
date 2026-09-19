/**
 * C196 — the reel capture: drives the real site in the mobile viewport
 * (deviceScaleFactor 3 + `--force-device-scale-factor=3` → native 1080×1920
 * frames) and records numbered JPEG frames with their wall-clock capture
 * timestamps via CDP screencast. The video is encoded offline from those
 * timestamps (`encodeFrames`), so ffmpeg never backpressures the browser.
 *
 * Why not Playwright's `recordVideo`: it writes fixed-25fps frames ignoring the
 * wall clock (a static tail is dropped and the timeline drifts), which
 * desynchronizes the zoom/cursor driven by the click log. See the implementation
 * plan (Decisão 1, revisada na execução).
 *
 * The synthetic cursor and the target halo are DOM-injected (headless draws no
 * cursor) and therefore captured by the screencast.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from '@playwright/test'

import { REEL } from './reelTimeline.mjs'

export const REEL_VIEWPORT = REEL.viewport
export const REEL_DEVICE_SCALE = REEL.deviceScale

const CURSOR_STYLE_ID = 'reel-cursor-style'
const CURSOR_ID = 'reel-cursor'
const RING_ID = 'reel-ring'
const TICKER_ID = 'reel-ticker'

const CURSOR_SVG =
  '<svg viewBox="0 0 24 30" fill="#ffffff" stroke="#000000" stroke-width="1.4" aria-hidden="true">' +
  '<path d="M3 2v22l6-6 4 9 4-2-4-9h8L3 2Z"/></svg>'

const CURSOR_INIT = `
;(() => {
  const install = () => {
    if (!document.body || document.getElementById('${CURSOR_ID}')) return
    const style = document.createElement('style')
    style.id = '${CURSOR_STYLE_ID}'
    style.textContent = [
      '#${CURSOR_ID}{position:fixed;left:0;top:0;width:28px;height:35px;z-index:2147483647;pointer-events:none;',
      'transition:transform 90ms linear;filter:drop-shadow(0 2px 2px rgb(0 0 0 / 35%));will-change:transform}',
      '#${CURSOR_ID} svg{width:100%;height:100%;display:block}',
      '#${RING_ID}{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #ffeb00;border-radius:16px;',
      'box-shadow:0 0 0 5px rgb(255 235 0 / 20%);opacity:0;transition:opacity 250ms ease-out}',
      '#${RING_ID}.reel-ring-on{opacity:1}',
      '#${RING_ID}.reel-ring-pulse{animation:reel-halo 700ms ease-out 1}',
      '@keyframes reel-halo{0%{transform:scale(.96)}55%{transform:scale(1.02)}100%{transform:scale(1)}}',
      '#${TICKER_ID}{position:fixed;right:0;bottom:0;width:2px;height:2px;background:#fff;opacity:.996;pointer-events:none;z-index:2147483645}',
      '.reel-ticking #${TICKER_ID}{animation:reel-tick 66ms steps(2,end) infinite}',
      '@keyframes reel-tick{0%{opacity:.996}100%{opacity:1}}',
    ].join('')
    document.head.appendChild(style)
    const cursor = document.createElement('div')
    cursor.id = '${CURSOR_ID}'
    cursor.innerHTML = '${CURSOR_SVG}'
    document.body.appendChild(cursor)
    const ticker = document.createElement('div')
    ticker.id = '${TICKER_ID}'
    document.body.appendChild(ticker)
    document.addEventListener(
      'mousemove',
      (event) => {
        cursor.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)'
      },
      { passive: true },
    )
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})()
`

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const launchReelBrowser = () => chromium.launch({ args: ['--force-device-scale-factor=3'] })

export const openReelContext = (browser) =>
  browser.newContext({
    viewport: REEL_VIEWPORT,
    deviceScaleFactor: REEL_DEVICE_SCALE,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  })

export const installCursor = async (page) => {
  await page.addInitScript({ content: CURSOR_INIT })
}

const cursorPositions = new WeakMap()

const cursorPosition = (page) =>
  cursorPositions.get(page) ?? { x: REEL_VIEWPORT.width / 2, y: REEL_VIEWPORT.height / 2 }

/** Smooth DOM-cursor movement: the cursor arrives before the click. */
const moveCursor = async ({ page, x, y, steps = 14, stepMs = 28 }) => {
  const from = cursorPosition(page)
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps
    const nextX = from.x + (x - from.x) * progress
    const nextY = from.y + (y - from.y) * progress
    await page.mouse.move(Math.round(nextX), Math.round(nextY))
    await sleep(stepMs)
  }
  cursorPositions.set(page, { x, y })
}

/** Yellow ring around the clicked target; it pulses once on the click. */
const showTargetRing = async ({ page, box, pulse = false }) => {
  await page.evaluate(
    ({ ringId, box: target, pulse: shouldPulse }) => {
      let ring = document.getElementById(ringId)
      if (!ring) {
        ring = document.createElement('div')
        ring.id = ringId
        document.body.appendChild(ring)
      }
      ring.style.left = `${Math.max(0, target.x - 3)}px`
      ring.style.top = `${Math.max(0, target.y - 3)}px`
      ring.style.width = `${target.width + 6}px`
      ring.style.height = `${target.height + 6}px`
      ring.classList.add('reel-ring-on')
      if (shouldPulse) {
        ring.classList.remove('reel-ring-pulse')
        void ring.offsetWidth
        ring.classList.add('reel-ring-pulse')
      }
    },
    { ringId: RING_ID, box, pulse },
  )
}

const hideTargetRing = (page) =>
  page
    .evaluate(
      (ringId) => document.getElementById(ringId)?.classList.remove('reel-ring-on'),
      RING_ID,
    )
    .catch(() => undefined)

const centerOf = async (locator) => {
  const box = await locator.boundingBox()
  if (!box) return null
  return {
    box,
    x: Math.min(Math.max(box.x + box.width / 2, 4), REEL_VIEWPORT.width - 4),
    y: Math.min(Math.max(box.y + box.height / 2, 4), REEL_VIEWPORT.height - 4),
  }
}

const resolveLocator = async (page, selector) => {
  const locator = page.locator(selector).filter({ visible: true }).first()
  await locator.waitFor({ state: 'visible', timeout: 20000 })
  return locator
}

const waitForEnabled = async (locator, timeoutMs = 12000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await locator.isEnabled().catch(() => false)) return
    if (Date.now() > deadline) throw new Error('Alvo continuou desabilitado.')
    await sleep(120)
  }
}

const pushClick = ({ log, scene, selector, center, zoom, approachAt, arriveAt, at = Date.now() }) =>
  log.push({
    scene,
    kind: 'click',
    at,
    approachAt: approachAt ?? at,
    arriveAt: arriveAt ?? at,
    x: center.x,
    y: center.y,
    zoom,
    target: selector,
  })

const clickTarget = async ({ page, selector, log, scene, zoom }) => {
  const locator = await resolveLocator(page, selector)
  await waitForEnabled(locator)
  await locator.scrollIntoViewIfNeeded()
  const center = await centerOf(locator)
  if (!center) throw new Error(`Cena "${scene}": alvo "${selector}" sem bounding box.`)
  const approachAt = Date.now()
  await moveCursor({ page, x: center.x, y: center.y })
  const arriveAt = Date.now()
  await showTargetRing({ page, box: center.box })
  await sleep(180)
  const at = Date.now()
  pushClick({ log, scene, selector, center, zoom, approachAt, arriveAt, at })
  await page.mouse.click(center.x, center.y)
  await showTargetRing({ page, box: center.box, pulse: true })
  await sleep(250)
  await hideTargetRing(page)
}

const runStep = async ({ page, scene, step, log, fixture }) => {
  if (step.action === 'click') {
    await clickTarget({ page, selector: step.selector, log, scene: scene.id, zoom: step.zoom })
    await sleep(step.pauseMs ?? 650)
    return
  }
  if (step.action === 'fill') {
    const value = step.value ?? fixture.cardName
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Cena "${scene.id}": fill sem valor e sem fixture.cardName.`)
    }
    const locator = await resolveLocator(page, step.selector)
    await locator.scrollIntoViewIfNeeded()
    const center = await centerOf(locator)
    if (!center) throw new Error(`Cena "${scene.id}": campo "${step.selector}" sem bounding box.`)
    await moveCursor({ page, x: center.x, y: center.y })
    await page.mouse.click(center.x, center.y)
    pushClick({ log, scene: scene.id, selector: step.selector, center, zoom: false })
    await page.keyboard.type(value, { delay: 90 })
    await sleep(step.pauseMs ?? 450)
    return
  }
  if (step.action === 'waitFor') {
    await resolveLocator(page, step.selector)
    await sleep(step.pauseMs ?? 450)
    return
  }
  if (step.action === 'download') {
    const locator = await resolveLocator(page, step.selector)
    await waitForEnabled(locator)
    await locator.scrollIntoViewIfNeeded()
    const center = await centerOf(locator)
    if (!center)
      throw new Error(`Cena "${scene.id}": download "${step.selector}" sem bounding box.`)
    const approachAt = Date.now()
    await moveCursor({ page, x: center.x, y: center.y })
    const arriveAt = Date.now()
    await showTargetRing({ page, box: center.box })
    await sleep(180)
    const at = Date.now()
    pushClick({
      log,
      scene: scene.id,
      selector: step.selector,
      center,
      zoom: true,
      approachAt,
      arriveAt,
      at,
    })
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 })
    await page.mouse.click(center.x, center.y)
    await showTargetRing({ page, box: center.box, pulse: true })
    await sleep(250)
    await hideTargetRing(page)
    const download = await downloadPromise
    await download.path()
    await sleep(step.pauseMs ?? 650)
    return
  }
  throw new Error(`Cena "${scene.id}": ação "${step.action}" não implementada.`)
}

/**
 * Forces periodic compositor damage while a scene runs (a 2×2px invisible
 * opacity ticker), so the screencast delivers frames at ~30fps even during
 * holds — without it, a DOM change between frames (the target ring) would only
 * appear in the next damaged frame and the zoom would look late.
 */
const setTicking = (page, on) =>
  page
    .evaluate((ticking) => document.documentElement.classList.toggle('reel-ticking', ticking), on)
    .catch(() => undefined)

/**
 * Drives the recorded capture scenes. `setup` steps run before the scene's
 * `sceneStart` marker (invisible prep), then the visible steps are paced.
 */
export const runCaptureScenes = async ({ page, shotList, log = [] }) => {
  const capture = shotList.scenes.filter((scene) => scene.kind === 'capture')
  for (const scene of capture) {
    for (const step of scene.setup) {
      const locator = await resolveLocator(page, step.selector)
      await locator.scrollIntoViewIfNeeded()
    }
    await sleep(500)
    await setTicking(page, true)
    log.push({ scene: scene.id, kind: 'sceneStart', at: Date.now() })
    await sleep(scene.leadInMs)
    for (const step of scene.steps) {
      await runStep({ page, scene, step, log, fixture: shotList.fixture })
    }
    await sleep(scene.trailOutMs)
    log.push({ scene: scene.id, kind: 'sceneEnd', at: Date.now() })
    await setTicking(page, false)
  }
  return log
}

/**
 * Records the page as numbered JPEG frames plus their capture timestamps (CDP
 * screencast, native 1080×1920 thanks to the forced device scale). The video is
 * built offline from those timestamps, so encoding never backpressures the
 * browser (the pipe version compressed bursts and drifted the timeline).
 * `stop()` forces a final frame so the trailing hold is not truncated.
 */
export const startFrameRecorder = async ({ context, page, framesDir, quality = 90 }) => {
  await rm(framesDir, { recursive: true, force: true })
  await mkdir(framesDir, { recursive: true })
  const frames = []
  let queue = Promise.resolve()
  let writeError = null
  let stopping = false
  const client = await context.newCDPSession(page)
  const enqueue = (buffer, captureMs) => {
    const index = frames.length + 1
    const file = join(framesDir, `frame-${String(index).padStart(5, '0')}.jpg`)
    frames.push({ file, captureMs })
    queue = queue
      .then(() => writeFile(file, buffer))
      .catch((error) => {
        writeError = writeError ?? error
      })
  }
  const onFrame = ({ data, sessionId, metadata }) => {
    if (stopping) return
    enqueue(Buffer.from(data, 'base64'), Math.round(metadata.timestamp * 1000))
    void client.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined)
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality,
    maxWidth: REEL_VIEWPORT.width * REEL_DEVICE_SCALE,
    maxHeight: REEL_VIEWPORT.height * REEL_DEVICE_SCALE,
  })
  return {
    stop: async () => {
      stopping = true
      try {
        const finalFrame = await page.screenshot({ type: 'jpeg', quality })
        enqueue(finalFrame, Date.now())
      } catch {
        // Page closed before the final frame: the recording still ends.
      }
      await client.send('Page.stopScreencast').catch(() => undefined)
      client.off('Page.screencastFrame', onFrame)
      await queue
      if (writeError) throw new Error(`Falha ao gravar frames da captura: ${writeError.message}`)
      return {
        frames: [...frames],
        frameCount: frames.length,
        firstFrameWallMs: frames[0]?.captureMs ?? null,
      }
    },
  }
}

export const gotoReelSite = async ({ page, baseUrl, route }) => {
  const url = new URL(route, baseUrl).toString()
  const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
  if (!response || !response.ok()) {
    throw new Error(
      `Site indisponível: ${url} respondeu ${response ? response.status() : 'sem resposta'}.`,
    )
  }
  await sleep(600)
  return url
}
