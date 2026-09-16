import { NextResponse } from 'next/server'

import { retrySpeechCutForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE,
  speechCutCutIdRequestSchema,
} from '@/lib/schemas/speechCut'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutRetryResponse } from '../types'

export const dynamic = 'force-dynamic'

/** C183 — retries a failed cut from the library card/detail (same row, C167 job). */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutCutIdRequestSchema,
    safeMessages: [
      SPEECH_CUT_FORBIDDEN_MESSAGE,
      SPEECH_CUT_NOT_FOUND_MESSAGE,
      SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE,
    ],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const cut = await retrySpeechCutForActor(body)

    return NextResponse.json<SpeechCutRetryResponse>({ status: 'success', cut })
  },
)
