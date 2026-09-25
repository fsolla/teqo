import 'server-only'

import { execFile } from 'node:child_process'

/**
 * C215 — the single owner of yt-dlp execution for the web-speech ingestion:
 * binary resolution (`YTDLP_PATH` → `yt-dlp` on PATH, fail-closed), the
 * metadata probe (`--dump-json`) and the download of one URL to a local file.
 * YouTube and Instagram only; direct radio/audio files are fetched by
 * `downloadToFile`.
 *
 * C224 — the child environment is `process.env` without `NODE_OPTIONS`. The
 * repo wrapper (`--import=tsx/esm --import=./scripts/seed-loader.mjs`) is a
 * loader for this app, not for the JS runtime yt-dlp spawns to solve the
 * YouTube challenge; inheriting it kills the challenge with a misleading
 * `Requested format is not available`. Every other variable (PATH, HOME,
 * YTDLP_PATH, proxies) is forwarded untouched.
 *
 * There is no packaged yt-dlp: the operator installs it and the tests inject a
 * fake through `YTDLP_PATH`. The format cap keeps the mirrored artifact enough
 * for transcription, player and cut — never the master.
 */

export const YTDLP_INSTALL_HINT =
  'Instale o yt-dlp (ex.: `pipx install yt-dlp`) ou defina YTDLP_PATH.'

/** H.264/AAC up to 720p when available, then the best single file. */
export const YTDLP_FORMAT = 'bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=720]/b'

const VERSION_TIMEOUT_MS = 30_000
const METADATA_TIMEOUT_MS = 120_000
const DOWNLOAD_TIMEOUT_MS = 60 * 60_000
const MAX_BUFFER_BYTES = 16 * 1024 * 1024

export type YtDlpResult =
  | { ok: true; stdout: string; stderr: string }
  | {
      ok: false
      stdout: string
      stderr: string
      error?: { code?: string | number | null; message?: string }
    }

export type YtDlpRunner = (
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
) => Promise<YtDlpResult>

const defaultRunner: YtDlpRunner = (bin, args, { timeoutMs } = {}) =>
  new Promise((resolve) => {
    const { NODE_OPTIONS: _nodeOptions, ...childEnv } = process.env
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES, env: childEnv },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, stdout: stdout ?? '', stderr: stderr ?? '' })
          return
        }
        resolve({ ok: false, stdout: stdout ?? '', stderr: stderr ?? '', error })
      },
    )
  })

const ytDlpBinary = (env: Record<string, string | undefined> = process.env): string =>
  env.YTDLP_PATH?.trim() || 'yt-dlp'

export type YtDlpResolution = { ok: true; bin: string } | { ok: false; reason: string }

/** Probe of the resolved binary; a missing/unusable yt-dlp never degrades silently. */
export const resolveYtDlp = async ({
  env = process.env,
  run = defaultRunner,
}: {
  env?: Record<string, string | undefined>
  run?: YtDlpRunner
} = {}): Promise<YtDlpResolution> => {
  const bin = ytDlpBinary(env)
  const probe = await run(bin, ['--version'], { timeoutMs: VERSION_TIMEOUT_MS })
  if (!probe.ok) {
    const code = probe.error?.code
    return {
      ok: false,
      reason: code === 'ENOENT' ? `yt-dlp não encontrado (${bin})` : `yt-dlp não executou (${bin})`,
    }
  }
  return { ok: true, bin }
}

export type YtDlpMetadata = {
  externalId: string | null
  title: string | null
  channel: string | null
  durationSeconds: number | null
  thumbnailUrl: string | null
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const positiveNumberOrNull = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** One `--dump-json` document; absent fields stay null instead of guessing. */
export const parseYtDlpMetadata = (value: unknown): YtDlpMetadata => {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    externalId: stringOrNull(data.id),
    title: stringOrNull(data.title),
    channel: stringOrNull(data.channel) ?? stringOrNull(data.uploader),
    durationSeconds: positiveNumberOrNull(data.duration),
    thumbnailUrl: stringOrNull(data.thumbnail),
  }
}

const stderrTail = (result: Extract<YtDlpResult, { ok: false }>): string => {
  const tail = (result.stderr || result.error?.message || '').trim().slice(-400)
  return tail ? `: ${tail}` : ''
}

export const readYtDlpMetadata = async ({
  bin,
  url,
  run = defaultRunner,
}: {
  bin: string
  url: string
  run?: YtDlpRunner
}): Promise<YtDlpMetadata> => {
  const result = await run(
    bin,
    ['--dump-json', '--no-playlist', '--no-warnings', '--skip-download', url],
    { timeoutMs: METADATA_TIMEOUT_MS },
  )
  if (!result.ok) throw new Error(`yt-dlp não leu os metadados${stderrTail(result)}`)
  try {
    return parseYtDlpMetadata(JSON.parse(result.stdout))
  } catch {
    throw new Error('yt-dlp devolveu metadados fora do formato.')
  }
}

export const downloadWithYtDlp = async ({
  bin,
  url,
  outputTemplate,
  ffmpegLocation = null,
  run = defaultRunner,
}: {
  bin: string
  url: string
  outputTemplate: string
  ffmpegLocation?: string | null
  run?: YtDlpRunner
}): Promise<void> => {
  const result = await run(
    bin,
    [
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '-f',
      YTDLP_FORMAT,
      '--merge-output-format',
      'mp4',
      ...(ffmpegLocation ? ['--ffmpeg-location', ffmpegLocation] : []),
      '-o',
      outputTemplate,
      url,
    ],
    { timeoutMs: DOWNLOAD_TIMEOUT_MS },
  )
  if (!result.ok) throw new Error(`yt-dlp falhou no download${stderrTail(result)}`)
}
