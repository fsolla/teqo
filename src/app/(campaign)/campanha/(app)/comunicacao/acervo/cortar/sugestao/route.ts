import { NextResponse } from 'next/server'

import { suggestSpeechCutMetadataForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_INVALID_RANGE_MESSAGE,
  SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE,
  speechCutSuggestionRequestSchema,
} from '@/lib/schemas/speechCut'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutSuggestionResponse } from '../types'

export type { SpeechCutSuggestionResponse } from '../types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutSuggestionRequestSchema,
    safeMessages: [
      SPEECH_CUT_FORBIDDEN_MESSAGE,
      SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE,
      SPEECH_CUT_INVALID_RANGE_MESSAGE,
    ],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const suggestion = await suggestSpeechCutMetadataForActor(body)

    return NextResponse.json<SpeechCutSuggestionResponse>({ status: 'success', suggestion })
  },
)
