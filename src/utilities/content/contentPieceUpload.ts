import 'server-only'

import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import {
  CONTENT_MEDIA_SLUG,
  CONTENT_PIECE_MAX_BYTES,
  CONTENT_PIECE_TEXT_MAX_BYTES,
  CONTENT_PIECE_TEXT_TOO_LARGE_MESSAGE,
  contentPieceTitleFromFilename,
  needsContentPieceProcessing,
  sanitizeContentPieceFilename,
  type ContentPieceOrigin,
  type ContentPieceType,
} from '@/lib/contentPiece'
import {
  CONTENT_PIECE_BODY_MISSING_MESSAGE,
  CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE,
  CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE,
  type ContentPieceUploadMetadata,
} from '@/lib/schemas/contentPiece'
import type { CampaignUser } from '@/payload-types'
import { startContentPieceJobInBackground } from '@/utilities/content/contentPieceScheduler'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C211 — the upload half of the Central de Conteúdos flow: stream the raw
 * request body to a temp file with the size ceiling enforced, then create the
 * private media and the visible piece in ONE transaction and hand the row to
 * the processing job. Nothing is persisted before the stream completes: a
 * dropped connection leaves no phantom "Processando" row to reap.
 *
 * The route owns the origin/session/role gate; this module owns the write path.
 */

const toUploadTooLarge = (): Error => new Error(CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE)

/**
 * Streams the request body to `destination`, enforcing the ceiling even when
 * the request arrives chunked (a missing/lying `Content-Length` cannot fill the
 * disk). Returns the received byte count.
 */
const streamBodyToFile = async ({
  body,
  destination,
  maxBytes,
}: {
  body: ReadableStream<Uint8Array>
  destination: string
  maxBytes: number
}): Promise<number> => {
  let received = 0
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        callback(toUploadTooLarge())
        return
      }
      callback(null, chunk)
    },
  })

  await pipeline(
    Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination),
  )
  return received
}

type CreatePieceInput = {
  title: string
  type: ContentPieceType
  origin: ContentPieceOrigin
  mediaId: number | null
  sourceUrl?: string | null
}

const createPiece = async ({
  payload,
  actor,
  input,
  filePath,
  req,
}: {
  payload: Payload
  actor: CampaignUser
  input: CreatePieceInput
  filePath?: string
  req?: Parameters<typeof payload.create>[0]['req']
}) => {
  let mediaId = input.mediaId
  if (filePath) {
    const media = await payload.create({
      collection: CONTENT_MEDIA_SLUG,
      data: { alt: input.title },
      filePath,
      depth: 0,
      user: actor,
      overrideAccess: false,
      ...(req ? { req } : {}),
    })
    mediaId = media.id
  }

  return payload.create({
    collection: 'contentPiece',
    data: {
      title: input.title,
      type: input.type,
      origin: input.origin,
      status: 'rascunho',
      processingStatus: needsContentPieceProcessing(input.type) ? 'processando' : 'pronto',
      ...(needsContentPieceProcessing(input.type) ? { step: 'extraindo' } : {}),
      ...(mediaId !== null ? { media: mediaId } : {}),
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    },
    depth: 0,
    user: actor,
    overrideAccess: false,
    ...(req ? { req } : {}),
  })
}

/**
 * Receives one uploaded file: streams it to a temp file, creates the private
 * media and the piece (status `processando`, step `extraindo`) in one
 * transaction and schedules the job. A text file is read into the transcript
 * at upload time (the extraction) and the file is archived like any other —
 * the ficha serves it and "despublicar preserva o arquivo" holds for text too.
 */
export const receiveContentPieceUpload = async ({
  payload,
  actor,
  type,
  metadata,
  body,
  contentLength,
  startJob = startContentPieceJobInBackground,
}: {
  payload: Payload
  actor: CampaignUser
  type: ContentPieceType
  metadata: ContentPieceUploadMetadata
  body: ReadableStream<Uint8Array> | null
  contentLength: number | null
  /** Injectable for tests; the route uses the `after()`-based default. */
  startJob?: (contentPieceId: number) => void
}): Promise<{ id: number }> => {
  if (contentLength !== null && contentLength > CONTENT_PIECE_MAX_BYTES) {
    throw new Error(CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE)
  }
  if (!body) throw new Error(CONTENT_PIECE_BODY_MISSING_MESSAGE)

  const title = contentPieceTitleFromFilename(metadata.filename)
  const startJobFor = (pieceId: number, pieceType: ContentPieceType): void => {
    if (needsContentPieceProcessing(pieceType)) startJob(pieceId)
  }
  let tempDir: string | null = null
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'content-piece-'))
    const uploadName = sanitizeContentPieceFilename(metadata.filename)
    const tempPath = join(tempDir, uploadName)
    const bytes = await streamBodyToFile({
      body,
      destination: tempPath,
      maxBytes: CONTENT_PIECE_MAX_BYTES,
    })

    // A text piece carries its content in the transcript (the extraction); the
    // file is archived all the same, so the ficha serves it and unpublishing
    // preserves it like any other piece.
    let transcript: string | null = null
    if (type === 'texto') {
      if (bytes > CONTENT_PIECE_TEXT_MAX_BYTES)
        throw new Error(CONTENT_PIECE_TEXT_TOO_LARGE_MESSAGE)
      transcript = await readFile(tempPath, 'utf8')
    }

    const piece = await withPayloadTransaction(payload, async ({ req }) => {
      const created = await createPiece({
        payload,
        actor,
        input: {
          title,
          type,
          origin: 'arquivo',
          mediaId: null,
          sourceUrl: null,
        },
        filePath: tempPath,
        req,
      })

      if (transcript !== null) {
        await payload.update({
          collection: 'contentPiece',
          id: created.id,
          data: { transcript },
          depth: 0,
          user: actor,
          overrideAccess: false,
          req,
        })
      }

      return created
    })

    startJobFor(piece.id, type)
    return { id: piece.id }
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * Attaches the original file to a link piece (the "Anexar arquivo original"
 * action): the platform offered no official path, so the assessoria supplies
 * the file — the piece then runs the same processing as an upload. The guard is
 * here and not only in the route, so no caller can replace an archived original
 * in silence.
 */
export const attachContentPieceMedia = async ({
  payload,
  actor,
  piece,
  filename,
  body,
  contentLength,
  startJob = startContentPieceJobInBackground,
}: {
  payload: Payload
  actor: CampaignUser
  piece: { id: number; title: string; type: ContentPieceType; media?: number | null }
  /** The uploaded file's name — the archived media keeps its extension. */
  filename: string
  body: ReadableStream<Uint8Array> | null
  contentLength: number | null
  startJob?: (contentPieceId: number) => void
}): Promise<{ id: number }> => {
  if (piece.media) throw new Error(CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE)
  if (contentLength !== null && contentLength > CONTENT_PIECE_MAX_BYTES) {
    throw new Error(CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE)
  }
  if (!body) throw new Error(CONTENT_PIECE_BODY_MISSING_MESSAGE)
  const processing = needsContentPieceProcessing(piece.type)

  let tempDir: string | null = null
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'content-piece-attach-'))
    const uploadName = sanitizeContentPieceFilename(filename)
    const tempPath = join(tempDir, uploadName)
    await streamBodyToFile({ body, destination: tempPath, maxBytes: CONTENT_PIECE_MAX_BYTES })

    await withPayloadTransaction(payload, async ({ req }) => {
      const media = await payload.create({
        collection: CONTENT_MEDIA_SLUG,
        data: { alt: piece.title },
        filePath: tempPath,
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
      await payload.update({
        collection: 'contentPiece',
        id: piece.id,
        data: {
          media: media.id,
          processingStatus: processing ? 'processando' : 'pronto',
          ...(processing ? { step: 'extraindo' } : {}),
          error: null,
          linkFailureReason: null,
        },
        depth: 0,
        user: actor,
        overrideAccess: false,
        req,
      })
    })

    if (processing) startJob(piece.id)
    return { id: piece.id }
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
