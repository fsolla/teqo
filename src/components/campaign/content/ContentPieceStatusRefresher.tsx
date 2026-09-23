'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import type { ContentPieceStatusResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_CONTENT_PIECE_STATUS_HREF } from '@/lib/campaignPaths'

/**
 * C211 — keeps the honest processing states moving without a full reload: while
 * a visible piece is `processando`, polls the status route and refreshes the
 * server tree when any state changed. Silent on failure — the next tick
 * retries; pauses on a hidden tab.
 */
export const ContentPieceStatusRefresher = ({
  pieces,
  intervalMs = 5_000,
}: {
  pieces: readonly { id: number; processingStatus: string }[]
  intervalMs?: number
}) => {
  const router = useRouter()
  const pending = pieces.some((piece) => piece.processingStatus === 'processando')
  const signature = pieces
    .map((piece) => `${piece.id}:${piece.processingStatus}`)
    .sort()
    .join(',')

  useEffect(() => {
    // Terminal states never poll: the timer only exists while something moves.
    if (!signature || !pending) return
    const ids = signature.split(',').map((entry) => Number(entry.split(':')[0]))
    let stopped = false

    const tick = async () => {
      if (stopped || document.visibilityState === 'hidden') return
      try {
        const { ok, payload } = await postCampaignJson<ContentPieceStatusResponse>(
          CAMPAIGN_CONTENT_PIECE_STATUS_HREF,
          { contentPieceIds: ids },
        )
        if (stopped || !ok || payload.status !== 'success') return
        const nextSignature = payload.pieces
          .map((piece) => `${piece.id}:${piece.processingStatus}`)
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
