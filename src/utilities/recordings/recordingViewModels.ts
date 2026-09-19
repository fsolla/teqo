/**
 * C199 — view models of the uploaded recordings. Pure: the loader hands raw
 * Payload rows and the view model decides labels, the matching excerpt, the
 * speaker groups and the links the list/detail render. C200 adds the anonymous
 * cluster grouping ("Falante N") and the human labels the team typed.
 */
import {
  recordingFailureMessage,
  toRecordingViewModel,
  type RecordingViewModel,
} from '@/lib/recording'
import { recordingSpeakerDefaultLabel, speakerNameMatches } from '@/lib/recordingDiarization'
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
  /** C200 — anonymous cluster key; null/absent on recordings without diarization. */
  speakerKey?: string | null
}

type RecordingBaseRecord = {
  id: number
  title?: string | null
  status: string
  step?: string | null
  recordedAt?: string | null
  durationSeconds?: number | null
}

export type RecordingListRecord = RecordingBaseRecord & {
  /** C200 — derived distinct labels; drives the card chip under a "Pessoa" filter. */
  speakerNames?: string[] | null
}

export type RecordingDetailRecord = RecordingBaseRecord & {
  /** Raw internal cause of a failure; never handed to the client as-is. */
  error?: string | null
  /** C200 — human labels by cluster key. */
  speakerLabels?: { speakerKey: string; label: string }[] | null
  /** C200 — true when a reprocessing could not keep some label. */
  speakerLabelsDropped?: boolean | null
}

export type RecordingListItemViewModel = RecordingViewModel & {
  excerpt: SpeechHighlightedExcerpt | null
  /** Selected "Pessoa" labels that this recording indeed contains. */
  matchedPersons: string[]
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

/**
 * C200 — one anonymous speaker cluster of the detail transcript: the keyed
 * segments in order, the numbered default label and the human label when the
 * team identified the group.
 */
export type RecordingSpeakerGroupViewModel = {
  key: string
  index: number
  defaultLabel: string
  label: string | null
  isIdentified: boolean
  segments: RecordingDetailSegmentViewModel[]
}

export type RecordingDetailViewModel = RecordingViewModel & {
  /** Honest cause of a failure; null unless `status === 'failed'`. */
  failureMessage: string | null
  segments: RecordingDetailSegmentViewModel[]
  /** Empty when the recording has no (or a partial) speaker grouping. */
  speakerGroups: RecordingSpeakerGroupViewModel[]
  /** C200 — surfaced by the imprecision banner when a label was dropped. */
  speakerLabelsDropped: boolean
}

const toDetailSegment = (
  segment: RecordingSegmentRecord,
  query?: string,
): RecordingDetailSegmentViewModel => ({
  startSeconds: segment.startSeconds,
  endSeconds: segment.endSeconds,
  startLabel: formatSpeechClock(segment.startSeconds),
  parts: splitHighlightedParts(segment.text, query ?? ''),
})

/**
 * Groups the transcript by cluster key. A recording only renders groups when
 * EVERY segment is keyed: a half-diarized transcript would put an invented
 * boundary next to a real one, so the partial case falls back to the plain
 * list. Labels are looked up by key; an unlabeled group keeps "Falante N".
 */
const buildSpeakerGroups = (
  segments: readonly RecordingSegmentRecord[],
  labelsByKey: ReadonlyMap<string, string>,
  query?: string,
): RecordingSpeakerGroupViewModel[] => {
  if (segments.length === 0 || segments.some((segment) => !segment.speakerKey)) return []

  const groups = new Map<string, RecordingDetailSegmentViewModel[]>()
  for (const segment of segments) {
    const key = segment.speakerKey
    if (!key) continue
    const group = groups.get(key)
    const view = toDetailSegment(segment, query)
    if (group) group.push(view)
    else groups.set(key, [view])
  }

  return [...groups.entries()].map(([key, groupSegments], index) => {
    const label = labelsByKey.get(key)?.trim() || null
    return {
      key,
      index,
      defaultLabel: recordingSpeakerDefaultLabel(index + 1),
      label,
      isIdentified: label !== null,
      segments: groupSegments,
    }
  })
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
  people,
}: {
  recording: RecordingListRecord
  /** Segments that matched the query (or the row's first one as fallback). */
  matchedSegments: readonly RecordingSegmentRecord[]
  query?: string
  /** C200 — the selected "Pessoa" labels of the list state. */
  people?: readonly string[]
}): RecordingListItemViewModel => {
  const base = toRecordingViewModel(recording)
  const isReady = base.status === 'ready'
  const q = query?.trim()
  const segment = isReady && q ? pickMatchingSegment(matchedSegments, q) : undefined
  const excerpt = segment ? buildHighlightedExcerpt(segment.text, q ?? '') : null
  const speakerNames = recording.speakerNames ?? []

  return {
    ...base,
    excerpt,
    matchedPersons: (people ?? []).filter((person) =>
      speakerNames.some((name) => speakerNameMatches(name, person)),
    ),
    watchHref: withSeek(base.detailHref, segment, q),
  }
}

/**
 * Detail view of one recording: the base view plus the failure message, the
 * clickable transcript segments (highlighted by the `?q=` of the search) and
 * the speaker groups when the whole transcript is keyed.
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
  const labelsByKey = new Map(
    (recording.speakerLabels ?? []).map((entry) => [entry.speakerKey, entry.label]),
  )

  return {
    ...base,
    failureMessage: isFailed
      ? recordingFailureMessage({
          error: recording.error,
          step: base.step,
        })
      : null,
    segments: segments.map((segment) => toDetailSegment(segment, query)),
    speakerGroups: buildSpeakerGroups(segments, labelsByKey, query),
    speakerLabelsDropped: recording.speakerLabelsDropped === true,
  }
}
