import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  RECORDING_FILE_TYPE_MESSAGE,
  recordingFileTypeAllowed,
  toRecordingViewModel,
} from '@/lib/recording'
import {
  RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE,
  RECORDING_CHUNK_TOO_LARGE_MESSAGE,
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_UPLOAD_NOT_IN_PROGRESS_MESSAGE,
  RECORDING_UPLOAD_SESSION_LOST_MESSAGE,
  RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE,
} from '@/lib/schemas/recording'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import {
  abortRecordingUpload,
  receiveRecordingChunk,
  RECORDING_BODY_MISSING_MESSAGE,
} from '@/utilities/recordings/recordingUpload'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { RecordingChunkResponse, RecordingUploadAbortResponse } from '../../types'

type RouteContext = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

/**
 * C199-fix — receives one part of an in-flight recording upload as a RAW body
 * (the request body IS the chunk, the index travels in the query). Sibling of
 * the start route and the second half of the boundary workaround: production
 * sits behind the Cloudflare Tunnel, whose edge refuses single request bodies
 * above ~100 MB with a 413 before the app sees them, so a multi-GB recording
 * is sliced by the dialog into parts of `RECORDING_UPLOAD_CHUNK_BYTES`.
 *
 * It cannot ride `campaignJsonMutationRoute` (JSON-body wrapper), so it repeats
 * the same-origin guard and the error envelope explicitly and is allowlisted in
 * the `codebaseConventions` sweep with its sibling.
 */

const errorResponse = (message: string, status: number): NextResponse<RecordingChunkResponse> =>
  NextResponse.json({ status: 'error', message }, { status })

const SAFE_MESSAGES = [
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_UPLOAD_NOT_IN_PROGRESS_MESSAGE,
  RECORDING_UPLOAD_SESSION_LOST_MESSAGE,
  RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE,
  RECORDING_CHUNK_TOO_LARGE_MESSAGE,
  RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE,
  RECORDING_FILE_TYPE_MESSAGE,
  RECORDING_BODY_MISSING_MESSAGE,
]

export const POST = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse<RecordingChunkResponse>> => {
  if (!isSameOriginRequest(request)) {
    return errorResponse('Requisição inválida.', 403)
  }

  const user = await getCampaignUser()
  if (!user) return errorResponse(CAMPAIGN_AUTH_REQUIRED_MESSAGE, 401)
  if (!canReadCommunicationCatalog(user.role)) {
    return errorResponse(RECORDING_FORBIDDEN_MESSAGE, 403)
  }

  const { id } = await context.params
  const recordingId = strictDecimalInteger(id)
  if (!recordingId) {
    return errorResponse(RECORDING_NOT_FOUND_MESSAGE, 400)
  }

  // `strictDecimalInteger` refuses 0, and the first part IS index 0.
  const rawIndex = new URL(request.url).searchParams.get('index') ?? ''
  const index = /^\d{1,9}$/.test(rawIndex) ? Number(rawIndex) : undefined
  if (index === undefined) {
    return errorResponse(RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE, 400)
  }

  if (!recordingFileTypeAllowed(request.headers.get('content-type'))) {
    return errorResponse(RECORDING_FILE_TYPE_MESSAGE, 400)
  }

  try {
    const payload = await getPayload({ config })
    const { done } = await receiveRecordingChunk({
      payload,
      actor: user,
      recordingId,
      index,
      body: request.body,
    })
    if (!done) {
      return NextResponse.json<RecordingChunkResponse>({ status: 'success', done: false })
    }

    const recording = await payload.findByID({
      collection: 'recording',
      id: recordingId,
      depth: 0,
      select: {
        title: true,
        status: true,
        step: true,
        recordedAt: true,
        durationSeconds: true,
      },
      user,
      overrideAccess: false,
    })
    return NextResponse.json<RecordingChunkResponse>({
      status: 'success',
      done: true,
      recording: toRecordingViewModel(recording),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: SAFE_MESSAGES,
      genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
    })
  }
}

/**
 * C199-fix — aborts an in-flight upload: removes the temp session and the row,
 * but ONLY while the row is still `uploading`. Idempotent on purpose: the
 * dialog calls it when a part fails and a lost response may have finalized the
 * upload already — the finalized recording must survive.
 */
export const DELETE = async (
  request: Request,
  context: RouteContext,
): Promise<NextResponse<RecordingUploadAbortResponse>> => {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const user = await getCampaignUser()
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: CAMPAIGN_AUTH_REQUIRED_MESSAGE },
      { status: 401 },
    )
  }
  if (!canReadCommunicationCatalog(user.role)) {
    return NextResponse.json(
      { status: 'error', message: RECORDING_FORBIDDEN_MESSAGE },
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
    const payload = await getPayload({ config })
    await abortRecordingUpload(payload, recordingId)
    return NextResponse.json<RecordingUploadAbortResponse>({ status: 'success', aborted: true })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: SAFE_MESSAGES,
      genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
    })
  }
}
