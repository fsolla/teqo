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
  RECORDING_SPEAKER_UNKNOWN_MESSAGE,
  recordingDeleteRequestSchema,
  recordingRetryRequestSchema,
  recordingSpeakerLabelRequestSchema,
  recordingStatusRequestSchema,
  type RecordingStatusRequest,
} from '@/lib/schemas/recording'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { onPayloadTransactionCommit, withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
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
  speakerLabels: true,
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
 * C200 — names one acoustic cluster of a recording. Human curation only: the
 * key must belong to a segment of this recording (a stale dialog cannot invent
 * a group), and the label is text on the recording — never a `Contact`. The
 * write triggers the collection's `deriveSpeakerNames` hook, which is what the
 * "Pessoa" facet filters on.
 *
 * Runs inside a transaction under an advisory lock of the recording and
 * re-reads the labels after acquiring it: two curators labeling different
 * clusters at the same time would otherwise each write back a stale array and
 * silently lose one label. The lock closes that read-modify-write race.
 */
export const labelRecordingSpeakerForActor = async (input: {
  recordingId: number
  speakerKey: string
  label: string
}): Promise<{ labeled: true }> => {
  const parsed = recordingSpeakerLabelRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(RECORDING_FORBIDDEN_MESSAGE)

  const current = await loadRecordingForActor(payload, actor, parsed.recordingId)
  if (!current) throw new Error(RECORDING_NOT_FOUND_MESSAGE)

  await withPayloadTransaction(payload, async ({ req }) => {
    await acquireTextAdvisoryLocks(payload, req, [`recording-speakers:${parsed.recordingId}`])

    const fresh = await payload.find({
      collection: 'recording',
      where: { id: { equals: parsed.recordingId } },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { speakerLabels: true },
      req,
      user: actor,
      overrideAccess: false,
    })
    const recording = fresh.docs[0]
    if (!recording) throw new Error(RECORDING_NOT_FOUND_MESSAGE)

    const segment = await payload.find({
      collection: 'recordingSegment',
      where: {
        and: [
          { recording: { equals: parsed.recordingId } },
          { speakerKey: { equals: parsed.speakerKey } },
        ],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { speakerKey: true },
      req,
      user: actor,
      overrideAccess: false,
    })
    if (!segment.docs[0]) throw new Error(RECORDING_SPEAKER_UNKNOWN_MESSAGE)

    const labels = [...(recording.speakerLabels ?? [])]
    const index = labels.findIndex((entry) => entry.speakerKey === parsed.speakerKey)
    const entry = { speakerKey: parsed.speakerKey, label: parsed.label }
    if (index >= 0) labels[index] = entry
    else labels.push(entry)

    await payload.update({
      collection: 'recording',
      id: parsed.recordingId,
      data: { speakerLabels: labels, speakerLabelsDropped: false },
      depth: 0,
      select: recordingSelect,
      req,
      user: actor,
      overrideAccess: false,
    })
  })

  return { labeled: true }
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
