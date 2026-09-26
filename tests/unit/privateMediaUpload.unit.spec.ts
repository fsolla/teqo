// @vitest-environment node

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createPrivateMediaFromFile } from '@/utilities/privateMedia/privateMediaUpload'

const withTempFile = async (
  bytes: Buffer,
  run: (path: string, dir: string) => Promise<void>,
): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), 'private-media-upload-test-'))
  try {
    const path = join(dir, 'source-video.mp4')
    await writeFile(path, bytes)
    await run(path, dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('private media from a local file', () => {
  it('uses the Payload path below the buffer boundary', async () => {
    await withTempFile(Buffer.alloc(16), async (path) => {
      const created: string[] = []
      let uploads = 0
      const result = await createPrivateMediaFromFile({
        inputPath: path,
        thresholdBytes: 1024,
        create: async (filePath) => {
          created.push(filePath)
          return { id: 7, filename: 'source-video.mp4' }
        },
        update: async () => undefined,
        uploadLarge: async () => {
          uploads += 1
          throw new Error('não deveria subir em multipart')
        },
      })

      expect(result.id).toBe(7)
      expect(created).toEqual([path])
      expect(uploads).toBe(0)
      await result.cleanup()
    })
  })

  it('creates the row from a placeholder and overwrites it through the multipart seam', async () => {
    await withTempFile(Buffer.alloc(16), async (path, dir) => {
      const created: string[] = []
      const updated: { id: number; data: { filesize: number; mimeType: string } }[] = []
      const uploaded: { inputPath: string; filename?: string; maxBytes?: number }[] = []
      const removed: string[] = []

      const result = await createPrivateMediaFromFile({
        inputPath: path,
        placeholderPath: join(dir, 'placeholder', 'meu-video.mp4'),
        thresholdBytes: 0,
        maxBytes: Number.POSITIVE_INFINITY,
        create: async (filePath) => {
          created.push(filePath)
          return { id: 42, filename: 'meu-video.mp4' }
        },
        update: async (id, data) => {
          updated.push({ id, data })
          return { id }
        },
        uploadLarge: async (args) => {
          uploaded.push(args)
          return {
            filename: args.filename ?? 'meu-video.mp4',
            mimeType: 'video/mp4',
            filesize: 16,
            url: 'http://127.0.0.1:3900/teqo-media/meu-video.mp4',
          }
        },
        removeLarge: async ({ filename }) => {
          removed.push(filename)
        },
      })

      expect(result.id).toBe(42)
      expect(created[0]).toContain(join('placeholder', 'meu-video.mp4'))
      expect((await stat(created[0])).size).toBe(0)
      expect(await readFile(created[0])).toEqual(Buffer.alloc(0))
      expect(uploaded).toEqual([
        { inputPath: path, filename: 'meu-video.mp4', maxBytes: Number.POSITIVE_INFINITY },
      ])
      expect(updated).toEqual([{ id: 42, data: { filesize: 16, mimeType: 'video/mp4' } }])
      expect(removed).toEqual([])

      await result.cleanup()
      expect(removed).toEqual(['meu-video.mp4'])
    })
  })

  it('removes the object when the multipart upload fails', async () => {
    await withTempFile(Buffer.alloc(16), async (path) => {
      const removed: string[] = []
      await expect(
        createPrivateMediaFromFile({
          inputPath: path,
          thresholdBytes: 0,
          create: async () => ({ id: 9, filename: 'falha.mp4' }),
          update: async () => undefined,
          uploadLarge: async () => {
            throw new Error('S3 indisponível.')
          },
          removeLarge: async ({ filename }) => {
            removed.push(filename)
          },
        }),
      ).rejects.toThrow('S3 indisponível.')
      expect(removed).toEqual(['falha.mp4'])
    })
  })

  it('fails closed when the placeholder row has no filename', async () => {
    await withTempFile(Buffer.alloc(16), async (path) => {
      let uploads = 0
      await expect(
        createPrivateMediaFromFile({
          inputPath: path,
          thresholdBytes: 0,
          create: async () => ({ id: 9, filename: null }),
          update: async () => undefined,
          uploadLarge: async () => {
            uploads += 1
            throw new Error('não deveria subir')
          },
          removeLarge: async () => undefined,
        }),
      ).rejects.toThrow('filename')
      expect(uploads).toBe(0)
    })
  })
})
