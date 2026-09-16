import { NextResponse } from 'next/server'

import { deleteSpeechCutForActor } from '@/app/(campaign)/campanha/actions/speech'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_GENERIC_ERROR_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
} from '@/lib/schemas/speechCut'
import {
  CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE,
  campaignJsonMutationErrorResponse,
} from '@/utilities/campaignJsonMutationRoute'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { SpeechCutDeleteResponse } from '../types'

type RouteContext = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

/**
 * C183 — hard deletes one cut. It cannot ride `campaignJsonMutationRoute`
 * (that wrapper builds POST and parses a JSON body; the id is in the path), so
 * it repeats the same-origin guard and error envelope explicitly. The
 * `codebaseConventions` sweep pins the `isSameOriginRequest` call for every
 * DELETE route.
 */
export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse<SpeechCutDeleteResponse>> => {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { status: 'error', message: CAMPAIGN_JSON_INVALID_REQUEST_MESSAGE },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const cutId = strictDecimalInteger(id)
  if (!cutId) {
    return NextResponse.json(
      { status: 'error', message: SPEECH_CUT_NOT_FOUND_MESSAGE },
      { status: 400 },
    )
  }

  try {
    await deleteSpeechCutForActor({ cutId })
    return NextResponse.json<SpeechCutDeleteResponse>({ status: 'success', deleted: true })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: [SPEECH_CUT_FORBIDDEN_MESSAGE, SPEECH_CUT_NOT_FOUND_MESSAGE],
      genericMessage: SPEECH_CUT_GENERIC_ERROR_MESSAGE,
    })
  }
}
