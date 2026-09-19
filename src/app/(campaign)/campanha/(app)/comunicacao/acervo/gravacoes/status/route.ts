import { NextResponse } from 'next/server'

import { getRecordingStatusesForActor } from '@/app/(campaign)/campanha/actions/recording'
import {
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  recordingStatusRequestSchema,
} from '@/lib/schemas/recording'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { RecordingStatusResponse } from '../types'

export const dynamic = 'force-dynamic'

/** C199 — polls the statuses of the recordings visible in the list. */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: recordingStatusRequestSchema,
    safeMessages: [RECORDING_FORBIDDEN_MESSAGE],
    genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const recordings = await getRecordingStatusesForActor(body)
    return NextResponse.json<RecordingStatusResponse>({ status: 'success', recordings })
  },
)
