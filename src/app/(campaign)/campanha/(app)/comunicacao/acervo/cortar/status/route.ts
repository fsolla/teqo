import { NextResponse } from 'next/server'

import { getSpeechCutStatusForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  speechCutStatusRequestSchema,
} from '@/lib/schemas/speechCut'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutStatusResponse } from '../types'

export type { SpeechCutStatusResponse } from '../types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutStatusRequestSchema,
    safeMessages: [SPEECH_CUT_FORBIDDEN_MESSAGE, SPEECH_CUT_NOT_FOUND_MESSAGE],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const cut = await getSpeechCutStatusForActor(body)

    return NextResponse.json<SpeechCutStatusResponse>({ status: 'success', cut })
  },
)
