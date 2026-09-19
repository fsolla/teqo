/**
 * C196 — ffmpeg plumbing of the reel composer: binary resolution with a
 * fail-closed capability probe, the per-scene clip command (zoompan + burned
 * caption overlays) and the concat that stitches the scenes into `reel.mp4`.
 *
 * Resolution order (see `docs/plans/reels-tutoriais-impl.md`, Decisão 2):
 * `FFMPEG_PATH` → `ffmpeg` on PATH → the registry-packaged
 * `@ffmpeg-installer/ffmpeg` binary. The packed fallback keeps the
 * non-technical operator flow working on a workstation without a system
 * ffmpeg; the homeserver Docker build installs it from npm (never from GitHub
 * releases, which the homeserver cannot reach — see the sharp override note in
 * `pnpm-workspace.yaml`).
 */

import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

import { seconds } from './reelTimeline.mjs'

const execFileAsync = promisify(execFile)
const MAX_BUFFER_BYTES = 16 * 1024 * 1024

const REQUIRED_FILTERS = ['fade', 'overlay', 'scale', 'zoompan']
export const REEL_PRESET = 'medium'
export const REEL_CRF = 18
export const PREVIEW_PRESET = 'ultrafast'
export const PREVIEW_CRF = 14

/**
 * @typedef {{ z: string, x: string, y: string, inputWidth: number, inputHeight: number }} ZoomLike
 */

/**
 * @typedef {(bin: string, args: string[]) => Promise<{ ok: boolean, stdout: string, stderr: string, error?: { code?: string } }>} RunFn
 */

const defaultRun = async (bin, args) => {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, { maxBuffer: MAX_BUFFER_BYTES })
    return { ok: true, stdout, stderr }
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? '', stderr: error.stderr ?? '', error }
  }
}

const versionLine = (stdout) =>
  stdout.split('\n').find((line) => line.startsWith('ffmpeg version')) ?? ''

/**
 * Capability probe: the binary must encode H.264 (libx264) and ship the
 * filters the composer uses. Missing capabilities are reported, never assumed.
 *
 * @param {string} bin
 * @param {{ run?: RunFn }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string } | { ok: false, bin: string, reason: string }>}
 */
export const probeFfmpeg = async (bin, { run = defaultRun } = {}) => {
  const version = await run(bin, ['-hide_banner', '-version'])
  if (!version.ok)
    return { ok: false, bin, reason: `não executou (${version.error?.code ?? 'erro'})` }
  const encoders = await run(bin, ['-hide_banner', '-encoders'])
  if (!encoders.ok || !/\blibx264\b/.test(encoders.stdout)) {
    return { ok: false, bin, reason: 'sem encoder libx264' }
  }
  const filters = await run(bin, ['-hide_banner', '-filters'])
  if (!filters.ok) return { ok: false, bin, reason: 'não listou filtros' }
  const missing = REQUIRED_FILTERS.filter(
    (filter) => !new RegExp(`\\b${filter}\\b`).test(filters.stdout),
  )
  if (missing.length > 0) return { ok: false, bin, reason: `sem filtro(s): ${missing.join(', ')}` }
  return { ok: true, bin, version: versionLine(version.stdout) }
}

const installHint =
  'Defina FFMPEG_PATH, instale o ffmpeg (ex.: `sudo apt install ffmpeg`) ou rode `pnpm install` para o binário empacotado.'

/**
 * Resolves the first candidate that passes the probe. Explicit `FFMPEG_PATH` is strict.
 *
 * @param {{ env?: Record<string, string | undefined>, run?: RunFn, installer?: { path?: string } | null }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string, source: string }>}
 */
export const resolveFfmpeg = async ({ env = process.env, run = defaultRun, installer } = {}) => {
  let packaged = installer
  if (packaged === undefined) {
    try {
      packaged = (await import('@ffmpeg-installer/ffmpeg')).default
    } catch {
      // The packaged binary throws on import when its platform package is
      // missing; the probe below decides, never the import.
      packaged = null
    }
  }
  const candidates = []
  const explicit = env.FFMPEG_PATH?.trim()
  if (explicit) candidates.push({ bin: explicit, source: 'FFMPEG_PATH', strict: true })
  candidates.push({ bin: 'ffmpeg', source: 'PATH', strict: false })
  if (packaged?.path) candidates.push({ bin: packaged.path, source: 'empacotado', strict: false })
  const failures = []
  for (const candidate of candidates) {
    const probe = await probeFfmpeg(candidate.bin, { run })
    if (probe.ok) {
      return { ok: true, bin: probe.bin, version: probe.version, source: candidate.source }
    }
    failures.push(`${candidate.source}: ${probe.reason}`)
    if (candidate.strict) break
  }
  throw new Error(
    `Nenhum ffmpeg utilizável (libx264 + filtros do reel). ${failures.join('; ')}. ${installHint}`,
  )
}

/**
 * Runs ffmpeg and fails with the stderr tail — never swallows the exit code.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ run?: RunFn, label?: string }} [options]
 */
export const runFfmpeg = async (bin, args, { run = defaultRun, label = 'ffmpeg' } = {}) => {
  const result = await run(bin, args)
  if (!result.ok) {
    const tail = (result.stderr || result.error?.message || '').trim().slice(-400)
    throw new Error(`${label} falhou${tail ? `: ${tail}` : ''}`)
  }
  return result
}

/**
 * One scene clip: seek the source, apply the zoom camera (when the scene has
 * clicks), burn the caption overlays with their timelines and encode H.264.
 * Pure: the caller runs the returned args.
 *
 * @param {{ input: string, output: string, startMs: number, durationMs: number, zoom?: ZoomLike | null, captions?: Array<{ path: string, startMs: number, endMs: number }>, fadeInMs?: number, fadeOutMs?: number, fps: number, width: number, height: number, preset?: string, crf?: number }} options
 * @returns {string[]}
 */
export const buildSceneClipArgs = ({
  input,
  output,
  startMs,
  durationMs,
  zoom = null,
  captions = [],
  fadeInMs = 0,
  fadeOutMs = 0,
  fps,
  width,
  height,
  preset = REEL_PRESET,
  crf = REEL_CRF,
}) => {
  const filters = []
  const videoFilters = [`fps=${fps}`]
  if (zoom) {
    videoFilters.push(`scale=${zoom.inputWidth}:${zoom.inputHeight}`)
    videoFilters.push(
      `zoompan=z='${zoom.z}':x='${zoom.x}':y='${zoom.y}':d=1:s=${width}x${height}:fps=${fps}`,
    )
  } else {
    videoFilters.push(`scale=${width}:${height}`)
  }
  if (fadeInMs > 0) videoFilters.push(`fade=t=in:st=0:d=${seconds(fadeInMs)}`)
  if (fadeOutMs > 0) {
    videoFilters.push(
      `fade=t=out:st=${seconds(Math.max(0, durationMs - fadeOutMs))}:d=${seconds(fadeOutMs)}`,
    )
  }
  filters.push(`[0:v]${videoFilters.join(',')}[v0]`)
  captions.forEach((caption, index) => {
    filters.push(
      `[v${index}][${index + 1}:v]overlay=0:0:enable='between(t,${seconds(caption.startMs)},${seconds(caption.endMs)})'[v${index + 1}]`,
    )
  })
  const captionInputs = captions.flatMap((caption) => [
    '-loop',
    '1',
    '-framerate',
    String(fps),
    '-i',
    caption.path,
  ])
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(seconds(startMs)),
    '-t',
    String(seconds(durationMs)),
    '-i',
    input,
    ...captionInputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    `[v${captions.length}]`,
    '-an',
    '-t',
    String(seconds(durationMs)),
    '-r',
    String(fps),
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    output,
  ]
}

/** `concat` demuxer list entry; single quotes in paths are escaped. */
const concatListEntry = (path) => `file '${path.replaceAll("'", "'\\''")}'`

export const concatListContent = (paths) => `${paths.map(concatListEntry).join('\n')}\n`

/**
 * Offline frame encode: the screencast writes JPEG frames with their capture
 * timestamps, and the video is built later from those exact times. Encoding
 * after capture keeps ffmpeg's CPU work from backpressuring the browser and
 * shifting the timeline (the pipe version drifted; see the impl plan).
 *
 * `frames`: `[{ file, captureMs }]` in capture order. The last frame is
 * repeated so the concat demuxer honors its duration.
 *
 * @param {{ frames: Array<{ file: string, captureMs: number }>, fps: number }} options
 * @returns {string}
 */
export const buildFrameListContent = ({ frames, fps }) => {
  const minimum = 1 / fps
  const lines = []
  frames.forEach((frame, index) => {
    const next = frames[index + 1]
    const duration = next ? Math.max(0.001, (next.captureMs - frame.captureMs) / 1000) : minimum
    lines.push(concatListEntry(frame.file), `duration ${seconds(duration * 1000)}`)
  })
  if (frames.length > 0) lines.push(concatListEntry(frames[frames.length - 1].file))
  return `${lines.join('\n')}\n`
}

/**
 * @param {{ ffmpegBin: string, frames: Array<{ file: string, captureMs: number }>, listPath: string, output: string, fps: number, preset?: string, crf?: number, writeFileImpl?: (path: string, content: string) => Promise<unknown>, run?: RunFn }} options
 */
export const encodeFrames = async ({
  ffmpegBin,
  frames,
  listPath,
  output,
  fps,
  preset = PREVIEW_PRESET,
  crf = PREVIEW_CRF,
  writeFileImpl = writeFile,
  run = defaultRun,
}) => {
  await writeFileImpl(listPath, buildFrameListContent({ frames, fps }))
  await runFfmpeg(
    ffmpegBin,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-r',
      String(fps),
      '-c:v',
      'libx264',
      '-preset',
      preset,
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      output,
    ],
    { run, label: 'encode frames' },
  )
}

/** Stream-copy concat of the scene clips (same codec/params) into `reel.mp4`. */
export const buildConcatArgs = ({ listPath, output }) => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  listPath,
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  '-y',
  output,
]
