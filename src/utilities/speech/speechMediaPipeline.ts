import 'server-only'

import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { CAMARA_USER_AGENT } from '@/lib/speechVod'

/**
 * C182 — the Câmara media pipeline shared by the cut job (C167) and the acervo
 * frame job (C182): download one resolved VOD to a temp file. ffmpeg execution
 * is owned by `utilities/media/ffmpeg` (C199 extracted it for the recording
 * job); the temp dir lifecycle and the failure copy stay with each job.
 */

/** Defensive ceiling for the source download (the VOD of a speech is minutes long). */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024

const SOURCE_DOWNLOAD_TIMEOUT_MS = 180_000

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
