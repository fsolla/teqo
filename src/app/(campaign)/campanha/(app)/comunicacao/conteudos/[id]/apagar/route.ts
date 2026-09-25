import { NextResponse } from 'next/server'

import { deleteContentPieceForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
} from '@/lib/schemas/contentPiece'
import {
  CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE,
  campaignJsonMutationErrorResponse,
} from '@/utilities/campaignJsonMutationRoute'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { ContentPieceDeleteResponse } from '../../types'

type RouteContext = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

/**
 * C222 — hard deletes one piece (row + its private media file). It cannot ride
 * `campaignJsonMutationRoute` (that wrapper builds POST and parses a JSON body;
 * the id is in the path), so it repeats the same-origin guard and error
 * envelope explicitly — the shape the C183/C199 DELETE routes pin. The
 * `codebaseConventions` sweep pins the `isSameOriginRequest` call for every
 * DELETE route.
 */
export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ContentPieceDeleteResponse>> => {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { status: 'error', message: CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const contentPieceId = strictDecimalInteger(id)
  if (!contentPieceId) {
    return NextResponse.json(
      { status: 'error', message: CONTENT_PIECE_NOT_FOUND_MESSAGE },
      { status: 400 },
    )
  }

  try {
    await deleteContentPieceForActor({ contentPieceId })
    return NextResponse.json<ContentPieceDeleteResponse>({ status: 'success', deleted: true })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: [CONTENT_PIECE_FORBIDDEN_MESSAGE, CONTENT_PIECE_NOT_FOUND_MESSAGE],
      genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
    })
  }
}
