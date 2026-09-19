import { NextResponse } from 'next/server'

import { labelRecordingSpeakerForActor } from '@/app/(campaign)/campanha/actions/recording'
import {
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_SPEAKER_UNKNOWN_MESSAGE,
  recordingSpeakerLabelRequestSchema,
} from '@/lib/schemas/recording'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { RecordingSpeakerLabelResponse } from '../../types'

export const dynamic = 'force-dynamic'

/** C200 — the team identifies one speaker cluster of the recording (human). */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: recordingSpeakerLabelRequestSchema,
    safeMessages: [
      RECORDING_FORBIDDEN_MESSAGE,
      RECORDING_NOT_FOUND_MESSAGE,
      RECORDING_SPEAKER_UNKNOWN_MESSAGE,
    ],
    genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const result = await labelRecordingSpeakerForActor(body)
    return NextResponse.json<RecordingSpeakerLabelResponse>({ status: 'success', ...result })
  },
)
