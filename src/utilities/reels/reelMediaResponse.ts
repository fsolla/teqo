import 'server-only'

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { getRangeRequestInfo } from 'payload/internal'

import { REEL_MEDIA_SLUG } from '@/lib/reel'
import { REEL_MEDIA_CACHE_CONTROL, reelMediaHeaders, type ReelMediaRange } from '@/lib/reelMedia'
import type { ReelMedia } from '@/payload-types'
import { resolveS3StorageEnv } from '@/utilities/mediaStorage'

/**
 * C193 — serves one private reel artifact as an HTTP response. The reel media
 * never goes through the public `/api/media/file` proxy: the authenticated
 * route under `/campanha` opens the object here and streams it back.
 *
 * In production the object lives in the private Garage bucket (same S3_* envs
 * as `media`); with no S3_* set (dev/test) it is read from the upload
 * collection's local disk directory, mirroring Payload's own file handler.
 */

const DEFAULT_STATIC_DIR = REEL_MEDIA_SLUG

type ReelMediaFile = Pick<ReelMedia, 'filename' | 'filesize' | 'mimeType'>

type ReelMediaStorage = { bucket: string; client: S3Client }

let cachedStorage: ReelMediaStorage | null | undefined

const reelMediaStorage = (): ReelMediaStorage | null => {
  if (cachedStorage !== undefined) return cachedStorage

  const config = resolveS3StorageEnv(process.env)
  cachedStorage = config.enabled
    ? {
        bucket: config.bucket,
        client: new S3Client({
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          region: config.region,
          endpoint: config.endpoint,
          forcePathStyle: true,
        }),
      }
    : null
  return cachedStorage
}

const isMissingObject = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const code = 'Code' in error ? String(error.Code) : ''
  const metadata =
    '$metadata' in error && error.$metadata && typeof error.$metadata === 'object'
      ? (error.$metadata as { httpStatusCode?: number })
      : null
  return (
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    code === 'NoSuchKey' ||
    metadata?.httpStatusCode === 404
  )
}

type OpenedObject = { range: ReelMediaRange; body: BodyInit | null }

const openS3Object = async ({
  storage,
  filename,
  rangeHeader,
}: {
  storage: ReelMediaStorage
  filename: string
  rangeHeader: string | null
}): Promise<OpenedObject> => {
  const head = await storage.client.send(
    new HeadObjectCommand({ Bucket: storage.bucket, Key: filename }),
  )
  const fileSize = head.ContentLength
  if (fileSize == null) throw new Error(`Objeto de reel sem tamanho: ${filename}`)

  const range = getRangeRequestInfo({ fileSize, rangeHeader })
  if (range.type === 'invalid') return { range, body: null }

  const object = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: filename,
      ...(range.type === 'partial' ? { Range: `bytes=${range.rangeStart}-${range.rangeEnd}` } : {}),
    }),
  )
  if (!object.Body) throw new Error(`Objeto de reel sem corpo: ${filename}`)

  return { range, body: object.Body as unknown as BodyInit }
}

const openLocalObject = async ({
  staticDir,
  filename,
  rangeHeader,
}: {
  staticDir: string
  filename: string
  rangeHeader: string | null
}): Promise<OpenedObject> => {
  const resolvedDir = path.resolve(staticDir || DEFAULT_STATIC_DIR)
  const filePath = path.resolve(resolvedDir, filename)
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Nome de arquivo de reel inválido.')
  }

  const stats = await stat(filePath)
  const range = getRangeRequestInfo({ fileSize: stats.size, rangeHeader })
  if (range.type === 'invalid') return { range, body: null }

  const body =
    range.type === 'partial'
      ? (createReadStream(filePath, {
          start: range.rangeStart,
          end: range.rangeEnd,
        }) as unknown as BodyInit)
      : (createReadStream(filePath) as unknown as BodyInit)

  return { range, body }
}

const notFound = (): Response =>
  new Response(null, { status: 404, headers: { 'Cache-Control': REEL_MEDIA_CACHE_CONTROL } })

/**
 * Streams one artifact. A missing object answers `404`; an unsatisfiable range
 * answers `416` (both with the private headers) — never a leaked S3 error.
 */
export const buildReelMediaResponse = async ({
  media,
  staticDir,
  rangeHeader,
  download,
}: {
  media: ReelMediaFile
  staticDir: string
  rangeHeader: string | null
  download: boolean
}): Promise<Response> => {
  const filename = media.filename
  if (!filename) return notFound()

  try {
    const storage = reelMediaStorage()
    const opened = storage
      ? await openS3Object({ storage, filename, rangeHeader })
      : await openLocalObject({ staticDir, filename, rangeHeader })

    return new Response(opened.body, {
      status: opened.range.status,
      headers: reelMediaHeaders({
        range: opened.range,
        mimeType: media.mimeType,
        filename,
        download,
      }),
    })
  } catch (error) {
    if (isMissingObject(error) || (error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return notFound()
    }
    throw error
  }
}
