// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  deleteLargeMedia,
  isLargeMedia,
  LARGE_MEDIA_THRESHOLD_BYTES,
  mimeTypeForPath,
  uploadLargeMedia,
} from '@/utilities/media/largeS3Upload'

const s3Env = {
  S3_BUCKET: 'teqo-media',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
}

const withTempFile = async (run: (path: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), 'large-s3-test-'))
  try {
    const path = join(dir, 'source.mp4')
    await writeFile(path, Buffer.alloc(16))
    await run(path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('large S3 media upload', () => {
  it('switches only above the 2 GiB Payload buffer boundary', () => {
    expect(isLargeMedia(LARGE_MEDIA_THRESHOLD_BYTES)).toBe(false)
    expect(isLargeMedia(LARGE_MEDIA_THRESHOLD_BYTES + 1)).toBe(true)
  })

  it('maps the media extension to a safe content type', () => {
    expect(mimeTypeForPath('/tmp/source.mp4')).toBe('video/mp4')
    expect(mimeTypeForPath('/tmp/source.mov')).toBe('video/quicktime')
    expect(mimeTypeForPath('/tmp/source.mkv')).toBe('video/x-matroska')
    expect(mimeTypeForPath('/tmp/source.m4v')).toBe('video/x-m4v')
    expect(mimeTypeForPath('/tmp/source.unknown')).toBe('application/octet-stream')
  })

  it('honors the default ceiling and an explicit caller override', async () => {
    await withTempFile(async (path) => {
      await expect(
        uploadLargeMedia({
          inputPath: path,
          env: s3Env,
          maxBytes: 8,
          upload: async () => undefined,
        }),
      ).rejects.toThrow('excede o limite')

      const keys: string[] = []
      await uploadLargeMedia({
        inputPath: path,
        env: s3Env,
        maxBytes: Number.POSITIVE_INFINITY,
        upload: async ({ key }) => {
          keys.push(key)
        },
      })
      expect(keys).toHaveLength(1)
    })
  })

  it('streams a large file to S3 and returns row metadata', async () => {
    await withTempFile(async (path) => {
      const calls: { key: string; contentType: string; filesize: number }[] = []
      const uploaded = await uploadLargeMedia({
        inputPath: path,
        env: s3Env,
        upload: async ({ key, contentType, filesize }) => {
          calls.push({ key, contentType, filesize })
        },
      })

      expect(uploaded.filename).toMatch(/^web-[0-9a-f-]+\.mp4$/)
      expect(uploaded.mimeType).toBe('video/mp4')
      expect(uploaded.filesize).toBe(16)
      expect(uploaded.url).toContain('/teqo-media/')
      expect(calls).toEqual([{ key: uploaded.filename, contentType: 'video/mp4', filesize: 16 }])
    })
  })

  it('fails closed when S3 is not configured', async () => {
    await withTempFile(async (path) => {
      await expect(
        uploadLargeMedia({
          inputPath: path,
          env: {},
          upload: async () => undefined,
        }),
      ).rejects.toThrow('S3')
    })
  })

  it('deletes the exact object key on cleanup', async () => {
    const keys: string[] = []
    await deleteLargeMedia({
      filename: 'web-test.mp4',
      env: s3Env,
      remove: async ({ key }) => {
        keys.push(key)
      },
    })
    expect(keys).toEqual(['web-test.mp4'])
  })
})
