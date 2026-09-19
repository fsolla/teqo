'use client'

import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { cn } from '@/lib/utils'
import type { RecordingDetailSegmentViewModel } from '@/utilities/recordings/recordingViewModels'

/**
 * C200 — the clickable transcript line shared by the plain C199 list and the
 * grouped C200 blocks: seeks the player to the segment and renders the search
 * highlight. `variant` keeps the two approved paddings/sizes without a twin.
 */
export const RecordingTranscriptSegmentButton = ({
  segment,
  active,
  variant = 'plain',
  onSeek,
}: {
  segment: RecordingDetailSegmentViewModel
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
