import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { CONTENT_MEDIA_SLUG, toContentPieceViewModel } from '@/lib/contentPiece'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
  CONTENT_PIECE_UPLOAD_SAFE_MESSAGES,
  contentPieceAttachRequestSchema,
} from '@/lib/schemas/contentPiece'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import { attachContentPieceMedia } from '@/utilities/content/contentPieceUpload'
import { buildPrivateMediaResponse } from '@/utilities/privateMedia/privateMediaResponse'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { ContentPieceAttachResponse } from '../../types'

export const dynamic = 'force-dynamic'

/**
 * C211 — the only door to a piece file. Lives under `/campanha` because the
 * `campaign-token` cookie is scoped to that path (a `<video>`/`<img>` sends the
 * cookie, never an Authorization header). The gate is the same communication
 * catalog predicate as the collection access, and every denial is a silent
 * `404` so the route never leaks which pieces exist.
 *
 * `GET` serves the archived file (range/download). `POST` attaches the original
 * file to a link piece as a RAW body — the "Anexar arquivo original" action,
 * allowlisted in the `codebaseConventions` sweep like the upload route.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL },
  })

const pieceIdFrom = async (params: Promise<{ id: string }>): Promise<number | null> => {
  const { id } = await params
  const pieceId = Number(id)
  return Number.isInteger(pieceId) && pieceId > 0 ? pieceId : null
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const user = await getCampaignUser()
  if (!user || !canReadCommunicationCatalog(user.role)) return notFound()

  const pieceId = await pieceIdFrom(params)
  if (pieceId === null) return notFound()

  const payload = await getPayload({ config })
  const piece = await payload
    .findByID({
      collection: 'contentPiece',
      id: pieceId,
      depth: 1,
      select: { media: true },
      user,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!piece?.media || typeof piece.media !== 'object') return notFound()

  const upload = payload.collections[CONTENT_MEDIA_SLUG].config.upload
  const staticDir =
    upload && typeof upload === 'object' && upload.staticDir ? upload.staticDir : CONTENT_MEDIA_SLUG

  return buildPrivateMediaResponse({
    media: piece.media,
    staticDir,
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
  })
}

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ContentPieceAttachResponse>> => {
  const errorResponse = (message: string, status: number) =>
    NextResponse.json<ContentPieceAttachResponse>({ status: 'error', message }, { status })

  if (!isSameOriginRequest(request)) return errorResponse('Requisição inválida.', 403)

  const user = await getCampaignUser()
  if (!user) return errorResponse(CAMPAIGN_AUTH_REQUIRED_MESSAGE, 401)
  if (!canReadCommunicationCatalog(user.role)) {
    return errorResponse(CONTENT_PIECE_FORBIDDEN_MESSAGE, 403)
  }

  const pieceId = await pieceIdFrom(params)
  const searchParams = new URL(request.url).searchParams
  const parsed = contentPieceAttachRequestSchema.safeParse({
    contentPieceId: pieceId,
    filename: searchParams.get('filename') ?? '',
  })
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message ?? CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
      400,
    )
  }

  const contentLengthHeader = request.headers.get('content-length')
  const parsedLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
  const contentLength =
    parsedLength !== null && Number.isFinite(parsedLength) && parsedLength >= 0
      ? parsedLength
      : null

  try {
    const payload = await getPayload({ config })
    const current = await payload.find({
      collection: 'contentPiece',
      where: { id: { equals: parsed.data.contentPieceId } },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { title: true, type: true, media: true },
      user,
      overrideAccess: false,
    })
    const piece = current.docs[0]
    if (!piece) return errorResponse(CONTENT_PIECE_NOT_FOUND_MESSAGE, 400)
    if (piece.media) return errorResponse(CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE, 400)

    await attachContentPieceMedia({
      payload,
      actor: user,
      piece: { id: piece.id, title: piece.title, type: piece.type, media: piece.media },
      filename: parsed.data.filename,
      body: request.body,
      contentLength,
    })

    const updated = await payload.findByID({
      collection: 'contentPiece',
      id: piece.id,
      depth: 0,
      select: {
        title: true,
        type: true,
        status: true,
        processingStatus: true,
        step: true,
        origin: true,
        topics: true,
        cityLabel: true,
        region: true,
        durationSeconds: true,
        pieceDate: true,
        publishedAt: true,
        error: true,
        media: true,
      },
      user,
      overrideAccess: false,
    })
    return NextResponse.json<ContentPieceAttachResponse>({
      status: 'success',
      piece: toContentPieceViewModel(updated),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: CONTENT_PIECE_UPLOAD_SAFE_MESSAGES,
      genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
    })
  }
}
