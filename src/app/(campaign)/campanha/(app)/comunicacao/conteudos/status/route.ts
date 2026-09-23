import { NextResponse } from 'next/server'

import { getContentPieceStatusesForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  contentPieceStatusRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceStatusResponse } from '../types'

export const dynamic = 'force-dynamic'

/** C211 — polls the statuses of the pieces visible in the list. */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceStatusRequestSchema,
    safeMessages: [CONTENT_PIECE_FORBIDDEN_MESSAGE],
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const pieces = await getContentPieceStatusesForActor(body)
    return NextResponse.json<ContentPieceStatusResponse>({ status: 'success', pieces })
  },
)
