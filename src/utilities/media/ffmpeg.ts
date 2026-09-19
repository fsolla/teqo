import 'server-only'

import { execFile } from 'node:child_process'

/**
 * C199 — the single owner of ffmpeg execution: the binary resolution, the
 * stdout/stderr capture and the timeout policy. Extracted from the Câmara media
 * pipeline so the cut/poster jobs and the recording transcription job share one
 * implementation instead of a twin.
 *
 * `FFMPEG_PATH` lets a test/runtime point at a fake binary; the image ships
 * `ffmpeg` (`Dockerfile`).
 */

const FFMPEG_MIN_TIMEOUT_MS = 30_000
const FFMPEG_MAX_TIMEOUT_MS = 300_000
const FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024

const ffmpegBinary = (): string => process.env.FFMPEG_PATH?.trim() || 'ffmpeg'

/** Last-resort copy when an error carries no message; each job names its own. */
export const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== '' ? error.message : fallback

/**
 * Runs ffmpeg with a timeout scaled by the source duration (clamped to a
 * floor/ceiling). `timeoutMs` overrides the clamp for jobs that already know
 * the real budget (the recording extraction can run for hours).
 */
export const runFfmpeg = (
  args: string[],
  durationSeconds: number,
  fallbackMessage = 'Falha ao processar o vídeo.',
  timeoutMs?: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout =
      timeoutMs ??
      Math.min(FFMPEG_MAX_TIMEOUT_MS, Math.max(FFMPEG_MIN_TIMEOUT_MS, durationSeconds * 8_000))
    execFile(
      ffmpegBinary(),
      args,
      { timeout, maxBuffer: FFMPEG_MAX_BUFFER_BYTES },
      (error, _stdout, stderr) => {
        if (!error) {
          resolve()
          return
        }
        const detail = String(stderr ?? '')
          .trim()
          .slice(-400)
        reject(new Error(`${messageOf(error, fallbackMessage)}${detail ? ` — ${detail}` : ''}`))
      },
    )
  })
