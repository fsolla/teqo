import { NextResponse } from 'next/server'

import { retryRecordingForActor } from '@/app/(campaign)/campanha/actions/recording'
import {
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_RETRY_NOT_FAILED_MESSAGE,
  recordingRetryRequestSchema,
} from '@/lib/schemas/recording'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { RecordingRetryResponse } from '../../types'

export const dynamic = 'force-dynamic'

/** C199 — retries a failed transcription from the detail (same row, same job). */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: recordingRetryRequestSchema,
    safeMessages: [
      RECORDING_FORBIDDEN_MESSAGE,
      RECORDING_NOT_FOUND_MESSAGE,
      RECORDING_RETRY_NOT_FAILED_MESSAGE,
    ],
    genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const recording = await retryRecordingForActor(body)
    return NextResponse.json<RecordingRetryResponse>({ status: 'success', recording })
  },
)
