import { NextResponse } from 'next/server'

import { setSpeechCutPublishedForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  SPEECH_CUT_PUBLISH_NOT_READY_MESSAGE,
  speechCutPublicationRequestSchema,
} from '@/lib/schemas/speechCut'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechCutPublicationResponse } from '../types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechCutPublicationRequestSchema,
    safeMessages: [
      SPEECH_CUT_FORBIDDEN_MESSAGE,
      SPEECH_CUT_NOT_FOUND_MESSAGE,
      SPEECH_CUT_PUBLISH_NOT_READY_MESSAGE,
    ],
    genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const cut = await setSpeechCutPublishedForActor(body)

    return NextResponse.json<SpeechCutPublicationResponse>({ status: 'success', cut })
  },
)
