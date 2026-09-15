import { NextResponse } from 'next/server'

import { updateSpeechCutTextForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  speechCutTextUpdateRequestSchema,
} from '@/lib/schemas/speechCut'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutTextUpdateResponse } from '../types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutTextUpdateRequestSchema,
    safeMessages: [SPEECH_CUT_FORBIDDEN_MESSAGE, SPEECH_CUT_NOT_FOUND_MESSAGE],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const cut = await updateSpeechCutTextForActor(body)

    return NextResponse.json<SpeechCutTextUpdateResponse>({ status: 'success', cut })
  },
)
