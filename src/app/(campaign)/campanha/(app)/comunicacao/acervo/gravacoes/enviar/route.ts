import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  RECORDING_FILE_TYPE_MESSAGE,
  RECORDING_TITLE_REQUIRED_MESSAGE,
  recordingFileTypeAllowed,
  recordingUploadTooLargeMessage,
  toRecordingViewModel,
} from '@/lib/recording'
import {
  RECORDING_FILE_NAME_MESSAGE,
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  recordingUploadMetadataSchema,
} from '@/lib/schemas/recording'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import {
  receiveRecordingUpload,
  RECORDING_BODY_MISSING_MESSAGE,
} from '@/utilities/recordings/recordingUpload'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { RecordingUploadResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C199 — accepts one recording upload as a RAW body: the request body IS the
 * video, the metadata travels in the query string. A route handler instead of a
 * server action because a multi-GB file must stream to disk (the action default
 * of 1 MB and the FormData buffer of hours of video are both unacceptable); XHR
 * still gives the dialog a real `upload.onprogress`.
 *
 * It cannot ride `campaignJsonMutationRoute` (JSON-body wrapper), so it repeats
 * the same-origin guard and the error envelope explicitly and is allowlisted in
 * the `codebaseConventions` sweep, like the multipart `ai-transcribe` route.
 */

const errorResponse = (message: string, status: number): NextResponse<RecordingUploadResponse> =>
  NextResponse.json({ status: 'error', message }, { status })

const SAFE_MESSAGES = [
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_TITLE_REQUIRED_MESSAGE,
  RECORDING_FILE_NAME_MESSAGE,
  RECORDING_FILE_TYPE_MESSAGE,
  recordingUploadTooLargeMessage,
  RECORDING_BODY_MISSING_MESSAGE,
]

export const POST = async (request: Request): Promise<NextResponse<RecordingUploadResponse>> => {
  if (!isSameOriginRequest(request)) {
    return errorResponse('Requisição inválida.', 403)
  }

  const user = await getCampaignUser()
  if (!user) return errorResponse(CAMPAIGN_AUTH_REQUIRED_MESSAGE, 401)
  if (!canReadCommunicationCatalog(user.role)) {
    return errorResponse(RECORDING_FORBIDDEN_MESSAGE, 403)
  }

  const searchParams = new URL(request.url).searchParams
  const parsed = recordingUploadMetadataSchema.safeParse({
    title: searchParams.get('title') ?? '',
    recordedAt: searchParams.get('recordedAt') ?? undefined,
    filename: searchParams.get('filename') ?? '',
  })
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? RECORDING_GENERIC_ERROR_MESSAGE, 400)
  }

  if (!recordingFileTypeAllowed(request.headers.get('content-type'))) {
    return errorResponse(RECORDING_FILE_TYPE_MESSAGE, 400)
  }

  const contentLengthHeader = request.headers.get('content-length')
  const parsedLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
  const contentLength =
    parsedLength !== null && Number.isFinite(parsedLength) && parsedLength >= 0
      ? parsedLength
      : null

  try {
    const payload = await getPayload({ config })
    const { id } = await receiveRecordingUpload({
      payload,
      actor: user,
      metadata: parsed.data,
      body: request.body,
      contentLength,
    })

    const recording = await payload.findByID({
      collection: 'recording',
      id,
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
    return NextResponse.json<RecordingUploadResponse>({
      status: 'success',
      recording: toRecordingViewModel(recording),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: SAFE_MESSAGES,
      genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
    })
  }
}
