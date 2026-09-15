import 'server-only'

import config from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { runSpeechCutJob } from '@/utilities/speech/speechCutJob'

/**
 * C167 — starts the cut after the create/retry response has been sent
 * (`after` from `next/server`), so the POST never waits on the Câmara download
 * or ffmpeg. Kept apart from the job so `speechCutJob` stays importable in a
 * plain Node test without the request lifecycle.
 */
export const startSpeechCutJobInBackground = (cutId: number): void => {
  after(async () => {
    const payload = await getPayload({ config })
    await runSpeechCutJob(payload, cutId)
  })
}
