/**
 * C197 — the TTS draft provider of the reel: resolves the `edge-tts`
 * executable fail-closed (explicit path → dedicated venv → PATH), synthesizes
 * one beat per scene and builds the narration track at the exact duration of
 * the video (decode → measure PCM → `atempo` fit → silence pad → concat).
 *
 * `edge-tts` is Microsoft's free neural TTS, used here **only** for an
 * institutional draft: the voice is never cloned and the final decision is
 * human. The provider lives outside the npm tree (dedicated Python venv,
 * `pnpm reels:tts:setup`) so the Docker deploy's `--frozen-lockfile` install
 * never touches it.
 *
 * I/O is injectable (`run`, `readFileImpl`, `writeFileImpl`, `synthesize`) so
 * the orchestration is unit-tested without processes or network.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  buildAudioDecodeArgs,
  buildNarrationEncodeArgs,
  runFfmpeg,
  runProcess,
  runTool,
} from './reelFfmpeg.mjs'
import {
  fitBeat,
  MAX_BEAT_TEMPO,
  padPcmToSamples,
  pcmDurationMs,
  pcmSampleCount,
  secondsLabel,
} from './reelScript.mjs'

/**
 * @typedef {(bin: string, args: string[]) => Promise<{ ok: boolean, stdout: string, stderr: string, error?: { code?: string } }>} RunFn
 */

/**
 * @typedef {(path: string) => Promise<Buffer>} ReadFileFn
 * @typedef {(path: string, data: string | Buffer) => Promise<unknown>} WriteFileFn
 */

/** Dedicated venv of the TTS provider (gitignored; never part of the deploy). */
export const TTS_VENV_DIR = 'scripts/reels/.venv'

/** Institutional draft voice; override with `--voice=` or `REELS_TTS_VOICE`. */
export const DEFAULT_TTS_VOICE = 'pt-BR-AntonioNeural'

const venvBin = (root) => join(root, TTS_VENV_DIR, 'bin', 'edge-tts')

/**
 * First `edge-tts` candidate that answers `--help`: explicit `EDGE_TTS_PATH`
 * (strict), the dedicated venv, then PATH. Fails with the setup hint.
 *
 * @param {{ env?: Record<string, string | undefined>, root?: string, run?: RunFn }} [options]
 * @returns {Promise<{ bin: string, source: string }>}
 */
export const resolveEdgeTts = async ({
  env = process.env,
  root = process.cwd(),
  run = runProcess,
} = {}) => {
  const candidates = []
  const explicit = env.EDGE_TTS_PATH?.trim()
  if (explicit) candidates.push({ bin: explicit, source: 'EDGE_TTS_PATH', strict: true })
  candidates.push({ bin: venvBin(root), source: 'venv', strict: false })
  candidates.push({ bin: 'edge-tts', source: 'PATH', strict: false })
  const failures = []
  for (const candidate of candidates) {
    const probe = await run(candidate.bin, ['--help'])
    if (probe.ok) return { bin: candidate.bin, source: candidate.source }
    failures.push(`${candidate.source}: ${probe.error?.code ?? 'erro'}`)
    if (candidate.strict) break
  }
  throw new Error(
    `Nenhum edge-tts utilizável (${failures.join('; ')}). ` +
      'Rode `pnpm reels:tts:setup` para criar o venv do provider ou defina EDGE_TTS_PATH.',
  )
}

/**
 * Creates the dedicated venv and installs/updates `edge-tts` (idempotent).
 *
 * @param {{ root?: string, run?: RunFn, python?: string }} [options]
 * @returns {Promise<{ bin: string, source: string }>}
 */
export const setupEdgeTts = async ({
  root = process.cwd(),
  run = runProcess,
  python = 'python3',
} = {}) => {
  const venvDir = join(root, TTS_VENV_DIR)
  await runTool(python, ['-m', 'venv', venvDir], { run, label: 'python -m venv' })
  await runTool(join(venvDir, 'bin', 'pip'), ['install', '--upgrade', 'edge-tts'], {
    run,
    label: 'pip install edge-tts',
  })
  return resolveEdgeTts({ root, run })
}

/**
 * Synthesizes one beat to mp3. The spoken text goes through a file (`--file`),
 * never through argv: quotes/emoji/newlines in the script are data, not shell.
 *
 * @param {{ edgeTtsBin: string, text: string, voice: string, textPath: string, output: string, run?: RunFn, writeFileImpl?: WriteFileFn }} options
 */
export const synthesizeBeat = async ({
  edgeTtsBin,
  text,
  voice,
  textPath,
  output,
  run = runProcess,
  writeFileImpl = writeFile,
}) => {
  await writeFileImpl(textPath, `${text}\n`)
  await runTool(edgeTtsBin, ['--voice', voice, '--file', textPath, '--write-media', output], {
    run,
    label: `edge-tts (${voice})`,
  })
}

/**
 * One beat as PCM exactly as long as its scene window: decode the mp3, measure
 * it (PCM bytes — the packaged ffmpeg has no ffprobe), speed it up with
 * `atempo` when needed and pad/trim to the window. Fails closed when the line
 * does not fit under the intelligibility ceiling.
 *
 * @param {{ ffmpegBin: string, mp3Path: string, id: string, targetMs: number, workDir: string, run?: RunFn, readFileImpl?: ReadFileFn }} options
 * @returns {Promise<Buffer>}
 */
export const buildBeatPcm = async ({
  ffmpegBin,
  mp3Path,
  id,
  targetMs,
  workDir,
  run = runProcess,
  readFileImpl = readFile,
}) => {
  const pcmPath = join(workDir, `${id}.pcm`)
  await runFfmpeg(ffmpegBin, buildAudioDecodeArgs({ input: mp3Path, output: pcmPath }), {
    run,
    label: `decodificar fala ${id}`,
  })
  const raw = await readFileImpl(pcmPath)
  const durationMs = pcmDurationMs(raw.length)
  const { tempo, overflow } = fitBeat({ durationMs, targetMs })
  if (overflow) {
    throw new Error(
      `A fala da cena "${id}" dura ${secondsLabel(durationMs)} e não cabe na cena ` +
        `(${secondsLabel(targetMs)}, máximo ${secondsLabel(targetMs * MAX_BEAT_TEMPO)} com o atempo). ` +
        'Encurte a fala desta cena no shot list (ou divida a cena) e regenere.',
    )
  }
  let pcm = raw
  if (tempo !== 1) {
    const fitPath = join(workDir, `${id}-fit.pcm`)
    await runFfmpeg(ffmpegBin, buildAudioDecodeArgs({ input: mp3Path, output: fitPath, tempo }), {
      run,
      label: `ajustar fala ${id} (atempo ${tempo})`,
    })
    pcm = await readFileImpl(fitPath)
  }
  return padPcmToSamples(pcm, pcmSampleCount(targetMs))
}

/**
 * The whole narration track: one synthesized beat per scene, silence for mute
 * scenes, concatenated to the exact video duration and encoded to
 * `narracao.mp3`.
 *
 * @param {{ ffmpegBin: string, edgeTtsBin: string, voice: string, beats: Array<{ id: string, durationMs: number, text: string | null }>, workDir: string, mp3Path: string, run?: RunFn, readFileImpl?: ReadFileFn, writeFileImpl?: WriteFileFn, synthesize?: typeof synthesizeBeat }} options
 * @returns {Promise<{ durationMs: number }>}
 */
export const buildNarrationTrack = async ({
  ffmpegBin,
  edgeTtsBin,
  voice,
  beats,
  workDir,
  mp3Path,
  run = runProcess,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  synthesize = synthesizeBeat,
}) => {
  const audioDir = join(workDir, 'audio')
  await mkdir(audioDir, { recursive: true })
  const parts = []
  for (const beat of beats) {
    if (beat.text === null) {
      parts.push(padPcmToSamples(Buffer.alloc(0), pcmSampleCount(beat.durationMs)))
      continue
    }
    const beatMp3 = join(audioDir, `${beat.id}.mp3`)
    await synthesize({
      edgeTtsBin,
      text: beat.text,
      voice,
      textPath: join(audioDir, `${beat.id}.txt`),
      output: beatMp3,
      run,
      writeFileImpl,
    })
    parts.push(
      await buildBeatPcm({
        ffmpegBin,
        mp3Path: beatMp3,
        id: beat.id,
        targetMs: beat.durationMs,
        workDir: audioDir,
        run,
        readFileImpl,
      }),
    )
  }
  const track = Buffer.concat(parts)
  const pcmPath = join(audioDir, 'narracao.pcm')
  await writeFileImpl(pcmPath, track)
  await runFfmpeg(ffmpegBin, buildNarrationEncodeArgs({ input: pcmPath, output: mp3Path }), {
    run,
    label: 'encode da narração',
  })
  return { durationMs: pcmDurationMs(track.length) }
}
