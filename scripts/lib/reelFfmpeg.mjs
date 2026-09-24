/**
 * C196 — ffmpeg plumbing of the reel composer: the per-scene clip command
 * (zoompan + burned caption overlays) and the concat that stitches the scenes
 * into `reel.mp4`. The generic binary resolution/probe/runner (C215 moved them
 * to `mediaBinaries.mjs`) is re-exported here so the reel tools and their unit
 * pins keep the same import surface; the reel requirements (libx264 + the
 * composer filters, `atempo` when audio) are injected into the wrappers.
 */

import { writeFile } from 'node:fs/promises'

import {
  probeFfmpeg as probeFfmpegBin,
  resolveFfmpeg as resolveFfmpegBin,
  runProcess,
  runTool,
} from './mediaBinaries.mjs'
import { NARRATION_PCM } from './reelScript.mjs'
import { seconds } from './reelTimeline.mjs'

const REQUIRED_FILTERS = ['fade', 'overlay', 'scale', 'zoompan']
const AUDIO_REQUIRED_FILTERS = ['atempo']
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

export { runProcess, runTool }

/**
 * Capability probe: the binary must encode H.264 (libx264) and ship the
 * filters the composer uses. Missing capabilities are reported, never assumed.
 *
 * @param {string} bin
 * @param {{ run?: RunFn, audio?: boolean }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string } | { ok: false, bin: string, reason: string }>}
 */
export const probeFfmpeg = (bin, { audio = false, ...options } = {}) =>
  probeFfmpegBin(bin, {
    ...options,
    audio,
    encoders: ['libx264'],
    filters: [...REQUIRED_FILTERS, ...(audio ? AUDIO_REQUIRED_FILTERS : [])],
  })

/**
 * Resolves the first candidate that passes the reel probe. Explicit
 * `FFMPEG_PATH` is strict.
 *
 * @param {{ env?: Record<string, string | undefined>, run?: RunFn, installer?: { path?: string } | null, audio?: boolean }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string, source: string }>}
 */
export const resolveFfmpeg = (options = {}) =>
  resolveFfmpegBin({
    requirementsLabel: `libx264 + filtros do reel${options.audio ? ' + áudio' : ''}`,
    ...options,
    encoders: ['libx264'],
    filters: [...REQUIRED_FILTERS, ...(options.audio ? AUDIO_REQUIRED_FILTERS : [])],
  })

/** @type {typeof runTool} */
export const runFfmpeg = (bin, args, options = {}) =>
  runTool(bin, args, { label: 'ffmpeg', ...options })

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
  run = runProcess,
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

/**
 * C197 — decode one TTS beat (mp3) to the raw narration PCM, optionally
 * applying the `atempo` fit in the same pass.
 *
 * @param {{ input: string, output: string, tempo?: number | null }} options
 * @returns {string[]}
 */
export const buildAudioDecodeArgs = ({ input, output, tempo = null }) => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  input,
  ...(tempo && tempo !== 1 ? ['-filter:a', `atempo=${tempo}`] : []),
  '-ac',
  String(NARRATION_PCM.channels),
  '-ar',
  String(NARRATION_PCM.sampleRate),
  '-c:a',
  'pcm_s16le',
  '-f',
  's16le',
  '-y',
  output,
]

/** Encode the padded narration PCM track into `narracao.mp3` (mono 128 kbps). */
export const buildNarrationEncodeArgs = ({ input, output }) => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  's16le',
  '-ar',
  String(NARRATION_PCM.sampleRate),
  '-ac',
  String(NARRATION_PCM.channels),
  '-i',
  input,
  '-c:a',
  'libmp3lame',
  '-b:a',
  '128k',
  '-y',
  output,
]

/**
 * Mux `narracao.mp3` into a copy of `reel.mp4` — the video stream is copied
 * bit-for-bit (both variants share the same track) and the audio becomes AAC.
 *
 * @param {{ video: string, audio: string, output: string }} options
 * @returns {string[]}
 */
export const buildMuxAudioVideoArgs = ({ video, audio, output }) => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  video,
  '-i',
  audio,
  '-map',
  '0:v:0',
  '-map',
  '1:a:0',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-shortest',
  '-movflags',
  '+faststart',
  '-y',
  output,
]
