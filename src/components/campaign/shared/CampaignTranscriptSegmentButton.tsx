'use client'

import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import type { SpeechHighlightPart } from '@/lib/speechHighlight'
import { cn } from '@/lib/utils'

/**
 * The only contract a transcript line needs: it is structural on purpose, so
 * the Câmara/detail VMs of every acervo source (C200 recordings, C216 web
 * speeches) share one clickable segment without a twin.
 */
type TranscriptSegment = {
  startSeconds: number
  startLabel: string
  parts: readonly SpeechHighlightPart[]
}

/**
 * C200 — the clickable transcript line shared by the plain C199 list, the
 * grouped C200 blocks and the C216 web detail: seeks the player to the segment
 * and renders the search highlight. `variant` keeps the approved
 * paddings/sizes without a twin.
 */
export const CampaignTranscriptSegmentButton = ({
  segment,
  active,
  variant = 'plain',
  onSeek,
}: {
  segment: TranscriptSegment
  active: boolean
  variant?: 'plain' | 'grouped'
  onSeek: (seconds: number) => void
}) => (
  <button
    type="button"
    data-start-seconds={segment.startSeconds}
    onClick={() => onSeek(segment.startSeconds)}
    className={cn(
      'grid w-full grid-cols-[3.25rem_1fr] gap-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      variant === 'grouped' ? 'px-3 py-2.5' : 'rounded-lg px-2 py-1.5',
      active && 'bg-muted',
    )}
  >
    <span
      className={cn(
        'text-xs tabular-nums',
        variant === 'plain' && 'pt-0.5',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {segment.startLabel}
    </span>
    <span
      className={cn(
        'text-sm text-foreground/90',
        variant === 'grouped' ? 'leading-5' : 'leading-relaxed',
      )}
    >
      <SpeechHighlightParts parts={segment.parts} />
    </span>
  </button>
)
