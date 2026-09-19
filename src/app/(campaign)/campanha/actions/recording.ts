'use server'

import type { Payload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  RECORDING_MEDIA_SLUG,
  toRecordingViewModel,
  type RecordingViewModel,
} from '@/lib/recording'
import {
  RECORDING_FORBIDDEN_MESSAGE,
  RECORDING_NOT_FOUND_MESSAGE,
  RECORDING_RETRY_NOT_FAILED_MESSAGE,
  recordingDeleteRequestSchema,
  recordingRetryRequestSchema,
  recordingStatusRequestSchema,
  type RecordingStatusRequest,
} from '@/lib/schemas/recording'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { onPayloadTransactionCommit, withPayloadTransaction } from '@/utilities/payloadTransaction'
import { reapStaleRecording } from '@/utilities/recordings/recordingJob'
import { startRecordingJobInBackground } from '@/utilities/recordings/recordingScheduler'

/**
 * C199 — mutations of one uploaded recording: retry the failed transcription,
 * poll the visible statuses and hard-delete the row with its transcript and
 * private media. The acervo gate is repeated fresh before any read or write
 * (same contract as the cut actions); the collection access is the final
 * barrier.
 */

const recordingSelect = {
  title: true,
  status: true,
  step: true,
  recordedAt: true,
  durationSeconds: true,
  media: true,
  updatedAt: true,
} as const

const loadRecordingForActor = async (
  payload: Payload,
  actor: CampaignUser,
  recordingId: number,
) => {
  const result = await payload.find({
    collection: 'recording',
    where: { id: { equals: recordingId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: recordingSelect,
    user: actor,
    overrideAccess: false,
  })
  return result.docs[0]
}

/** Retries the transcription of a failed recording (same row, same job). */
export const retryRecordingForActor = async (input: {
  recordingId: number
}): Promise<RecordingViewModel> => {
  const parsed = recordingRetryRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(RECORDING_FORBIDDEN_MESSAGE)

  const current = await loadRecordingForActor(payload, actor, parsed.recordingId)
  if (!current) throw new Error(RECORDING_NOT_FOUND_MESSAGE)
  if (current.status !== 'failed') throw new Error(RECORDING_RETRY_NOT_FAILED_MESSAGE)

  // Conditional update: two concurrent retries cannot both schedule a job.
  const updated = await payload.update({
    collection: 'recording',
    where: {
      and: [{ id: { equals: parsed.recordingId } }, { status: { equals: 'failed' } }],
    },
    data: { status: 'processing', step: 'extracting', error: null },
    depth: 0,
    select: recordingSelect,
    user: actor,
    overrideAccess: false,
  })
  const recording = updated.docs[0]
  if (!recording) throw new Error(RECORDING_RETRY_NOT_FAILED_MESSAGE)

  startRecordingJobInBackground(recording.id)
  return toRecordingViewModel(recording)
}

/**
 * Polls the statuses of the visible recordings; a stale `processing` row is
 * reaped to `failed` on the way (there is no queue to ask).
 */
export const getRecordingStatusesForActor = async (
  input: RecordingStatusRequest,
): Promise<RecordingViewModel[]> => {
  const parsed = recordingStatusRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(RECORDING_FORBIDDEN_MESSAGE)

  const where = { id: { in: parsed.recordingIds } }
  const first = await payload.find({
    collection: 'recording',
    where,
    depth: 0,
    limit: parsed.recordingIds.length,
    pagination: false,
    select: recordingSelect,
    user: actor,
    overrideAccess: false,
  })

  await Promise.all(
    first.docs.map((recording) =>
      reapStaleRecording(payload, {
        id: recording.id,
        status: recording.status,
        updatedAt: recording.updatedAt,
      }),
    ),
  )

  const result = await payload.find({
    collection: 'recording',
    where,
    depth: 0,
    limit: parsed.recordingIds.length,
    pagination: false,
    select: recordingSelect,
    user: actor,
    overrideAccess: false,
  })
  return result.docs.map(toRecordingViewModel)
}

/**
 * Hard-deletes one recording: the row and its transcript go in one transaction
 * (the collection's `beforeDelete` cascade owns the segments); the private media
 * row is removed after commit, best-effort, so a storage hiccup cannot fail the
 * delete the person asked for.
 */
export const deleteRecordingForActor = async (input: {
  recordingId: number
}): Promise<{ deleted: true }> => {
  const parsed = recordingDeleteRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(RECORDING_FORBIDDEN_MESSAGE)

  const current = await loadRecordingForActor(payload, actor, parsed.recordingId)
  if (!current) throw new Error(RECORDING_NOT_FOUND_MESSAGE)

  const mediaId = typeof current.media === 'number' ? current.media : (current.media?.id ?? null)

  await withPayloadTransaction(payload, async ({ transactionID, req }) => {
    await payload.delete({
      collection: 'recording',
      id: parsed.recordingId,
      user: actor,
      overrideAccess: false,
      req,
    })

    if (mediaId !== null) {
      onPayloadTransactionCommit(transactionID, () => {
        void payload
          .delete({
            collection: RECORDING_MEDIA_SLUG,
            id: mediaId,
            // Intentional admin bypass: cleanup of the file that belonged to
            // the recording this actor was authorized to delete.
            overrideAccess: true,
          })
          .catch(() => undefined)
      })
    }
  })

  return { deleted: true }
}
