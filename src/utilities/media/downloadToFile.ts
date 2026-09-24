import 'server-only'

import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

/**
 * C215 — streams one public URL to a local file: the direct acquisition path
 * of radio/audio findings (yt-dlp owns the platform extractors). A non-2xx
 * answer fails before anything is written, the body is never buffered in
 * memory and both a timeout and a byte ceiling bound a stalled or oversized
 * server (a partial file is removed by the caller's temp dir).
 */

/** Ceiling: hours of audio/video are the real case, 4 GiB is the guard. */
const DOWNLOAD_MAX_BYTES = 4 * 1024 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 60 * 60_000
const TOO_LARGE_MESSAGE = 'Download excede o tamanho máximo permitido.'

export const downloadUrlToFile = async ({
  url,
  destinationPath,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
  maxBytes = DOWNLOAD_MAX_BYTES,
  fetchImpl = fetch,
}: {
  url: string
  destinationPath: string
  timeoutMs?: number
  maxBytes?: number
  fetchImpl?: typeof fetch
}): Promise<void> => {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Download falhou (HTTP ${response.status}).`)
  if (!response.body) throw new Error('Download sem corpo.')

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(TOO_LARGE_MESSAGE)
  }

  let received = 0
  const ceiling = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        callback(new Error(TOO_LARGE_MESSAGE))
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
    ceiling,
    createWriteStream(destinationPath),
  )
}
