// @vitest-environment node

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { downloadUrlToFile } from '@/utilities/media/downloadToFile'

// C215 — the direct-acquisition streamer: non-2xx fails before writing, the
// byte ceiling guards the disk and the happy path writes the exact bytes.

let tempDir: string

const response = ({
  body,
  status = 200,
  headers = {},
}: {
  body: ReadableStream<Uint8Array> | null
  status?: number
  headers?: Record<string, string>
}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: new Headers(headers),
  }) as Response

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
      controller.close()
    },
  })

const fetchOf = (value: Response) => (async () => value) as unknown as typeof fetch

describe('downloadUrlToFile', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'download-to-file-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('writes the streamed body to the destination', async () => {
    const destinationPath = join(tempDir, 'ok.mp3')
    await downloadUrlToFile({
      url: 'https://radio.example/a.mp3',
      destinationPath,
      fetchImpl: fetchOf(response({ body: streamOf(['fala', ' da ', 'radio']) })),
    })
    expect(await readFile(destinationPath, 'utf8')).toBe('fala da radio')
  })

  it('fails on a non-2xx answer without writing the file', async () => {
    const destinationPath = join(tempDir, 'missing.mp3')
    await expect(
      downloadUrlToFile({
        url: 'https://radio.example/missing.mp3',
        destinationPath,
        fetchImpl: fetchOf(response({ body: null, status: 404 })),
      }),
    ).rejects.toThrow(/HTTP 404/)
  })

  it('fails when the response has no body', async () => {
    await expect(
      downloadUrlToFile({
        url: 'https://radio.example/empty.mp3',
        destinationPath: join(tempDir, 'empty.mp3'),
        fetchImpl: fetchOf(response({ body: null })),
      }),
    ).rejects.toThrow(/sem corpo/)
  })

  it('refuses a declared size above the ceiling', async () => {
    await expect(
      downloadUrlToFile({
        url: 'https://radio.example/big.mp3',
        destinationPath: join(tempDir, 'big.mp3'),
        fetchImpl: fetchOf(
          response({ body: streamOf(['x']), headers: { 'content-length': '99' } }),
        ),
        maxBytes: 10,
      }),
    ).rejects.toThrow(/tamanho máximo/)
  })

  it('aborts mid-stream when the body crosses the ceiling', async () => {
    await expect(
      downloadUrlToFile({
        url: 'https://radio.example/stream.mp3',
        destinationPath: join(tempDir, 'stream.mp3'),
        fetchImpl: fetchOf(response({ body: streamOf(['12345', '67890', 'x']) })),
        maxBytes: 10,
      }),
    ).rejects.toThrow(/tamanho máximo/)
  })
})
