import { NextResponse } from 'next/server'

import { deleteRecordingForActor } from '@/app/(campaign)/campanha/actions/recording'
import {
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
} from '@/lib/schemas/recording'
import {
  CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE,
  campaignJsonMutationErrorResponse,
} from '@/utilities/campaignJsonMutationRoute'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { RecordingDeleteResponse } from '../../types'

type RouteContext = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

/**
 * C199 — hard deletes one recording (row + transcript + private media). It
 * cannot ride `campaignJsonMutationRoute` (that wrapper builds POST and parses
 * a JSON body; the id is in the path), so it repeats the same-origin guard and
 * error envelope explicitly. The `codebaseConventions` sweep pins the
 * `isSameOriginRequest` call for every DELETE route.
 */
export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse<RecordingDeleteResponse>> => {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { status: 'error', message: CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const recordingId = strictDecimalInteger(id)
  if (!recordingId) {
    return NextResponse.json(
      { status: 'error', message: RECORDING_NOT_FOUND_MESSAGE },
      { status: 400 },
    )
  }

  try {
    await deleteRecordingForActor({ recordingId })
    return NextResponse.json<RecordingDeleteResponse>({ status: 'success', deleted: true })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: [RECORDING_FORBIDDEN_MESSAGE, RECORDING_NOT_FOUND_MESSAGE],
      genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
    })
  }
}
