import { NextResponse } from 'next/server'

import { setContentPiecePublishedForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
  contentPiecePublicationRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPiecePublicationResponse } from '../../types'

export const dynamic = 'force-dynamic'

/** C211 — the kill switch of one piece ("Publicar" / "Despublicar"). */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPiecePublicationRequestSchema,
    safeMessages: [CONTENT_PIECE_FORBIDDEN_MESSAGE, CONTENT_PIECE_NOT_FOUND_MESSAGE],
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const piece = await setContentPiecePublishedForActor(body)
    return NextResponse.json<ContentPiecePublicationResponse>({ status: 'success', piece })
  },
)
