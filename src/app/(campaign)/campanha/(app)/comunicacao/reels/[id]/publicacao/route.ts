import { NextResponse } from 'next/server'

import { setReelPublishedForActor } from '@/app/(campaign)/campanha/actions/reels'
import {
  REEL_FORBIDDEN_MESSAGE,
  REEL_GENERIC_ERROR_MESSAGE,
  REEL_NOT_FOUND_MESSAGE,
  reelPublicationRequestSchema,
} from '@/lib/schemas/reel'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { ReelPublicationResponse } from '../types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: reelPublicationRequestSchema,
    safeMessages: [REEL_FORBIDDEN_MESSAGE, REEL_NOT_FOUND_MESSAGE],
    genericMessage: REEL_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const reel = await setReelPublishedForActor(body)

    return NextResponse.json<ReelPublicationResponse>({ status: 'success', reel })
  },
)
