/**
 * C199 — view models of the uploaded recordings. Pure: the loader hands raw
 * Payload rows and the view model decides labels, the matching excerpt and the
 * links the list/detail render.
 */
import {
  recordingFailureMessage,
  toRecordingViewModel,
  type RecordingViewModel,
} from '@/lib/recording'
import { formatSpeechClock } from '@/lib/speechClock'
import {
  buildHighlightedExcerpt,
  pickMatchingSegment,
  splitHighlightedParts,
  type SpeechHighlightedExcerpt,
  type SpeechHighlightPart,
} from '@/lib/speechHighlight'

/** The segment shape the recording detail transcript renders. */
export type RecordingSegmentRecord = {
  startSeconds: number
  endSeconds: number
  text: string
}

type RecordingBaseRecord = {
  id: number
  title?: string | null
  status: string
  step?: string | null
  recordedAt?: string | null
  durationSeconds?: number | null
}

export type RecordingListRecord = RecordingBaseRecord

export type RecordingDetailRecord = RecordingBaseRecord & {
  /** Raw internal cause of a failure; never handed to the client as-is. */
  error?: string | null
}

export type RecordingListItemViewModel = RecordingViewModel & {
  excerpt: SpeechHighlightedExcerpt | null
  /**
   * Detail link that seeks the player to the matching segment when the search
   * found one (`?t=`), carrying the term for transcript highlighting (`?q=`).
   */
  watchHref: string
}

export type RecordingDetailSegmentViewModel = {
  startSeconds: number
  endSeconds: number
  startLabel: string
  parts: SpeechHighlightPart[]
}

export type RecordingDetailViewModel = RecordingViewModel & {
  /** Honest cause of a failure; null unless `status === 'failed'`. */
  failureMessage: string | null
  segments: RecordingDetailSegmentViewModel[]
}

const withSeek = (href: string, segment: RecordingSegmentRecord | undefined, query?: string) => {
  const params = new URLSearchParams()
  if (segment) params.set('t', String(Math.max(0, Math.floor(segment.startSeconds))))
  const q = query?.trim()
  if (q) params.set('q', q)
  const queryString = params.toString()
  return queryString ? `${href}?${queryString}` : href
}

/**
 * List item of one recording. The excerpt only exists for a `ready` row and a
 * search term; the status cards of the other three states carry their own copy
 * (design scene 2) and no transcript claim.
 */
export const toRecordingListItemViewModel = ({
  recording,
  matchedSegments,
  query,
}: {
  recording: RecordingListRecord
  /** Segments that matched the query (or the row's first one as fallback). */
  matchedSegments: readonly RecordingSegmentRecord[]
  query?: string
}): RecordingListItemViewModel => {
  const base = toRecordingViewModel(recording)
  const isReady = base.status === 'ready'
  const q = query?.trim()
  const segment = isReady && q ? pickMatchingSegment(matchedSegments, q) : undefined
  const excerpt = segment ? buildHighlightedExcerpt(segment.text, q ?? '') : null

  return {
    ...base,
    excerpt,
    watchHref: withSeek(base.detailHref, segment, q),
  }
}

/**
 * Detail view of one recording: the base view plus the failure message and the
 * clickable transcript segments (highlighted by the `?q=` of the search).
 */
export const toRecordingDetailViewModel = ({
  recording,
  segments,
  query,
}: {
  recording: RecordingDetailRecord
  segments: readonly RecordingSegmentRecord[]
  query?: string
}): RecordingDetailViewModel => {
  const base = toRecordingViewModel(recording)
  const isFailed = base.status === 'failed'

  return {
    ...base,
    failureMessage: isFailed
      ? recordingFailureMessage({
          error: recording.error,
          step: base.step,
        })
      : null,
    segments: segments.map((segment) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      startLabel: formatSpeechClock(segment.startSeconds),
      parts: splitHighlightedParts(segment.text, query ?? ''),
    })),
  }
}
