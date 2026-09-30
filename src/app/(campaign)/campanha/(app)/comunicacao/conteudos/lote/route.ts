import { NextResponse } from 'next/server'

import { applyContentPieceBatchActionForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  contentPieceBatchRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceBatchResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C236 — the batch gateway of the Central list: one request carries the verb
 * and the ids of the visible page; the action repeats the unit gesture per
 * piece and answers the honest outcome (affected × failures). The loop belongs
 * to the server, next to the semantics it reuses — the client only renders the
 * receipt.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceBatchRequestSchema,
    safeMessages: [CONTENT_PIECE_FORBIDDEN_MESSAGE],
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const outcome = await applyContentPieceBatchActionForActor(body)
    return NextResponse.json<ContentPieceBatchResponse>({ status: 'success', outcome })
  },
)
