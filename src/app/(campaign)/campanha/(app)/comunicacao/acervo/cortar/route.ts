import { NextResponse } from 'next/server'

import { saveSpeechCutForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_INVALID_RANGE_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE,
  SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE,
  speechCutRequestSchema,
} from '@/lib/schemas/speechCut'
import { SPEECH_VOD_INELIGIBLE_MESSAGE } from '@/lib/schemas/speechVod'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutSaveResponse } from './types'

export type { SpeechCutSaveResponse } from './types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutRequestSchema,
    safeMessages: [
      SPEECH_CUT_FORBIDDEN_MESSAGE,
      SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE,
      SPEECH_CUT_NOT_FOUND_MESSAGE,
      SPEECH_CUT_INVALID_RANGE_MESSAGE,
      SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE,
      SPEECH_VOD_INELIGIBLE_MESSAGE,
    ],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const cut = await saveSpeechCutForActor(body)

    return NextResponse.json<SpeechCutSaveResponse>({ status: 'success', cut })
  },
)
