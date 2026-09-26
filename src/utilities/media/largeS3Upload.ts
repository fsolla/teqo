import 'server-only'

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

import { resolveS3StorageEnv } from '@/utilities/mediaStorage'

export const LARGE_MEDIA_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024
const MAX_LARGE_MEDIA_BYTES = 5 * 1024 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mka': 'audio/x-matroska',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
}

export type LargeMediaUpload = {
  filename: string
  mimeType: string
  filesize: number
  url: string
}

type S3UploadArgs = {
  client: S3Client
  bucket: string
  key: string
  contentType: string
  inputPath: string
  filesize: number
}

type S3DeleteArgs = {
  client: S3Client
  bucket: string
  key: string
}

const storageClient = (storage: {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}): S3Client =>
  new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  })

const defaultUpload = async ({
  client,
  bucket,
  key,
  contentType,
  inputPath,
  filesize,
}: S3UploadArgs): Promise<void> => {
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(inputPath),
      ContentLength: filesize,
      ContentType: contentType,
    },
    partSize: 64 * 1024 * 1024,
    queueSize: 4,
  })
  await upload.done()
}

const defaultDelete = async ({ client, bucket, key }: S3DeleteArgs): Promise<void> => {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

const extensionFor = (inputPath: string): string => {
  const extension = extname(inputPath).toLowerCase()
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : ''
}

export const mimeTypeForPath = (inputPath: string): string =>
  MIME_BY_EXTENSION[extensionFor(inputPath)] ?? 'application/octet-stream'

const requireStorage = (env: Record<string, string | undefined>) => {
  const storage = resolveS3StorageEnv(env)
  if (!storage.enabled) {
    throw new Error('Upload grande exige o storage S3 configurado; nenhuma mídia foi enviada.')
  }
  return storage
}

export const isLargeMedia = (
  filesize: number,
  thresholdBytes = LARGE_MEDIA_THRESHOLD_BYTES,
): boolean => filesize > thresholdBytes

export const uploadLargeMedia = async ({
  inputPath,
  filename: providedFilename,
  env = process.env,
  upload = defaultUpload,
}: {
  inputPath: string
  filename?: string
  env?: Record<string, string | undefined>
  upload?: (args: S3UploadArgs) => Promise<void>
}): Promise<LargeMediaUpload> => {
  const storage = requireStorage(env)
  const { size } = await stat(inputPath)
  if (size > MAX_LARGE_MEDIA_BYTES) {
    throw new Error(
      `Mídia de ${(size / 1024 / 1024 / 1024).toFixed(2)} GiB excede o limite de 5 GiB.`,
    )
  }

  const filename = providedFilename ?? `web-${randomUUID()}${extensionFor(inputPath)}`
  if (!/^[\w.-]+$/.test(filename)) {
    throw new Error('Nome de arquivo de mídia grande inválido.')
  }
  const mimeType = mimeTypeForPath(inputPath)
  const client = storageClient(storage)
  await upload({
    client,
    bucket: storage.bucket,
    key: filename,
    contentType: mimeType,
    inputPath,
    filesize: size,
  })

  return {
    filename,
    mimeType,
    filesize: size,
    url: `${storage.endpoint.replace(/\/$/, '')}/${storage.bucket}/${encodeURIComponent(filename)}`,
  }
}

export const deleteLargeMedia = async ({
  filename,
  env = process.env,
  remove = defaultDelete,
}: {
  filename: string
  env?: Record<string, string | undefined>
  remove?: (args: S3DeleteArgs) => Promise<void>
}): Promise<void> => {
  const storage = requireStorage(env)
  await remove({
    client: storageClient(storage),
    bucket: storage.bucket,
    key: filename,
  })
}
