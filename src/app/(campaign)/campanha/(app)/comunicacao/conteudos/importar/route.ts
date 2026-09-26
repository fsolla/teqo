import { NextResponse } from 'next/server'

import { listContentPieceProfileImportCandidatesForActor } from '@/app/(campaign)/campanha/actions/contentPieces'
import {
  CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  CONTENT_PIECE_PROFILE_IMPORT_SAFE_MESSAGES,
  contentPieceProfileImportRequestSchema,
} from '@/lib/schemas/contentPiece'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ContentPieceProfileImportCandidatesResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C230 — lists the novelties of the official Instagram profile. The action
 * owns the fail-closed credential check, the feed window and the dedupe by
 * post identity; this route is the JSON door.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: contentPieceProfileImportRequestSchema,
    safeMessages: CONTENT_PIECE_PROFILE_IMPORT_SAFE_MESSAGES,
    genericMessage: CONTENT_PIECE_GENERIC_ERROR_MESSAGE,
  },
  async () => {
    const listing = await listContentPieceProfileImportCandidatesForActor()
    return NextResponse.json<ContentPieceProfileImportCandidatesResponse>({
      status: 'success',
      ...listing,
    })
  },
)
