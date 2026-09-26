// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { createWebSpeechMediaMirror } from '@/utilities/speech/webSpeechIngest'

describe('web speech media mirror', () => {
  it('overwrites the placeholder row through the large-media S3 seam', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'web-speech-mirror-test-'))
    const inputPath = join(dir, 'source.mp4')
    await writeFile(inputPath, Buffer.alloc(16))
    const created: { alt: string; filePath: string }[] = []
    const updated: { id: number; data: { filesize: number; mimeType: string } }[] = []
    const uploaded: { filename?: string; filesize?: number }[] = []
    const removed: string[] = []
    const payload = {
      create: async (args: { data: { alt: string }; filePath: string }) => {
        created.push({ alt: args.data.alt, filePath: args.filePath })
        return { id: 42, filename: 'source.mp4' }
      },
      update: async (args: { id: number; data: { filesize: number; mimeType: string } }) => {
        updated.push(args)
        return { id: args.id }
      },
    } as unknown as Payload

    try {
      const mirror = createWebSpeechMediaMirror({
        thresholdBytes: 0,
        uploadLarge: async ({ filename }) => {
          uploaded.push({ filename, filesize: 16 })
          return {
            filename: filename ?? 'source.mp4',
            mimeType: 'video/mp4',
            filesize: 16,
            url: 'http://127.0.0.1:3900/teqo-media/source.mp4',
          }
        },
        removeLarge: async ({ filename }) => {
          removed.push(filename)
        },
      })
      const result = await mirror({
        payload,
        req: {} as PayloadTransactionRequest,
        alt: 'YouTube — fala',
        inputPath,
      })
      await result.cleanup()

      expect(created).toHaveLength(1)
      expect(created[0].filePath).toContain('payload-placeholder.mp4')
      expect(uploaded).toEqual([{ filename: 'source.mp4', filesize: 16 }])
      expect(updated[0]).toMatchObject({
        id: 42,
        data: { filesize: 16, mimeType: 'video/mp4' },
      })
      expect(removed).toEqual(['source.mp4'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
