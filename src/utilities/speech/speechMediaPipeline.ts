import 'server-only'

import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { CAMARA_USER_AGENT } from '@/lib/speechVod'

/**
 * C182 — the Câmara media pipeline shared by the cut job (C167) and the acervo
 * frame job (C182): download one resolved VOD to a temp file and run ffmpeg on
 * it. Extracted from `speechCutJob` so both jobs own a single implementation;
 * the temp dir lifecycle and the failure copy stay with each job.
 */

/** `FFMPEG_PATH` lets a test/runtime point at a fake binary; the image ships `ffmpeg`. */
const ffmpegBinary = (): string => process.env.FFMPEG_PATH?.trim() || 'ffmpeg'

/** Defensive ceiling for the source download (the VOD of a speech is minutes long). */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024

const SOURCE_DOWNLOAD_TIMEOUT_MS = 180_000
const FFMPEG_MIN_TIMEOUT_MS = 30_000
const FFMPEG_MAX_TIMEOUT_MS = 300_000
const FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024

/** Last-resort copy when an error carries no message; each job names its own. */
export const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== '' ? error.message : fallback

/**
 * Streams the resolved VOD to a temp file. A `text/html` body is the CDN's
 * error page wearing a 200 (same rule as the C162 probe) and is refused.
 */
export const downloadSource = async (url: string, destination: string): Promise<void> => {
  const response = await fetch(url, {
    headers: { 'User-Agent': CAMARA_USER_AGENT },
    signal: AbortSignal.timeout(SOURCE_DOWNLOAD_TIMEOUT_MS),
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || contentType.includes('text/html')) {
    throw new Error(`A Câmara não entregou o arquivo do trecho (HTTP ${response.status}).`)
  }
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
    throw new Error('O arquivo do trecho na Câmara é grande demais para cortar.')
  }
  if (!response.body) throw new Error('A Câmara não entregou o corpo do arquivo do trecho.')

  // The counter enforces the ceiling even when the CDN answers chunked (no
  // content-length): the stream aborts instead of filling the disk.
  let received = 0
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > MAX_SOURCE_BYTES) {
        callback(new Error('O arquivo do trecho na Câmara é grande demais para cortar.'))
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination),
  )
}

/** Runs ffmpeg with a timeout scaled by the source duration (clamped to a floor/ceiling). */
export const runFfmpeg = (
  args: string[],
  durationSeconds: number,
  fallbackMessage = 'Falha ao processar o vídeo.',
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = Math.min(
      FFMPEG_MAX_TIMEOUT_MS,
      Math.max(FFMPEG_MIN_TIMEOUT_MS, durationSeconds * 8_000),
    )
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
