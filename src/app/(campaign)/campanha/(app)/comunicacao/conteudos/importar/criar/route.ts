import { NextResponse } from 'next/server'

import { createContentPieceFromProfilePostForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_PROFILE_IMPORT_SAFE_MESSAGES,
  contentPieceLinkRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceProfileImportCreateResponse } from '../../types'

export const dynamic = 'force-dynamic'

/**
 * C230 — creates one draft from one listed profile media through the C220
 * pipeline. The dialog calls it once per candidate, so a failure is isolated
 * to that publication and the others still import.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceLinkRequestSchema,
    safeMessages: CONTENT_PIECE_PROFILE_IMPORT_SAFE_MESSAGES,
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const result = await createContentPieceFromProfilePostForActor(body)
    return NextResponse.json<ContentPieceProfileImportCreateResponse>({
      status: 'success',
      outcome: result.outcome,
    })
  },
)
