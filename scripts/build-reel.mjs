/**
 * C196/C197 — reel builder: one shot list in, one publishable package out
 * (`reel.mp4` + `capa.png` + `narracao.srt` + `roteiro.md` + `metadata.json`,
 * plus `narracao.mp3` + `reel-audio.mp4` with `--audio`).
 *
 * Pipeline: capture (real site, mobile viewport, timestamped screencast) →
 * overlays/cover/graphic scenes (Playwright + the site's own fonts) → one
 * H.264 clip per scene (zoompan + burned captions) → concat → transcription
 * (always) → optional TTS draft → package.
 *
 * Runs on the workstation: the database is never touched and the site is
 * visited as an anonymous reader (the card download is client-side).
 *
 * Usage:
 *   node scripts/build-reel.mjs cards [--base-url=…] [--out-dir=…] [--work-dir=…]
 *     [--dry-run] [--capture-only] [--audio] [--voice=pt-BR-AntonioNeural]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readImageDataUris, readKitAssets } from './lib/campaignKitAssets.mjs'
import { dieWithLabel, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import {
  gotoReelSite,
  installCursor,
  launchReelBrowser,
  openReelContext,
  REEL_VIEWPORT,
  runCaptureScenes,
  startFrameRecorder,
} from './lib/reelCapture.mjs'
import {
  buildConcatArgs,
  buildMuxAudioVideoArgs,
  buildSceneClipArgs,
  concatListContent,
  encodeFrames,
  PREVIEW_CRF,
  PREVIEW_PRESET,
  REEL_CRF,
  REEL_PRESET,
  resolveFfmpeg,
  runFfmpeg,
} from './lib/reelFfmpeg.mjs'
import { buildReelMetadata } from './lib/reelPackage.mjs'
import {
  extractFontFaces,
  loadFontCss,
  openRenderContext,
  recordGraphicScene,
  renderCover,
  renderOverlay,
} from './lib/reelRender.mjs'
import {
  buildReelRoteiro,
  buildReelSrt,
  buildScriptBeats,
  resolveSceneNarration,
} from './lib/reelScript.mjs'
import { captureScenes, graphicScenes, loadShotList } from './lib/reelShotList.mjs'
import {
  captureChromeHtml,
  commandRailHtml,
  coverHtml,
  ctaHtml,
  hookHtml,
  profileHtml,
} from './lib/reelTemplates.mjs'
import { captureScenePlan, graphicScenePlan, REEL, totalDurationMs } from './lib/reelTimeline.mjs'
import { buildNarrationTrack, DEFAULT_TTS_VOICE, resolveEdgeTts } from './lib/reelTts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-reel'
const die = dieWithLabel(LABEL)
const DEFAULT_OUT_DIR = 'data/reels'
const DEFAULT_WORK_DIR = 'data/reels/.work'
const DEFAULT_BASE_URL = 'https://jorgesolla1313.com.br'
const FADE_IN_MS = 300
const FADE_OUT_MS = 400

const main = async () => {
  loadCliEnv()
  const { flags, positional } = parseEqualsFlags(process.argv.slice(2))
  const slug = positional[0]
  if (!slug) {
    die(
      'Uso: node scripts/build-reel.mjs <slug> [--base-url=…] [--out-dir=…] [--work-dir=…] [--dry-run] [--capture-only] [--audio] [--voice=pt-BR-AntonioNeural]',
    )
  }
  const outRoot = resolve(
    ROOT,
    typeof flags['out-dir'] === 'string' ? flags['out-dir'] : DEFAULT_OUT_DIR,
  )
  const workRoot = resolve(
    ROOT,
    typeof flags['work-dir'] === 'string' ? flags['work-dir'] : DEFAULT_WORK_DIR,
  )
  const baseUrl =
    (typeof flags['base-url'] === 'string'
      ? flags['base-url']
      : process.env.REELS_BASE_URL?.trim()) || DEFAULT_BASE_URL
  const dryRun = flags['dry-run'] === true
  const captureOnly = flags['capture-only'] === true
  if (flags.audio !== undefined && flags.audio !== true) {
    die('--audio não aceita valor (use --audio puro).')
  }
  const audio = flags.audio === true
  if (audio && captureOnly) die('--audio não combina com --capture-only.')
  const voiceFlag = flags.voice
  if (voiceFlag !== undefined && typeof voiceFlag !== 'string') {
    die('--voice exige um valor: --voice=pt-BR-AntonioNeural.')
  }
  if (typeof voiceFlag === 'string' && voiceFlag.trim() === '') {
    die('--voice exige um valor: --voice=pt-BR-AntonioNeural.')
  }
  if (voiceFlag !== undefined && !audio) die('--voice exige --audio.')
  const voice =
    (typeof voiceFlag === 'string' ? voiceFlag.trim() : process.env.REELS_TTS_VOICE?.trim()) ||
    DEFAULT_TTS_VOICE

  const { shotList, hash } = await loadShotList({ slug, root: ROOT })
  const outDir = join(outRoot, slug)
  const workDir = join(workRoot, slug)
  const capturePath = join(workDir, 'capture.mp4')
  console.log(`[${LABEL}] shot list ${slug} — hash ${hash.slice(0, 12)}`)
  if (dryRun) {
    for (const scene of shotList.scenes) {
      const detail =
        scene.kind === 'capture'
          ? `captura · ${scene.steps.length} passo(s)`
          : `gráfica · ${scene.template}`
      const speech = resolveSceneNarration(scene)
      console.log(`  - ${scene.id}: ${detail} · ${speech ? `fala: ${speech}` : 'sem fala'}`)
    }
    return
  }
  const ffmpeg = await resolveFfmpeg({ audio })
  console.log(`[${LABEL}] ffmpeg: ${ffmpeg.source} (${ffmpeg.version || ffmpeg.bin})`)
  const tts = audio ? await resolveEdgeTts({ root: ROOT }) : null
  if (tts) console.log(`[${LABEL}] TTS: ${tts.source} (${tts.bin}) — voz ${voice}`)

  await mkdir(workDir, { recursive: true })
  await mkdir(outDir, { recursive: true })
  const assets = await readKitAssets({ root: ROOT })
  if (graphicScenes(shotList).some((scene) => scene.template === 'profile')) {
    Object.assign(
      assets,
      await readImageDataUris({
        root: ROOT,
        files: {
          cardFrame: 'public/cards/photo-square-frame.png',
          fixturePhoto: shotList.fixture.photo,
        },
      }),
    )
  }
  const browser = await launchReelBrowser()
  const plans = new Map()
  const graphics = new Map()
  let fontCss = ''

  try {
    const context = await openReelContext(browser)
    const page = await context.newPage()
    await installCursor(page)
    const recorder = await startFrameRecorder({ context, page, framesDir: join(workDir, 'frames') })
    const url = await gotoReelSite({ page, baseUrl, route: shotList.route })
    console.log(`[${LABEL}] capturando ${url}`)
    const firstCapture = captureScenes(shotList)[0]
    const surfaceSelector = firstCapture?.setup[0]?.selector ?? firstCapture?.steps[0]?.selector
    if (surfaceSelector) {
      try {
        await page.locator(surfaceSelector).first().waitFor({ state: 'attached', timeout: 15000 })
      } catch {
        throw new Error(
          `Superfície do reel não encontrada no site (${surfaceSelector}). O layout público mudou?`,
        )
      }
    }
    const fontFaces = await extractFontFaces(page)
    const actions = await runCaptureScenes({ page, shotList, log: [], root: ROOT })
    const stats = await recorder.stop()
    if (stats.firstFrameWallMs === null)
      throw new Error('Nenhum frame foi gravado — o site não renderizou?')
    await encodeFrames({
      ffmpegBin: ffmpeg.bin,
      frames: stats.frames,
      listPath: join(workDir, 'frames.txt'),
      output: capturePath,
      fps: REEL.fps,
      preset: PREVIEW_PRESET,
      crf: PREVIEW_CRF,
    })
    await writeFile(
      join(workDir, 'capture.log.json'),
      `${JSON.stringify({ firstFrameWallMs: stats.firstFrameWallMs, frames: stats.frames, actions, fontFaces }, null, 2)}\n`,
    )
    for (const scene of captureScenes(shotList)) {
      plans.set(
        scene.id,
        captureScenePlan({
          scene,
          actions,
          firstFrameWallMs: stats.firstFrameWallMs,
          viewportWidth: REEL_VIEWPORT.width,
        }),
      )
    }
    console.log(`[${LABEL}] captura: ${stats.frameCount} frames, ${capturePath}`)

    if (!captureOnly) {
      const renderContext = await openRenderContext(browser)
      const renderPage = await renderContext.newPage()
      fontCss = await loadFontCss({
        fontFaces,
        cacheDir: join(workRoot, '.cache', 'fonts'),
        pageUrl: url,
      })
      for (const scene of captureScenes(shotList)) {
        await renderOverlay({
          page: renderPage,
          html: captureChromeHtml({ assets }),
          output: join(workDir, `chrome-${scene.id}.png`),
        })
        await renderOverlay({
          page: renderPage,
          html: commandRailHtml({ fontCss, badge: scene.badge, caption: scene.caption }),
          output: join(workDir, `command-${scene.id}.png`),
        })
      }
      await renderCover({
        page: renderPage,
        html: coverHtml({ fontCss, assets, copy: shotList.graphics.cover }),
        output: join(outDir, 'capa.png'),
      })
      const graphicHtmls = {
        hook: hookHtml,
        cta: ctaHtml,
        profile: profileHtml,
      }
      for (const scene of graphicScenes(shotList)) {
        const html = graphicHtmls[scene.template]({
          fontCss,
          assets,
          copy: shotList.graphics[scene.template],
        })
        const graphic = await recordGraphicScene({
          context: renderContext,
          template: scene.template,
          html,
          durationMs: scene.durationMs,
          output: join(workDir, `${scene.id}.mp4`),
          framesDir: join(workDir, 'frames', scene.id),
          ffmpegBin: ffmpeg.bin,
          crf: PREVIEW_CRF,
          preset: PREVIEW_PRESET,
        })
        const plan = graphicScenePlan({
          scene,
          readyAtMs: graphic.readyAtMs,
          firstFrameWallMs: graphic.stats.firstFrameWallMs,
        })
        plans.set(scene.id, plan)
        graphics.set(scene.id, graphic.output)
      }
      await renderPage.close()
      await renderContext.close()
    }
  } finally {
    await browser.close()
  }

  if (captureOnly) {
    console.log(`[${LABEL}] --capture-only: ${capturePath}`)
    return
  }

  const clips = []
  const firstScene = shotList.scenes[0].id
  const lastScene = shotList.scenes[shotList.scenes.length - 1].id
  for (const scene of shotList.scenes) {
    const plan = plans.get(scene.id)
    const output = join(workDir, `clip-${scene.id}.mp4`)
    const input = scene.kind === 'capture' ? capturePath : graphics.get(scene.id)
    const overlays =
      scene.kind === 'capture'
        ? [
            { path: join(workDir, `chrome-${scene.id}.png`), startMs: 0, endMs: plan.durationMs },
            ...plan.captions.map((window) => ({
              path: join(workDir, `command-${scene.id}.png`),
              ...window,
            })),
          ]
        : []
    await runFfmpeg(
      ffmpeg.bin,
      buildSceneClipArgs({
        input,
        output,
        startMs: plan.startMs,
        durationMs: plan.durationMs,
        zoom: plan.zoom,
        captions: overlays,
        fadeInMs: scene.id === firstScene ? FADE_IN_MS : 0,
        fadeOutMs: scene.id === lastScene ? FADE_OUT_MS : 0,
        fps: REEL.fps,
        width: REEL.width,
        height: REEL.height,
        preset: REEL_PRESET,
        crf: REEL_CRF,
      }),
      { label: `clip ${scene.id}` },
    )
    console.log(`[${LABEL}] cena ${scene.id}: ${(plan.durationMs / 1000).toFixed(1)}s`)
    clips.push(output)
  }
  const reelPath = join(outDir, 'reel.mp4')
  const listPath = join(workDir, 'concat.txt')
  await writeFile(listPath, concatListContent(clips))
  await runFfmpeg(ffmpeg.bin, buildConcatArgs({ listPath, output: reelPath }), { label: 'concat' })

  const durationMs = totalDurationMs([...plans.values()])
  const beats = buildScriptBeats({ shotList, plans })
  await writeFile(join(outDir, 'narracao.srt'), buildReelSrt(beats))
  await writeFile(
    join(outDir, 'roteiro.md'),
    buildReelRoteiro({ shotList, hash, beats, durationMs }),
  )
  console.log(`[${LABEL}] transcrição: narracao.srt · roteiro.md`)

  const artifacts = ['reel.mp4', 'capa.png', 'narracao.srt', 'roteiro.md']
  if (audio) {
    const mp3Path = join(outDir, 'narracao.mp3')
    await buildNarrationTrack({
      ffmpegBin: ffmpeg.bin,
      edgeTtsBin: tts.bin,
      voice,
      beats,
      workDir,
      mp3Path,
    })
    await runFfmpeg(
      ffmpeg.bin,
      buildMuxAudioVideoArgs({
        video: reelPath,
        audio: mp3Path,
        output: join(outDir, 'reel-audio.mp4'),
      }),
      { label: 'mux do áudio' },
    )
    artifacts.push('narracao.mp3', 'reel-audio.mp4')
    console.log(`[${LABEL}] áudio: narracao.mp3 + reel-audio.mp4 (voz ${voice})`)
  }

  const metadata = buildReelMetadata({
    shotList,
    hash,
    durationMs,
    ffmpeg: ffmpeg.version || ffmpeg.bin,
    audio,
    voice: audio ? voice : null,
    artifacts,
  })
  await writeFile(join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`)
  const audioFiles = audio ? ' · narracao.mp3 · reel-audio.mp4' : ''
  console.log(`[${LABEL}] pacote: ${outDir}`)
  console.log(
    `  reel.mp4 (${(durationMs / 1000).toFixed(1)}s) · capa.png · narracao.srt · roteiro.md${audioFiles} · metadata.json`,
  )
}

await main().catch((error) => {
  die(error instanceof Error ? error.message : String(error))
})
