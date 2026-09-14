import { NextResponse } from 'next/server'

import { resolveSpeechVodForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_VOD_FORBIDDEN_MESSAGE,
  SPEECH_VOD_GENERIC_ERROR_MESSAGE,
  SPEECH_VOD_INELIGIBLE_MESSAGE,
  SPEECH_VOD_NOT_FOUND_MESSAGE,
  speechVodRequestSchema,
} from '@/lib/schemas/speechVod'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { SpeechVodResolveResponse } from './types'

export type { SpeechVodResolveResponse } from './types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: speechVodRequestSchema,
    safeMessages: [
      SPEECH_VOD_FORBIDDEN_MESSAGE,
      SPEECH_VOD_INELIGIBLE_MESSAGE,
      SPEECH_VOD_NOT_FOUND_MESSAGE,
    ],
    genericMessage: SPEECH_VOD_GENERIC_ERROR_MESSAGE,
  },
  async ({ speechId }) => {
    const resolution = await resolveSpeechVodForActor({ speechId })

    return NextResponse.json<SpeechVodResolveResponse>({ status: 'success', resolution })
  },
)
