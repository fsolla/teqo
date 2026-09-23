import { NextResponse } from 'next/server'

import { retryContentPieceForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
  CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
  contentPieceRetryRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceRetryResponse } from '../../types'

export const dynamic = 'force-dynamic'

/** C211 — retries the processing of a failed piece (same row, same job). */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceRetryRequestSchema,
    safeMessages: [
      CONTENT_PIECE_FORBIDDEN_MESSAGE,
      CONTENT_PIECE_NOT_FOUND_MESSAGE,
      CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
    ],
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const piece = await retryContentPieceForActor(body)
    return NextResponse.json<ContentPieceRetryResponse>({ status: 'success', piece })
  },
)
