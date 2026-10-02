import 'server-only'

import type { Config } from '@/payload-types'

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import type { Payload } from 'payload'
import { getRangeRequestInfo } from 'payload/internal'
import sharp from 'sharp'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

import {
  isPrivateMediaMissingError,
  PRIVATE_MEDIA_CACHE_CONTROL,
  privateMediaHeaders,
  type PrivateMediaRange,
} from '@/lib/privateMedia'
import { messageOf } from '@/utilities/media/ffmpeg'
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

/**
 * The local disk directory of a private upload collection (dev/test fallback
 * when no S3_* is set), mirroring Payload's own file handler. Single owner for
 * the authenticated and the public serving routes.
 */
export const resolvePrivateMediaStaticDir = (
  payload: Payload,
  collectionSlug: keyof Config['collections'],
): string => {
  const upload = payload.collections[collectionSlug]?.config.upload
  return upload && typeof upload === 'object' && upload.staticDir
    ? upload.staticDir
    : collectionSlug
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

/** Long edge of the decode probe — the same size the face index feeds the engine. */
const INSPECTION_DECODE_MAX_EDGE = 1024

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

/**
 * Opens one object from whichever backing store is configured (the private S3
 * bucket in production, the collection's disk directory in dev/test). Single
 * owner of the choice — the streaming and the resizing paths share it.
 */
const openPrivateObject = async ({
  filename,
  staticDir,
  rangeHeader,
}: {
  filename: string
  staticDir: string
  rangeHeader: string | null
}): Promise<OpenedObject> => {
  const storage = privateMediaStorage()
  return storage
    ? openS3Object({ storage, filename, rangeHeader })
    : openLocalObject({ staticDir, filename, rangeHeader })
}

/**
 * C248 — existence probe of one private object in whichever store is
 * configured (S3 HEAD or local `stat`). Never throws: an unreachable store
 * reads as "not there", so the caller falls back to the on-the-fly path and
 * the generation is retried later; the worst case is redundant, idempotent
 * work, never a broken response.
 */
export const privateMediaObjectExists = async ({
  filename,
  staticDir,
}: {
  filename: string
  staticDir: string
}): Promise<boolean> => {
  try {
    const storage = privateMediaStorage()
    if (storage) {
      await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: filename }))
      return true
    }

    await stat(resolveLocalPath(staticDir, filename))
    return true
  } catch {
    return false
  }
}

/**
 * C248 — writes one derived object to whichever store is configured. On the
 * local disk the bytes land through a same-directory temp file + rename, so a
 * crash never leaves a half-written artifact at the canonical key; on S3 the
 * PUT is atomic by contract. The key and the MIME ride explicitly — there is
 * no upload row behind a derived object.
 */
export const writePrivateObject = async ({
  filename,
  staticDir,
  data,
  mimeType,
}: {
  filename: string
  staticDir: string
  data: Buffer
  mimeType: string
}): Promise<void> => {
  const storage = privateMediaStorage()
  if (storage) {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: filename,
        Body: data,
        ContentType: mimeType,
      }),
    )
    return
  }

  const filePath = resolveLocalPath(staticDir, filename)
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tempPath, data)
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

const notFound = (): Response =>
  new Response(null, { status: 404, headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL } })

/**
 * Streams one artifact. A missing object answers `404`; an unsatisfiable range
 * answers `416` (both with the private headers) — never a leaked S3 error.
 *
 * `dispositionFilename` overrides only the DOWNLOAD name (the storage key is
 * always `media.filename`): the public Central serves the legible
 * `jorge-solla-1313-<slug>.<ext>` name, since the browser honors the server
 * `Content-Disposition` over the anchor's `download` attribute. The
 * authenticated campaign route keeps the stored name (no override).
 */
export const buildPrivateMediaResponse = async ({
  media,
  staticDir,
  rangeHeader,
  download,
  dispositionFilename,
}: {
  media: PrivateMediaFile
  staticDir: string
  rangeHeader: string | null
  download: boolean
  dispositionFilename?: string | null
}): Promise<Response> => {
  const filename = media.filename
  if (!filename) return notFound()

  try {
    const opened = await openPrivateObject({ filename, staticDir, rangeHeader })

    return new Response(opened.body, {
      status: opened.range.status,
      headers: privateMediaHeaders({
        range: opened.range,
        mimeType: media.mimeType,
        filename: dispositionFilename?.trim() || filename,
        download,
      }),
    })
  } catch (error) {
    if (isPrivateMediaMissingError(error)) {
      return notFound()
    }
    throw error
  }
}

export type PrivateMediaImageFormat = 'jpeg' | 'avif'

/** The resize the public grid has always served on the fly (C233). */
const FALLBACK_JPEG_QUALITY = 80

/**
 * The shared sharp chain: `failOn: 'error'` keeps a truncated source from
 * becoming a half-decoded image and `rotate()` honors the EXIF orientation the
 * grid always did. `source` is the local input path, or `undefined` for the
 * stream path (the caller pipes into the returned transformer).
 */
const imageEncoder = (
  source: string | undefined,
  { width, format, quality }: { width: number; format: PrivateMediaImageFormat; quality: number },
): sharp.Sharp => {
  // sharp rejects `sharp(undefined, options)`; the stream path omits the input
  // entirely (the caller pipes into the returned transformer).
  const transformer = (source ? sharp(source, { failOn: 'error' }) : sharp({ failOn: 'error' }))
    .rotate()
    .resize({ width, withoutEnlargement: true })
  return format === 'avif' ? transformer.avif({ quality }) : transformer.jpeg({ quality })
}

/**
 * C248 — encodes one already-downloaded local image (the stored grade
 * generation). The temp file the caller owns is what tells a missing object
 * from a corrupt one, so this side is only the decode+encode.
 */
export const encodePrivateImageFile = async ({
  inputPath,
  width,
  format,
  quality,
}: {
  inputPath: string
  width: number
  format: PrivateMediaImageFormat
  quality: number
}): Promise<Buffer> => imageEncoder(inputPath, { width, format, quality }).toBuffer()

/**
 * C233/C248 — encodes one image straight from the private store (the public
 * grid's on-the-fly path). The stream never becomes a temp file: sharp's
 * constructor takes no stream, so the documented path is piping into the
 * instance and draining its output.
 */
const encodePrivateMediaImage = async ({
  media,
  staticDir,
  width,
  format,
  quality,
}: {
  media: PrivateMediaFile
  staticDir: string
  width: number
  format: PrivateMediaImageFormat
  quality: number
}): Promise<Buffer> => {
  const filename = media.filename
  if (!filename) throw new Error('Mídia privada sem nome de arquivo.')

  const opened = await openPrivateObject({ filename, staticDir, rangeHeader: null })
  if (!(opened.body instanceof Readable)) {
    throw new Error(`Objeto privado sem stream: ${filename}`)
  }

  const encoded = imageEncoder(undefined, { width, format, quality })
  const source = opened.body
  const resized = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    encoded.on('data', (chunk: Buffer) => chunks.push(chunk))
    encoded.on('end', () => resolve(Buffer.concat(chunks)))
    encoded.on('error', reject)
    source.on('error', reject)
  })
  source.pipe(encoded)
  return resized
}

/**
 * C233 — one image artifact, optionally resized for a public grid. With no
 * `width` it delegates to `buildPrivateMediaResponse` (range, stored MIME,
 * disposition); with a `width` it opens the same object and downsizes it on the
 * fly through sharp, without storing a variant and without a temp file — the
 * same rule the C232 cataloguing already runs over the archive. The private
 * headers survive (`no-store`), so a takedown is visible on the next request.
 */
export const buildPrivateMediaImageResponse = async ({
  media,
  staticDir,
  width,
  download,
  dispositionFilename,
  rangeHeader = null,
}: {
  media: PrivateMediaFile
  staticDir: string
  width: number | null
  download: boolean
  dispositionFilename?: string | null
  rangeHeader?: string | null
}): Promise<Response> => {
  if (width === null) {
    return buildPrivateMediaResponse({
      media,
      staticDir,
      rangeHeader,
      download,
      dispositionFilename,
    })
  }

  const filename = media.filename
  if (!filename) return notFound()

  try {
    const image = await encodePrivateMediaImage({
      media,
      staticDir,
      width,
      format: 'jpeg',
      quality: FALLBACK_JPEG_QUALITY,
    })

    return new Response(new Uint8Array(image), {
      status: 200,
      headers: privateMediaHeaders({
        range: { status: 200, headers: {} },
        mimeType: 'image/jpeg',
        filename: dispositionFilename?.trim() || filename,
        download,
      }),
    })
  } catch (error) {
    if (isPrivateMediaMissingError(error)) {
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

export type PrivateMediaObjectInspection =
  | { status: 'ok'; bytes: number }
  | { status: 'missing' }
  | { status: 'corrupt'; stage: 'download' | 'decode'; reason: string; bytes: number }

/**
 * C246 — read-only integrity probe of one stored object: it downloads the
 * artifact through the SAME path the serving routes and the face index use
 * (checksum validation of the S3 SDK included) and then forces a real decode of
 * the image with sharp (the same `failOn: 'error'` decode the public grid runs).
 * A missing object is classified as `missing`; every other read failure (a
 * checksum mismatch, for one) is `corrupt` at the `download` stage; a file that
 * downloads but does not decode is `corrupt` at the `decode` stage. Never
 * throws: the caller owns the receipt.
 *
 * `destinationPath` is a caller-owned temp path (the sweep removes it per
 * photo) — nothing here writes to the archive.
 */
export const inspectPrivateMediaObject = async ({
  media,
  staticDir,
  destinationPath,
}: {
  media: PrivateMediaFile
  staticDir: string
  destinationPath: string
}): Promise<PrivateMediaObjectInspection> => {
  if (!media.filename) return { status: 'missing' }

  try {
    await downloadPrivateMediaToFile({ media, staticDir, destinationPath })
  } catch (error) {
    if (isPrivateMediaMissingError(error)) return { status: 'missing' }
    return {
      status: 'corrupt',
      stage: 'download',
      reason: messageOf(error, 'erro desconhecido'),
      bytes: 0,
    }
  }

  let bytes = 0
  try {
    bytes = (await stat(destinationPath)).size
  } catch {
    // The decode below still classifies the failure; bytes stay 0.
  }

  try {
    await sharp(destinationPath, { failOn: 'error' })
      .rotate()
      .resize({ width: INSPECTION_DECODE_MAX_EDGE, withoutEnlargement: true })
      .toBuffer()
  } catch (error) {
    return {
      status: 'corrupt',
      stage: 'decode',
      reason: messageOf(error, 'erro desconhecido'),
      bytes,
    }
  }

  return { status: 'ok', bytes }
}
