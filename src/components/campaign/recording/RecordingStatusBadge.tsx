import { recordingStatusLabels, type RecordingStatus } from '@/lib/recording'
import { cn } from '@/lib/utils'

const TONE_BY_STATUS: Record<RecordingStatus, string> = {
  uploading: 'bg-muted text-muted-foreground',
  processing: 'bg-amber-100 text-amber-900',
  ready: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
}

/** C199 — the one status chip of the recording surfaces (list and detail). */
export const RecordingStatusBadge = ({
  status,
  className,
}: {
  status: RecordingStatus
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      TONE_BY_STATUS[status],
      className,
    )}
  >
    {recordingStatusLabels[status]}
  </span>
)
