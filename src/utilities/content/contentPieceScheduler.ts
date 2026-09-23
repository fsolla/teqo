import 'server-only'

import config from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { runContentPieceJob } from '@/utilities/content/contentPieceJob'

/**
 * C211 — starts the transcription/cataloguing after the upload (or retry)
 * response has been sent (`after` from `next/server`), so the request never
 * waits on ffmpeg or minutes of ASR. Kept apart from the job so
 * `contentPieceJob` stays importable in a plain Node test without the request
 * lifecycle — the same split as the C199 recordings.
 */
export const startContentPieceJobInBackground = (contentPieceId: number): void => {
  after(async () => {
    const payload = await getPayload({ config })
    await runContentPieceJob(payload, contentPieceId)
  })
}
