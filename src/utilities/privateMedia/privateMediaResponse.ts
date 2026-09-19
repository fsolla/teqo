import 'server-only'

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { getRangeRequestInfo } from 'payload/internal'
import { pipeline } from 'stream/promises'

import {
  PRIVATE_MEDIA_CACHE_CONTROL,
  privateMediaHeaders,
  type PrivateMediaRange,
} from '@/lib/privateMedia'
import { resolveS3StorageEnv } from '@/utilities/mediaStorage'

/**
 * C193/C199 — the single owner of private media I/O: streams one artifact as an
 * HTTP response and downloads one object to a local file (the transcription job
 * reads the stored recording this way). Nothing here goes through the public
 * `/api/media/file` proxy — the authenticated route under `/campanha` and the
 * job are the only callers.
 *
 * In production the object lives in the private Garage bucket (same S3_* envs
 * as `media`); with no S3_* set (dev/test) it is read from the upload
 * collection's local disk directory, mirroring Payload's own file handler.
 */

export type PrivateMediaFile = {
  filename?: string | null
  filesize?: number | null
  mimeType?: string | null
}

type PrivateMediaStorage = { bucket: string; client: S3Client }

let cachedStorage: PrivateMediaStorage | null | undefined

const privateMediaStorage = (): PrivateMediaStorage | null => {
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

/** Resolves the on-disk path of an artifact, refusing any traversal attempt. */
const resolveLocalPath = (staticDir: string, filename: string): string => {
  if (!staticDir) throw new Error(`Diretório de mídia privada ausente: ${filename}`)
  const resolvedDir = path.resolve(staticDir)
  const filePath = path.resolve(resolvedDir, filename)
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Nome de arquivo de mídia privada inválido.')
  }
  return filePath
}

type OpenedObject = { range: PrivateMediaRange; body: BodyInit | null }

const openS3Object = async ({
  storage,
  filename,
  rangeHeader,
}: {
  storage: PrivateMediaStorage
  filename: string
  rangeHeader: string | null
}): Promise<OpenedObject> => {
  const head = await storage.client.send(
    new HeadObjectCommand({ Bucket: storage.bucket, Key: filename }),
  )
  const fileSize = head.ContentLength
  if (fileSize == null) throw new Error(`Objeto privado sem tamanho: ${filename}`)

  const range = getRangeRequestInfo({ fileSize, rangeHeader })
  if (range.type === 'invalid') return { range, body: null }

  const object = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: filename,
      ...(range.type === 'partial' ? { Range: `bytes=${range.rangeStart}-${range.rangeEnd}` } : {}),
    }),
  )
  if (!object.Body) throw new Error(`Objeto privado sem corpo: ${filename}`)

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
  const filePath = resolveLocalPath(staticDir, filename)
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
  new Response(null, { status: 404, headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL } })

/**
 * Streams one artifact. A missing object answers `404`; an unsatisfiable range
 * answers `416` (both with the private headers) — never a leaked S3 error.
 */
export const buildPrivateMediaResponse = async ({
  media,
  staticDir,
  rangeHeader,
  download,
}: {
  media: PrivateMediaFile
  staticDir: string
  rangeHeader: string | null
  download: boolean
}): Promise<Response> => {
  const filename = media.filename
  if (!filename) return notFound()

  try {
    const storage = privateMediaStorage()
    const opened = storage
      ? await openS3Object({ storage, filename, rangeHeader })
      : await openLocalObject({ staticDir, filename, rangeHeader })

    return new Response(opened.body, {
      status: opened.range.status,
      headers: privateMediaHeaders({
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

/**
 * Copies the stored artifact to `destinationPath` (the transcription job's
 * temp input). Streams end to end: a recording of hours never becomes a JS
 * Buffer. A missing object raises — the job maps it to `failed`.
 */
export const downloadPrivateMediaToFile = async ({
  media,
  staticDir,
  destinationPath,
}: {
  media: PrivateMediaFile
  staticDir: string
  destinationPath: string
}): Promise<void> => {
  const filename = media.filename
  if (!filename) throw new Error('Mídia privada sem nome de arquivo.')

  const storage = privateMediaStorage()
  if (!storage) {
    await pipeline(
      createReadStream(resolveLocalPath(staticDir, filename)),
      createWriteStream(destinationPath),
    )
    return
  }

  const object = await storage.client.send(
    new GetObjectCommand({ Bucket: storage.bucket, Key: filename }),
  )
  if (!object.Body) throw new Error(`Objeto privado sem corpo: ${filename}`)

  await pipeline(
    object.Body as unknown as NodeJS.ReadableStream,
    createWriteStream(destinationPath),
  )
}
