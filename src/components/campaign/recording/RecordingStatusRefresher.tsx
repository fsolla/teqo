'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import type { RecordingStatusResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/types'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_RECORDING_STATUS_HREF } from '@/lib/campaignPaths'

/**
 * C199 — keeps the honest processing states moving without a full reload: while
 * a visible recording is `uploading`/`processing`, polls the status route and
 * refreshes the server tree when any state changed. Silent on failure — the
 * next tick retries; pauses on a hidden tab.
 */
export const RecordingStatusRefresher = ({
  recordings,
  intervalMs = 5_000,
}: {
  recordings: readonly { id: number; status: string }[]
  intervalMs?: number
}) => {
  const router = useRouter()
  const pending = recordings.some(
    (recording) => recording.status === 'uploading' || recording.status === 'processing',
  )
  const signature = recordings
    .map((recording) => `${recording.id}:${recording.status}`)
    .sort()
    .join(',')

  useEffect(() => {
    // Terminal states never poll: the timer only exists while something is
    // actually moving.
    if (!signature || !pending) return
    const ids = signature.split(',').map((entry) => Number(entry.split(':')[0]))
    let stopped = false

    const tick = async () => {
      if (stopped || document.visibilityState === 'hidden') return
      try {
        const { ok, payload } = await postCampaignJson<RecordingStatusResponse>(
          CAMPAIGN_RECORDING_STATUS_HREF,
          { recordingIds: ids },
        )
        if (stopped || !ok || payload.status !== 'success') return
        const nextSignature = payload.recordings
          .map((recording) => `${recording.id}:${recording.status}`)
          .sort()
          .join(',')
        if (nextSignature !== signature) router.refresh()
      } catch {
        // A failed poll is a lost tick, never a user-facing error.
      }
    }

    const timer = window.setInterval(() => void tick(), intervalMs)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [signature, pending, intervalMs, router])

  return null
}
