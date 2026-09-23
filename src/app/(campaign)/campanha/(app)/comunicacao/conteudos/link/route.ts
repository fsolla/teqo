import { NextResponse } from 'next/server'

import { addContentPieceByLinkForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_SAFE_MESSAGES,
  contentPieceLinkRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceLinkResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C211 — adds a piece by link. The action owns the URL normalization, the
 * duplicate probe and the background extraction; this route is the JSON door.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceLinkRequestSchema,
    safeMessages: CONTENT_PIECE_SAFE_MESSAGES,
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const piece = await addContentPieceByLinkForActor(body)
    return NextResponse.json<ContentPieceLinkResponse>({ status: 'success', piece })
  },
)
