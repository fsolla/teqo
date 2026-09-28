import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  RECORDING_TITLE_REQUIRED_MESSAGE,
  RECORDING_UPLOAD_CHUNK_BYTES,
  toRecordingViewModel,
} from '@/lib/recording'
import {
  RECORDING_FILE_NAME_MESSAGE,
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_GENERIC_ERROR_MESSAGE,
  RECORDING_UPLOAD_NO_SPACE_MESSAGE,
  recordingUploadMetadataSchema,
} from '@/lib/schemas/recording'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import { startRecordingUpload } from '@/utilities/recordings/recordingUpload'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { RecordingUploadStartResponse } from '../types'

export const dynamic = 'force-dynamic'

/**
 * C199-fix — starts one recording upload. The production edge (Cloudflare
 * Tunnel) refuses any request body above ~100 MB with a 413 before the app
 * sees it, so the file cannot travel in one request: this bodyless call
 * creates the visible row and the on-disk session, then the dialog POSTs the
 * file in parts to `.../gravacoes/enviar/[id]`.
 *
 * It cannot ride `campaignJsonMutationRoute` (JSON-body wrapper), so it repeats
 * the same-origin guard and the error envelope explicitly and is allowlisted in
 * the `codebaseConventions` sweep, like the multipart `ai-transcribe` route.
 */

const errorResponse = (
  message: string,
  status: number,
): NextResponse<RecordingUploadStartResponse> =>
  NextResponse.json({ status: 'error', message }, { status })

const SAFE_MESSAGES = [
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_TITLE_REQUIRED_MESSAGE,
  RECORDING_FILE_NAME_MESSAGE,
  RECORDING_UPLOAD_NO_SPACE_MESSAGE,
]

export const POST = async (
  request: Request,
): Promise<NextResponse<RecordingUploadStartResponse>> => {
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
    size: searchParams.get('size') ?? '',
  })
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? RECORDING_GENERIC_ERROR_MESSAGE, 400)
  }

  try {
    const payload = await getPayload({ config })
    const { id } = await startRecordingUpload({
      payload,
      actor: user,
      metadata: parsed.data,
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
    return NextResponse.json<RecordingUploadStartResponse>({
      status: 'success',
      recording: toRecordingViewModel(recording),
      chunkSize: RECORDING_UPLOAD_CHUNK_BYTES,
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: SAFE_MESSAGES,
      genericMessage: RECORDING_GENERIC_ERROR_MESSAGE,
    })
  }
}
