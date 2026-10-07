/**
 * Reel "Sua colinha para 2026" — the deterministic builder of the chat reel
 * (`data/reels/colinha-time-1313/reel.mp4` + `capa.png` + `metadata.json`).
 *
 * Pipeline: the script/timeline (`colinhaReel.mjs`, pure) → the HTML template
 * (`colinhaReelTemplate.mjs`, fonts and images inlined as data URIs) → Chromium
 * at 540×960 @2x, one screenshot per frame with the page state driven solely by
 * `window.colinhaRender(tMs)` (no CSS animation → no drift) → `encodeFrames`
 * (H.264, yuv420p, 30 fps, 1080×1920) → the cover (a designed 4:5 crop of a
 * chosen reel moment) → the package metadata.
 *
 * The Facebook/Meta-owned brand assets of the reference reel never enter here:
 * the piece carries only the campaign's own kit (public/) and the official
 * candidate photos committed under `scripts/reels/assets/<slug>/`.
 *
 * Usage:
 *   node scripts/build-colinha-reel.mjs [--out-dir=…] [--work-dir=…] [--fps=30]
 *     [--preview] [--dry-run] [--preview-frames=1200,3400] [--keep-frames]
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'

import { dieWithLabel, parseEqualsFlags, sha256Hex } from './lib/cli.mjs'
import {
  buildColinhaBeats,
  buildColinhaTimeline,
  COLINHA_BEAT_DURATIONS,
  COLINHA_CANDIDATES,
  COLINHA_GENERIC_ESTADUAL,
  COLINHA_REEL,
} from './lib/colinhaReel.mjs'
import { colinhaFontCss, colinhaReelHtml } from './lib/colinhaReelTemplate.mjs'
import {
  encodeFrames,
  PREVIEW_CRF,
  PREVIEW_PRESET,
  REEL_CRF,
  REEL_PRESET,
  resolveFfmpeg,
  runFfmpeg,
} from './lib/reelFfmpeg.mjs'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-colinha-reel'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'data/reels'
const DEFAULT_WORK_DIR = 'data/reels/.work'
const ASSETS_DIR = join(ROOT, 'scripts/reels/assets', COLINHA_REEL.slug)
const BRAND_FONT = join(ROOT, 'src/app/(frontend)/fonts/Brexter-Bold.ttf')
const INTER_FONT = join(ASSETS_DIR, 'fonts/inter-latin.woff2')
const ARIMO_FONT = join(process.env.HOME ?? '', '.local/share/fonts/Arimo-Regular.woff2')
const COLINHA_ART = join(ROOT, 'public/cards/modelo-colinha.jpeg')
/** The official Lula mark, shown by the "sem estadual" card. */
const LULA_MARK = join(ROOT, 'public/Marca-Lula.webp')
const JULIO_LOCKUP_SOURCE = join(ROOT, 'public/cards/estaduais/julio-base.webp')
const GROUP_SOURCE = join(ROOT, 'public/cards/estaduais/julio-fotos.webp')
/** The urna "confirma" beeps played when each vote card appears (`--beeps`). */
const CONFIRMA_SFX = join(ASSETS_DIR, 'sfx-confirma.mp3')
/** The campaign jingle bed, very low, from the video's 0:04 (`--beeps`). */
const JINGLE = join(ASSETS_DIR, 'jingle-play.mp3')
const DEFAULT_SITE_URL = 'https://jorgesolla1313.com.br'
/** The state deputy the site's personalized slip is rendered with. */
const SITE_CARD_DEPUTY = 'Julio Pinheiro'
const VIEWPORT = { width: 540, height: 960 }
const DEVICE_SCALE = 2
const COVER_VIEWPORT = { width: 540, height: 675 }

const USAGE = `Uso: node scripts/build-colinha-reel.mjs [--out-dir=…] [--work-dir=…] [--fps=30]
  [--finale=motion,static,card] [--base-url=…] [--preview] [--dry-run]
  [--preview-frames=1200,3400] [--keep-frames]
  [--estadual-name=… --estadual-number=… --estadual-photo=… --site-deputy=… --out-slug=…]
  [--beeps] [--audio-only]`

const dataUri = (buffer, mime) => `data:${mime};base64,${buffer.toString('base64')}`

const requireFile = async (path, hint) => {
  if (!existsSync(path)) die(`fonte/ativo ausente: ${path}\n${hint}`)
  return readFile(path)
}

const buildAssets = async (candidates = COLINHA_CANDIDATES) => {
  const assets = {}
  for (const candidate of candidates) {
    if (candidate.photoPath) {
      // A dobradinha's own cutout (the Plenária/estúdio source): normalised to
      // the reel's asset shape (trimmed, 1000 px tall, webp) in memory.
      const buffer = await sharp(
        await requireFile(
          candidate.photoPath,
          'A foto da dobradinha não existe no caminho indicado.',
        ),
      )
        .trim({ threshold: 8 })
        .resize({ height: 1000, fit: 'inside' })
        .webp({ quality: 88 })
        .toBuffer()
      assets[`photo:${candidate.id}`] = dataUri(buffer, 'image/webp')
      continue
    }
    if (!candidate.photo) continue
    const file = join(ASSETS_DIR, candidate.photo)
    const buffer = await requireFile(
      file,
      `As fotos do reel vivem em scripts/reels/assets/${COLINHA_REEL.slug}/ (ver README.md de lá).`,
    )
    assets[`photo:${candidate.id}`] = dataUri(buffer, 'image/webp')
  }
  if (candidates.some((candidate) => candidate.generic)) {
    const mark = await requireFile(
      LULA_MARK,
      'A marca oficial de Lula vive em public/Marca-Lula.webp.',
    )
    assets.lulaMark = dataUri(
      await sharp(mark)
        .trim({ threshold: 8 })
        .resize({ width: 640, fit: 'inside' })
        .webp({ quality: 92 })
        .toBuffer(),
      'image/webp',
    )
  }
  const avatar = await requireFile(
    join(ASSETS_DIR, 'logo-o.webp'),
    'A logo "O" da rádio (kit oficial) é derivada para os assets do reel.',
  )
  assets.avatar = dataUri(avatar, 'image/webp')

  const colinhaArt = await sharp(
    await requireFile(
      COLINHA_ART,
      'A arte da colinha é o ativo oficial do site (public/cards/modelo-colinha.jpeg).',
    ),
  )
    .resize(1080, 1920)
    .jpeg({ quality: 92 })
    .toBuffer()
  assets.colinhaArt = dataUri(colinhaArt, 'image/jpeg')

  const art = await readArtRaw()
  assets.waveClip = buildWaveClip(art)
  assets.bandClip = buildBandClip(art)
  assets.titlePatch = dataUri(await buildTitlePatch(), 'image/png')

  // The end screen's group is the official photo of the "Time de você" card
  // family: one shot, everyone at the same scale — the sharp image is the base
  // and each candidate's blurred patch fades out at their reveal.
  const group = await requireFile(
    GROUP_SOURCE,
    'A foto do grupo da cena final é o fundo oficial da dobradinha (public/cards/estaduais/julio-fotos.webp).',
  )
  assets.group = dataUri(await sharp(group).jpeg({ quality: 92 }).toBuffer(), 'image/jpeg')
  assets.groupBlur = dataUri(
    await sharp(group)
      .blur(26)
      .modulate({ brightness: 0.98, saturation: 0.92 })
      .jpeg({ quality: 88 })
      .toBuffer(),
    'image/jpeg',
  )

  const bandLogos = await extractBandLogos()
  for (const [id, buffer] of Object.entries(bandLogos)) {
    if (process.env.COLINHA_DEBUG_LOGOS) await writeFile(`/tmp/opencode/band-${id}.webp`, buffer)
    assets[`logo:${id}`] = dataUri(buffer, 'image/webp')
  }

  return assets
}

/** The colinha art as raw RGBA at the reel's 1080×1920 output size. */
const readArtRaw = async () => {
  const art = await requireFile(
    COLINHA_ART,
    'A arte da colinha é o ativo oficial do site (public/cards/modelo-colinha.jpeg).',
  )
  return sharp(art).resize(1080, 1920).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

const isWave = (r, g, b) => (r > 200 && g > 175 && b < 135) || (g > 105 && r < 125 && b < 150)

/**
 * The crest of the yellow/green wave, per column, as a `clip-path` polygon on
 * the 540×960 stage: everything above it belongs to the sky/group band, so the
 * composed sky and the candidate figures stay behind the art's own wave.
 */
const buildWaveClip = ({ data, info }) => {
  const { width, channels } = info
  const points = []
  for (let x = 0; x <= width; x += 20) {
    const column = Math.min(width - 1, x)
    let top = 600
    for (let y = 540; y < 760; y++) {
      const i = (y * width + column) * channels
      if (isWave(data[i], data[i + 1], data[i + 2])) {
        top = y
        break
      }
    }
    points.push([column / 2, top / 2 + 4])
  }
  const polygon = [
    '0px 0px',
    ...points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`),
    '540px 0px',
  ]
  return `polygon(${polygon.join(',')})`
}

/**
 * The red-band logos of the end scene, lifted from the official overlay art
 * (which carries them with real alpha). Everything above the band's own top
 * edge is cut per column — the overlay's yellow/green wave never leaks in —
 * and the band red is kept, so a logo sits seamlessly anywhere on the band.
 */
/**
 * The band's own top edge per column, as a `clip-path` polygon: the red cover
 * that hides the art's baked lockups/marks is shaped by it, so the coloured
 * crest of the original band (yellow/green waves) is never covered.
 */
const buildBandClip = ({ data, info }) => {
  const { width, channels } = info
  const points = []
  for (let x = 0; x <= width; x += 20) {
    const column = Math.min(width - 1, x)
    let top = 640
    for (let y = 560; y < 900; y++) {
      const i = (y * width + column) * channels
      if (Math.hypot(data[i] - 229, data[i + 1] - 14, data[i + 2] - 47) < 60) {
        top = y
        break
      }
    }
    points.push([column / 2, top / 2])
  }
  const polygon = [
    ...points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`),
    '540px 435px',
    '0px 435px',
  ]
  return `polygon(${polygon.join(',')})`
}

/**
 * The slip's own title ("MAIS SAÚDE MAIS FUTURO", baked in the art) with a
 * feathered edge: it fades in over the group photo when the slip is complete.
 */
const buildTitlePatch = async () => {
  const { data, info } = await sharp(
    await requireFile(COLINHA_ART, 'A arte da colinha é o ativo oficial do site.'),
  )
    .resize(1080, 1920)
    .ensureAlpha()
    .extract({ left: 180, top: 10, width: 720, height: 270 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const feather = 56
  const ramp = (d) => Math.max(0, Math.min(1, d / feather))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const a = Math.min(ramp(x), ramp(width - 1 - x), ramp(y), ramp(height - 1 - y))
      data[i + 3] = Math.round(data[i + 3] * a)
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

const extractBandLogos = async () => {
  const bandRed = [229, 14, 47]
  const dist = (r, g, b) => Math.hypot(r - bandRed[0], g - bandRed[1], b - bandRed[2])

  /**
   * The band's own span: its top edge per column (the wave curves) and the
   * first row of the art's white slip below it (a global row, since that edge
   * is straight) — so nothing outside the band survives a crop.
   */
  const bandBounds = ({ data, info }) => {
    const { width, channels } = info
    const top = new Int32Array(width).fill(-1)
    for (let x = 0; x < width; x++) {
      for (let y = 560; y < Math.min(1100, info.height - 1); y++) {
        let red = true
        for (let k = 0; k < 6; k++) {
          const i = ((y + k) * width + x) * channels
          const opaque = channels < 4 || data[i + 3] > 200
          if (!opaque || dist(data[i], data[i + 1], data[i + 2]) > 90) {
            red = false
            break
          }
        }
        if (red) {
          top[x] = y
          break
        }
      }
    }
    let bottom = info.height
    for (let y = 700; y < Math.min(1100, info.height); y++) {
      let white = 0
      let total = 0
      for (let x = 0; x < width; x += 4) {
        const i = (y * width + x) * channels
        const opaque = channels < 4 || data[i + 3] > 200
        if (opaque && data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) white++
        total++
      }
      if (white / total > 0.7) {
        bottom = y
        break
      }
    }
    return { top, bottom }
  }

  const art = await readArtRaw()
  const artSource = await sharp(art.data, {
    raw: { width: art.info.width, height: art.info.height, channels: art.info.channels },
  })
    .png()
    .toBuffer()
  const julioBuffer = await requireFile(
    JULIO_LOCKUP_SOURCE,
    'O lockup do Julio vem do overlay oficial (public/cards/estaduais/julio-base.webp).',
  )
  const artBounds = bandBounds(art)
  const julioBounds = bandBounds(
    await sharp(julioBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  )

  /**
   * The Solla lockup and the four marks come from the colinha art itself (they
   * sit there clean of each other); the JULIO/PINHEIRO lockup comes from the
   * official dobradinha overlay, which carries it with real alpha.
   */
  const CROPS = {
    solla: { source: julioBuffer, box: [85, 942, 445, 315], bounds: julioBounds },
    julio: { source: julioBuffer, box: [532, 890, 455, 300], bounds: julioBounds },
    lula: { source: artSource, box: [662, 650, 184, 116], bounds: artBounds },
    jeronimo: { source: artSource, box: [848, 650, 186, 92], bounds: artBounds },
    rui: { source: artSource, box: [660, 758, 182, 100], bounds: artBounds },
    wagner: { source: artSource, box: [845, 745, 200, 90], bounds: artBounds },
  }

  const out = {}
  for (const [id, { source, box, bounds }] of Object.entries(CROPS)) {
    const [left, top, cropWidth, cropHeight] = box
    const { data: crop, info: cropInfo } = await sharp(source)
      .ensureAlpha()
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const ch = cropInfo.channels
    for (let y = 0; y < cropHeight; y++) {
      for (let x = 0; x < cropWidth; x++) {
        const i = (y * cropWidth + x) * ch
        const column = left + x
        const bandTop = bounds.top[column]
        const bandBottom = bounds.bottom
        const inside = bandTop >= 0 && top + y >= bandTop + 2 && top + y <= bandBottom - 1
        if (!inside) {
          crop[i + 3] = 0
          continue
        }
        // The band red becomes transparent with a soft edge; the anti-aliased
        // pixels of the art stay untouched, so a logo sits on the band exactly
        // as it does in the official piece.
        const d = dist(crop[i], crop[i + 1], crop[i + 2])
        crop[i + 3] = Math.round(crop[i + 3] * Math.max(0, Math.min(1, (d - 16) / 34)))
      }
    }
    out[id] = await sharp(crop, {
      raw: { width: cropWidth, height: cropHeight, channels: ch },
    })
      .webp({ quality: 95 })
      .toBuffer()
  }
  return out
}

/**
 * The personalized slip EXACTLY as the site produces it: drives the production
 * card studio (Playwright, mobile), picks the state deputy and lifts the
 * 1080×1920 preview canvas the site's own renderer painted.
 */
const fetchSiteCard = async ({ baseUrl, outPath, deputy = SITE_CARD_DEPUTY }) => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  try {
    await page.goto(`${baseUrl}/cards?model=minha-colinha`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForTimeout(2500)
    const combo = page.locator('[role=combobox]').first()
    await combo.click()
    await combo.fill(deputy)
    await page.waitForTimeout(800)
    await page
      .locator('[role=option]')
      .filter({ hasText: deputy })
      .first()
      .click({ timeout: 15_000 })
    await page.waitForTimeout(2500)
    const dataUrl = await page.evaluate(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(
        (item) => item.width === 1080 && item.height === 1920,
      )
      return canvas ? canvas.toDataURL('image/png') : null
    })
    if (!dataUrl)
      throw new Error(
        `o canvas 1080×1920 da colinha não apareceu na página de cards (estadual "${deputy}")`,
      )
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
    await writeFile(outPath, buffer)
    return buffer
  } finally {
    await context.close()
    await browser.close()
  }
}

/**
 * The reel's audio track (muxed with `-c:v copy`, so the video is never
 * re-encoded): one urna "confirma" when each vote card appears, over the
 * campaign jingle bed — the music enters at 0:04, very low, and fades out at
 * the end. `apad` keeps the track as long as the video, so `-shortest` can
 * never truncate it.
 */
const buildAudioTrack = async ({
  ffmpegBin,
  timeline,
  output,
  sfx = CONFIRMA_SFX,
  music = JINGLE,
  musicGain = 0.22,
  musicSkipMs = 4000,
  beepsGain = 0.7,
}) => {
  const cards = timeline.entries.filter((entry) => entry.kind === 'card')
  if (cards.length === 0) return null
  const totalSeconds = timeline.totalMs / 1000
  const args = ['-hide_banner', '-loglevel', 'error']
  for (const _ of cards) args.push('-i', sfx)
  const musicIndex = cards.length
  const hasMusic = music !== null && existsSync(music)
  // The jingle starts at the video's 0:00, playing from its own 0:04.
  if (hasMusic) args.push('-ss', (musicSkipMs / 1000).toFixed(2), '-i', music)
  const filters = cards.map(
    (entry, index) =>
      `[${index}]adelay=${Math.round(entry.atMs + 120)}|${Math.round(entry.atMs + 120)}[a${index}]`,
  )
  const beepLabels = cards.map((_, index) => `[a${index}]`).join('')
  filters.push(
    `${beepLabels}amix=inputs=${cards.length},volume=${(cards.length * beepsGain).toFixed(2)}[beeps]`,
  )
  let outLabel = 'beeps'
  if (hasMusic) {
    filters.push(`[${musicIndex}]volume=${musicGain},afade=t=in:st=0:d=0.6[bed]`)
    filters.push('[beeps][bed]amix=inputs=2,volume=2[out]')
    outLabel = 'out'
  }
  filters.push(
    `[${outLabel}]afade=t=out:st=${Math.max(0, totalSeconds - 2.5).toFixed(1)}:d=2.5,alimiter=limit=0.9:level_out=0.9,apad[mixed]`,
  )
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[mixed]',
    '-t',
    totalSeconds.toFixed(3),
    '-ac',
    '1',
    '-ar',
    '44100',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-y',
    output,
  )
  const result = await runFfmpeg(ffmpegBin, args, { label: 'audio track' })
  return result.ok ? output : null
}

const muxAudio = async ({ ffmpegBin, video, audio, output }) => {
  const result = await runFfmpeg(
    ffmpegBin,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      video,
      '-i',
      audio,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      output,
    ],
    { label: 'mux audio' },
  )
  return result.ok
}

const buildFontCss = async () => {
  const brexter = await requireFile(
    BRAND_FONT,
    'A Brexter oficial vive em src/app/(frontend)/fonts/Brexter-Bold.ttf.',
  )
  const inter = await requireFile(
    INTER_FONT,
    'A Inter (subset latim, OFL) é derivada para os assets do reel (ver README da pasta).',
  )
  const arimo = await requireFile(
    ARIMO_FONT,
    'Sem a Arimo local (documentada no build-radio-artes): instale a fonte em ~/.local/share/fonts/Arimo-Regular.woff2.',
  )
  return colinhaFontCss({
    brexterTtf: brexter.toString('base64'),
    interWoff2: inter.toString('base64'),
    arimoWoff2: arimo.toString('base64'),
  })
}

const printDryRun = (timeline) => {
  console.log(`\n[${LABEL}] ${COLINHA_REEL.title}`)
  console.log(
    `  ${timeline.entries.length} beats · ${timeline.totalMs} ms · ${timeline.frameCount} quadros a ${timeline.fps} fps\n`,
  )
  for (const entry of timeline.entries) {
    const detail = entry.candidateId ?? entry.screen ?? entry.text ?? ''
    console.log(
      `  ${String(entry.atMs).padStart(6)} ms  ${entry.kind.padEnd(9)} ${entry.id.padEnd(18)} ${String(detail).slice(0, 52)}`,
    )
  }
  console.log('')
}

const FINALES = { motion: 'reel.mp4', static: 'reel-estatico.mp4', card: 'reel-card.mp4' }

const main = async () => {
  const { flags } = parseEqualsFlags(process.argv.slice(2))
  if (flags.help === true) {
    console.log(USAGE)
    return
  }
  const fps = flags.fps === undefined ? COLINHA_REEL.fps : Number(flags.fps)
  if (!Number.isFinite(fps) || fps <= 0) die('--fps exige um número positivo.')
  const preview = flags.preview === true
  const dryRun = flags['dry-run'] === true
  const keepFrames = flags['keep-frames'] === true
  const coverOnly = flags['cover-only'] === true
  const beeps = flags.beeps === true
  const audioOnly = flags['audio-only'] === true
  const coverAtFlag = flags['cover-at'] === undefined ? undefined : Number(flags['cover-at'])
  const finaleFlag = typeof flags.finale === 'string' ? flags.finale : null
  const finales = finaleFlag
    ? finaleFlag.split(',').map((value) => value.trim())
    : ['motion', 'static', 'card']
  for (const finale of finales) {
    if (!(finale in FINALES))
      die('--finale aceita motion, static e/ou card (ex.: --finale=motion,static).')
  }
  const siteUrl =
    (typeof flags['base-url'] === 'string'
      ? flags['base-url']
      : process.env.REELS_BASE_URL?.trim()) || DEFAULT_SITE_URL
  // `--estadual-*`: the same reel for another dobradinha — the second candidate
  // of the ticket is replaced (name, ballot number and cutout) and the site's
  // personalized card is rendered for their picker name. `--estadual=livre`
  // swaps it for the "sem estadual" step (the "time do Lula" card).
  const estadualFlag = typeof flags.estadual === 'string' ? flags.estadual.trim() : ''
  const genericEstadual = estadualFlag === 'livre'
  const estadualName =
    typeof flags['estadual-name'] === 'string' ? flags['estadual-name'].trim() : ''
  const estadualNumber =
    typeof flags['estadual-number'] === 'string' ? flags['estadual-number'].trim() : ''
  const estadualPhoto =
    typeof flags['estadual-photo'] === 'string' ? resolve(flags['estadual-photo']) : ''
  if (estadualName && (!estadualNumber || !estadualPhoto)) {
    die('--estadual-name exige --estadual-number e --estadual-photo.')
  }
  const siteDeputy =
    typeof flags['site-deputy'] === 'string' && flags['site-deputy'].trim()
      ? flags['site-deputy'].trim()
      : SITE_CARD_DEPUTY
  const outSlug =
    typeof flags['out-slug'] === 'string' && flags['out-slug'].trim()
      ? flags['out-slug'].trim()
      : COLINHA_REEL.slug
  const candidates = genericEstadual
    ? COLINHA_CANDIDATES.map((candidate, index) =>
        index === 1 ? COLINHA_GENERIC_ESTADUAL : candidate,
      )
    : estadualName
      ? COLINHA_CANDIDATES.map((candidate, index) =>
          index === 1
            ? {
                ...candidate,
                name: estadualName.toLocaleUpperCase('pt-BR'),
                number: estadualNumber,
                photoPath: estadualPhoto,
                // The Plenária cutouts are framed as delivered (bust, head up).
                photoZoom: 1,
                photoShiftY: 0,
              }
            : candidate,
        )
      : COLINHA_CANDIDATES
  const outRoot = resolve(
    ROOT,
    typeof flags['out-dir'] === 'string' ? flags['out-dir'] : DEFAULT_OUT_DIR,
  )
  const workRoot = resolve(
    ROOT,
    typeof flags['work-dir'] === 'string' ? flags['work-dir'] : DEFAULT_WORK_DIR,
  )
  const previewFrames =
    typeof flags['preview-frames'] === 'string'
      ? flags['preview-frames']
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value >= 0)
      : []

  const motionBeats = buildColinhaBeats({ candidates })
  const motionTimeline = buildColinhaTimeline(motionBeats, fps)
  if (dryRun) {
    printDryRun(
      finales.length === 1
        ? buildColinhaTimeline(buildColinhaBeats({ finale: finales[0], candidates }), fps)
        : motionTimeline,
    )
    return
  }

  const outDir = join(outRoot, outSlug)
  const workDir = join(workRoot, outSlug)
  await mkdir(outDir, { recursive: true })
  await mkdir(workDir, { recursive: true })

  if (audioOnly) {
    const ffmpegAudio = await resolveFfmpeg({ encoders: ['libx264'], requirementsLabel: 'reel' })
    if (!ffmpegAudio.ok) die(`ffmpeg indisponível: ${ffmpegAudio.reason}`)
    let mixed = 0
    for (const finale of finales) {
      // The track follows the finale's own timeline (the card/static finales
      // are shorter than the motion one) — the mux then never stretches the
      // container past the video.
      const finaleTimeline = buildColinhaTimeline(buildColinhaBeats({ finale, candidates }), fps)
      const video = join(outDir, FINALES[finale] ?? `reel-${finale}.mp4`)
      if (!existsSync(video)) {
        console.log(`[${LABEL}] ${finale}: ${video.split('/').pop()} não existe, pulando`)
        continue
      }
      const silent = join(workDir, `silent-${finale}.mp4`)
      const stripped = await runFfmpeg(
        ffmpegAudio.bin,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          video,
          '-map',
          '0:v',
          '-c:v',
          'copy',
          '-an',
          '-y',
          silent,
        ],
        { label: 'strip audio' },
      )
      if (!stripped.ok) die(`não consegui remover o áudio antigo de ${video}.`)
      const track = join(workDir, `audio-${finale}.m4a`)
      const built = await buildAudioTrack({
        ffmpegBin: ffmpegAudio.bin,
        timeline: finaleTimeline,
        output: track,
      })
      if (!built) die(`não consegui montar a trilha de bipes (${finale}).`)
      const temp = join(workDir, `mux-${finale}.mp4`)
      if (
        !(await muxAudio({ ffmpegBin: ffmpegAudio.bin, video: silent, audio: track, output: temp }))
      ) {
        die(`não consegui mixar o áudio em ${video}.`)
      }
      await rename(temp, video)
      mixed++
      console.log(`[${LABEL}] ${finale}: bipes mixados em ${video.split('/').pop()}`)
    }
    console.log(`\n[${LABEL}] ${mixed} vídeo(s) com o "confirma"`)
    return
  }
  const [assets, fontCss] = await Promise.all([buildAssets(candidates), buildFontCss()])
  if (finales.includes('card') || finales.includes('static')) {
    if (genericEstadual) {
      // "Sem estadual": the official art already is the slip with the estadual
      // row open — no site render is needed.
      assets.siteCard = assets.colinhaArt
      console.log(`[${LABEL}] colinha sem estadual: arte oficial com a linha aberta`)
    } else {
      const cardPath = join(outDir, 'colinha-site.png')
      const buffer = await fetchSiteCard({
        baseUrl: siteUrl,
        outPath: cardPath,
        deputy: siteDeputy,
      })
      assets.siteCard = dataUri(buffer, 'image/png')
      console.log(`[${LABEL}] colinha do site (${siteDeputy}) → ${cardPath}`)
    }
  }

  /** The reveal schedule of a finale: the static one lands during the flip. */
  const scheduleFor = (timeline) => {
    const endBeat = timeline.byId.get('end-colinha')
    const brandBeat = timeline.byId.get('brand')
    const revealBeats = timeline.entries.filter((entry) => entry.kind === 'reveal')
    if (revealBeats.length === 0 && brandBeat && endBeat) {
      const at = endBeat.atMs
      return {
        reveals: COLINHA_CANDIDATES.map((candidate) => ({
          candidateId: candidate.id,
          atMs: at,
          durationMs: COLINHA_BEAT_DURATIONS.flip * 2,
        })),
        brandAtMs: at,
      }
    }
    return {
      reveals: revealBeats.map((entry) => ({
        candidateId: entry.candidateId,
        atMs: entry.atMs,
        durationMs: entry.durationMs * 0.6,
      })),
      brandAtMs: brandBeat ? brandBeat.atMs : 0,
    }
  }

  const openFinalePage = async (finale, timeline) => {
    const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
    const schedule = scheduleFor(timeline)
    const html = colinhaReelHtml({
      beats: timeline.entries,
      candidates,
      reveals: schedule.reveals,
      brandAtMs: schedule.brandAtMs,
      drawnRow: candidates[1].id,
      totalMs: timeline.totalMs,
      flipMs: COLINHA_BEAT_DURATIONS.flip,
      fontCss,
      assets,
      cardFinale: finale === 'card',
    })
    const htmlPath = join(workDir, `chat-${finale}.html`)
    await writeFile(htmlPath, html)
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
    })
    const page = await context.newPage()
    await page.goto(pathToFileURL(htmlPath).href)
    await page.waitForFunction(() => window.colinhaReady !== undefined)
    await page.evaluate(() => window.colinhaReady)
    return { page, context, browser }
  }

  const shoot = async (page, timeMs, file) => {
    await page.evaluate((t) => window.colinhaRender(t), timeMs)
    await page.screenshot({ path: file, type: 'jpeg', quality: 96 })
  }

  /** Default cover moment: the estadual card opening — two cards + the number. */
  const coverBeat = motionTimeline.byId.get(`card-${COLINHA_CANDIDATES[1].id}`)
  const coverAt =
    coverAtFlag !== undefined && Number.isFinite(coverAtFlag)
      ? coverAtFlag
      : coverBeat
        ? coverBeat.atMs + 1000
        : Math.round(motionTimeline.totalMs * 0.2)

  const renderCoverIn = async (finale, timeline) => {
    const { page, context, browser: coverBrowser } = await openFinalePage(finale, timeline)
    const coverPath = await renderCover(page)
    await context.close()
    await coverBrowser.close()
    return coverPath
  }

  const renderCover = async (page) => {
    await page.setViewportSize(COVER_VIEWPORT)
    await page.evaluate(() => {
      window.colinhaReset()
      window.colinhaRender(0)
    })
    const coverPath = join(outDir, 'capa.png')
    await page.evaluate((t) => window.colinhaRender(t), coverAt)
    await page.screenshot({ path: coverPath, type: 'png' })
    return coverPath
  }

  if (previewFrames.length > 0) {
    const previewFinale = finales.length === 1 ? finales[0] : 'motion'
    const previewTimeline =
      previewFinale === 'motion'
        ? motionTimeline
        : buildColinhaTimeline(buildColinhaBeats({ finale: previewFinale, candidates }), fps)
    const {
      page,
      context,
      browser: previewBrowser,
    } = await openFinalePage(previewFinale, previewTimeline)
    const previewDir = join(workDir, 'preview')
    await mkdir(previewDir, { recursive: true })
    for (const timeMs of previewFrames) {
      const file = join(previewDir, `t-${String(timeMs).padStart(6, '0')}.png`)
      await page.evaluate((t) => window.colinhaRender(t), timeMs)
      await page.screenshot({ path: file, type: 'png' })
      console.log(`[${LABEL}] quadro t=${timeMs} ms → ${file}`)
    }
    await context.close()
    await previewBrowser.close()
    return
  }

  if (coverOnly) {
    const coverFinale = finales.length === 1 ? finales[0] : 'motion'
    const coverTimeline =
      coverFinale === 'motion'
        ? motionTimeline
        : buildColinhaTimeline(buildColinhaBeats({ finale: coverFinale, candidates }), fps)
    const {
      page,
      context,
      browser: coverBrowser,
    } = await openFinalePage(coverFinale, coverTimeline)
    const coverPath = await renderCover(page)
    await context.close()
    await coverBrowser.close()
    console.log(`[${LABEL}] capa (t=${Math.round(coverAt)} ms) → ${coverPath}`)
    return
  }

  const ffmpeg = await resolveFfmpeg({ encoders: ['libx264'], requirementsLabel: 'reel' })
  if (!ffmpeg.ok) die(`ffmpeg indisponível: ${ffmpeg.reason}`)

  const rendered = []
  for (const finale of finales) {
    const timeline = buildColinhaTimeline(buildColinhaBeats({ finale, candidates }), fps)
    const framesDir = join(workDir, 'frames', finale)
    await rm(framesDir, { recursive: true, force: true })
    await mkdir(framesDir, { recursive: true })
    const frames = []
    // Long renders can lose the browser; one fresh retry keeps the build going.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let session = null
      try {
        session = await openFinalePage(finale, timeline)
        for (let index = 0; index < timeline.frameCount; index++) {
          const timeMs = (index * 1000) / fps
          const file = join(framesDir, `f-${String(index).padStart(5, '0')}.jpg`)
          await shoot(session.page, timeMs, file)
          frames.push({ file, captureMs: timeMs })
          if (index % 120 === 0) {
            console.log(`[${LABEL}] ${finale}: quadro ${index + 1}/${timeline.frameCount}`)
          }
        }
        break
      } catch (error) {
        if (attempt === 2) throw error
        frames.length = 0
        console.log(
          `[${LABEL}] ${finale}: render interrompido (${String(error.message).split('\n')[0]}) — nova tentativa`,
        )
      } finally {
        await session?.context.close().catch(() => undefined)
        await session?.browser.close().catch(() => undefined)
      }
    }
    const reelPath = join(outDir, FINALES[finale])
    await encodeFrames({
      ffmpegBin: ffmpeg.bin,
      frames,
      listPath: join(workDir, `frames-${finale}.txt`),
      output: reelPath,
      fps,
      preset: preview ? PREVIEW_PRESET : REEL_PRESET,
      crf: preview ? PREVIEW_CRF : REEL_CRF,
    })
    if (beeps) {
      const track = join(workDir, `audio-${finale}.m4a`)
      const built = await buildAudioTrack({ ffmpegBin: ffmpeg.bin, timeline, output: track })
      if (!built) die(`não consegui montar a trilha dos bipes (${finale}).`)
      const temp = join(workDir, `mux-${finale}.mp4`)
      if (
        !(await muxAudio({ ffmpegBin: ffmpeg.bin, video: reelPath, audio: track, output: temp }))
      ) {
        die(`não consegui mixar o áudio em ${reelPath}.`)
      }
      await rename(temp, reelPath)
    }
    if (finale === 'motion') await renderCoverIn(finale, timeline)
    if (!keepFrames) await rm(framesDir, { recursive: true, force: true })
    rendered.push({ finale, timeline, reelPath })
  }
  const scriptHash = sha256Hex(
    Buffer.from(
      JSON.stringify({
        candidates,
        beats: motionBeats.map(({ id, kind, durationMs }) => ({ id, kind, durationMs })),
      }),
    ),
  )
  const metadata = {
    slug: outSlug,
    title: genericEstadual
      ? `${COLINHA_REEL.title} · sem estadual (time do Lula)`
      : estadualName
        ? `${COLINHA_REEL.title} · ${estadualName}`
        : COLINHA_REEL.title,
    kind: 'chat-colinha',
    coverAlt: COLINHA_REEL.coverAlt,
    scriptHash,
    versions: Object.fromEntries(
      rendered.map(({ finale, timeline, reelPath }) => [
        finale,
        {
          file: reelPath.split('/').pop(),
          durationMs: timeline.totalMs,
          durationSeconds: Math.round(timeline.totalMs / 100) / 10,
          frameCount: timeline.frameCount,
        },
      ]),
    ),
    width: 1080,
    height: 1920,
    fps,
    codec: 'h264',
    audio: beeps,
    coverAtMs: Math.round(coverAt),
    artifacts: [
      ...rendered.map(({ reelPath }) => reelPath.split('/').pop()),
      ...(existsSync(join(outDir, 'colinha-site.png')) ? ['colinha-site.png'] : []),
      ...(existsSync(join(outDir, 'capa.png')) ? ['capa.png'] : []),
      'roteiro.md',
      'metadata.json',
    ],
    candidateNumbers: Object.fromEntries(
      candidates.map((candidate) => [candidate.id, candidate.number]),
    ),
    generatedAt: new Date().toISOString(),
    ffmpeg: ffmpeg.version,
  }
  await writeFile(join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`)

  const scriptLines = motionTimeline.entries.map((entry) => {
    const at = `${(entry.atMs / 1000).toFixed(1)}s`.padStart(6)
    if (entry.kind === 'voter') return `${at}  ELEITOR   ${entry.text}`
    if (entry.kind === 'assistant') return `${at}  TIME 1313 ${entry.text}`
    if (entry.kind === 'typing') return `${at}  TIME 1313 (digitando…)`
    if (entry.kind === 'number') return `${at}  ELEITOR   ${entry.text}`
    if (entry.kind === 'card') {
      const candidate = candidates.find((item) => item.id === entry.candidateId)
      return `${at}  TIME 1313 anotei: ${candidate?.office} ${candidate?.name} ${candidate?.number}`
    }
    if (entry.kind === 'reveal')
      return `${at}  —         colinha: ${entry.candidateId} (figura + linha + logo)`
    return `${at}  —         colinha completa (slogan e Mais Saúde, Mais Futuro)`
  })
  const roteiro = `# Roteiro — ${COLINHA_REEL.title}

Versões alternativas (1080×1920, ${fps} fps, **sem áudio** — a trilha entra no
app na hora de publicar): \`reel.mp4\` (a colinha se monta candidato a
candidato), \`reel-estatico.mp4\` (a colinha pronta entra de uma vez, só com a
transição do flip) e \`reel-card.mp4\` (a mesma transição, mas com a colinha
exatamente como o card personalizado do site a gera — o PNG cru fica em
\`colinha-site.png\`). Roteiro por beat (tempos do vídeo):

\`\`\`text
${scriptLines.join('\n')}
\`\`\`

Ajuste de roteiro, ritmo ou texto é feito no arquivo-fonte
(\`scripts/lib/colinhaReel.mjs\` + \`scripts/build-colinha-reel.mjs\`) e o pacote é
regerado com \`pnpm reels:colinha\` — nunca no MP4.
`
  await writeFile(join(outDir, 'roteiro.md'), roteiro)

  console.log(`\n[${LABEL}] pacote em ${outDir}`)
  for (const { finale, timeline, reelPath } of rendered) {
    console.log(
      `  ${reelPath.split('/').pop().padEnd(18)} 1080×1920 · ${fps} fps · ${(timeline.totalMs / 1000).toFixed(1)} s · ${finale}${preview ? ' (preview)' : ''}`,
    )
  }
  console.log(`  capa.png           corte 4:5 do quadro t=${Math.round(coverAt)} ms`)
  console.log(`  roteiro.md · metadata.json · script ${scriptHash.slice(0, 12)}`)
  if (existsSync(join(outDir, 'colinha-site.png'))) {
    console.log('  colinha-site.png   render cru do card personalizado do site')
  }
  console.log('')
}

main().catch((error) => die(error?.stack ?? String(error)))
