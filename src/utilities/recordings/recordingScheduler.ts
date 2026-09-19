import 'server-only'

import config from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { runRecordingJob } from '@/utilities/recordings/recordingJob'

/**
 * C199 — starts the transcription after the upload/retry response has been sent
 * (`after` from `next/server`), so the request never waits on ffmpeg or hours
 * of ASR. Kept apart from the job so `recordingJob` stays importable in a plain
 * Node test without the request lifecycle.
 */
export const startRecordingJobInBackground = (recordingId: number): void => {
  after(async () => {
    const payload = await getPayload({ config })
    await runRecordingJob(payload, recordingId)
  })
}
