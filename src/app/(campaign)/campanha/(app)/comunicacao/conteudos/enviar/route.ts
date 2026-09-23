import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { contentPieceTypeFromMime, toContentPieceViewModel } from '@/lib/contentPiece'
import {
  CONTENT_PIECE_FILE_TYPE_MESSAGE,
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_UPLOAD_SAFE_MESSAGES,
  contentPieceUploadMetadataSchema,
} from '@/lib/schemas/contentPiece'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import { receiveContentPieceUpload } from '@/utilities/content/contentPieceUpload'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { ContentPieceUploadResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C211 — accepts ONE piece as a RAW body: the request body IS the file, the
 * metadata (filename) travels in the query string. The same shape as the C199
 * recording upload, for the same reasons: a multi-GB file must stream to disk
 * (server actions cap at 1 MB and FormData buffers the whole media), the type
 * is derived on the server from the MIME/extension, and XHR still gives the
 * batch dialog a real `upload.onprogress` per file.
 *
 * It cannot ride `campaignJsonMutationRoute` (JSON-body wrapper), so it repeats
 * the same-origin guard and the error envelope explicitly and is allowlisted in
 * the `codebaseConventions` sweep.
 */

const errorResponse = (message: string, status: number): NextResponse<ContentPieceUploadResponse> =>
  NextResponse.json({ status: 'error', message }, { status })

export const POST = async (request: Request): Promise<NextResponse<ContentPieceUploadResponse>> => {
  if (!isSameOriginRequest(request)) {
    return errorResponse('Requisição inválida.', 403)
  }

  const user = await getCampaignUser()
  if (!user) return errorResponse(CAMPAIGN_AUTH_REQUIRED_MESSAGE, 401)
  if (!canReadCommunicationCatalog(user.role)) {
    return errorResponse(CONTENT_PIECE_FORBIDDEN_MESSAGE, 403)
  }

  const searchParams = new URL(request.url).searchParams
  const parsed = contentPieceUploadMetadataSchema.safeParse({
    filename: searchParams.get('filename') ?? '',
  })
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message ?? CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
      400,
    )
  }

  const type = contentPieceTypeFromMime(request.headers.get('content-type'), parsed.data.filename)
  if (type === null) {
    return errorResponse(CONTENT_PIECE_FILE_TYPE_MESSAGE, 400)
  }

  const contentLengthHeader = request.headers.get('content-length')
  const parsedLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
  const contentLength =
    parsedLength !== null && Number.isFinite(parsedLength) && parsedLength >= 0
      ? parsedLength
      : null

  try {
    const payload = await getPayload({ config })
    const { id } = await receiveContentPieceUpload({
      payload,
      actor: user,
      type,
      metadata: parsed.data,
      body: request.body,
      contentLength,
    })

    const piece = await payload.findByID({
      collection: 'contentPiece',
      id,
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
    return NextResponse.json<ContentPieceUploadResponse>({
      status: 'success',
      piece: toContentPieceViewModel(piece),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: CONTENT_PIECE_UPLOAD_SAFE_MESSAGES,
      genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
    })
  }
}
