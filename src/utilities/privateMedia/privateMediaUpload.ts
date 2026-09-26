import 'server-only'

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

import {
  deleteLargeMedia,
  isLargeMedia,
  LARGE_MEDIA_THRESHOLD_BYTES,
  uploadLargeMedia,
} from '@/utilities/media/largeS3Upload'

/**
 * C225-large/C199 — creates one private upload row from a local file without
 * ever letting Payload's local API `fs.readFile` an arbitrarily large artifact:
 * above the buffer boundary the row is created through an empty placeholder and
 * the same object key is overwritten by a direct multipart stream, then the
 * stored `filesize`/MIME metadata is updated. Below the boundary the Payload
 * path is used as-is. The caller's `create`/`update` closures own collection,
 * access and transaction details.
 *
 * `cleanup` removes the multipart object; call it when the surrounding
 * transaction fails, since the row is rolled back with it.
 */

export type PrivateMediaFromFile = {
  id: number
  cleanup: () => Promise<void>
}

type PrivateMediaRow = { id: number; filename?: string | null }

export type CreatePrivateMediaFromFileArgs = {
  inputPath: string
  /**
   * Placeholder file the large path creates the row from; its basename is the
   * stored name Payload derives. Override it to keep the original file name.
   */
  placeholderPath?: string
  create: (filePath: string) => Promise<PrivateMediaRow>
  update: (id: number, data: { filesize: number; mimeType: string }) => Promise<unknown>
  thresholdBytes?: number
  /** Multipart ceiling; omit to keep the uploader default. */
  maxBytes?: number
  uploadLarge?: typeof uploadLargeMedia
  removeLarge?: typeof deleteLargeMedia
}

const noopCleanup = async (): Promise<void> => {}

export const createPrivateMediaFromFile = async ({
  inputPath,
  placeholderPath,
  create,
  update,
  thresholdBytes = LARGE_MEDIA_THRESHOLD_BYTES,
  maxBytes,
  uploadLarge = uploadLargeMedia,
  removeLarge = deleteLargeMedia,
}: CreatePrivateMediaFromFileArgs): Promise<PrivateMediaFromFile> => {
  const { size } = await stat(inputPath)
  if (!isLargeMedia(size, thresholdBytes)) {
    const media = await create(inputPath)
    return { id: media.id, cleanup: noopCleanup }
  }

  const placeholder =
    placeholderPath ?? join(dirname(inputPath), `payload-placeholder${extname(inputPath)}`)
  await mkdir(dirname(placeholder), { recursive: true })
  await writeFile(placeholder, Buffer.alloc(0))

  let uploadedFilename: string | null = null
  try {
    const media = await create(placeholder)
    uploadedFilename = media.filename ?? null
    if (!uploadedFilename) throw new Error('A mídia grande não recebeu um filename no S3.')
    const uploaded = await uploadLarge({
      inputPath,
      filename: uploadedFilename,
      ...(maxBytes === undefined ? {} : { maxBytes }),
    })
    await update(media.id, { filesize: uploaded.filesize, mimeType: uploaded.mimeType })

    const filename = uploadedFilename
    return {
      id: media.id,
      cleanup: async () => {
        await removeLarge({ filename }).catch(() => undefined)
      },
    }
  } catch (error) {
    if (uploadedFilename) await removeLarge({ filename: uploadedFilename }).catch(() => undefined)
    throw error
  }
}
