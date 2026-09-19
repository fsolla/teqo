import 'server-only'

import type { Payload } from 'payload'

import { foldSpeakerName } from '@/lib/recordingDiarization'
import { RECORDING_NOT_FOUND_MESSAGE } from '@/lib/schemas/recording'
import { normalizeForSearch } from '@/lib/speechSearch'
import type { CampaignUser } from '@/payload-types'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import { buildRecordingListWhere } from '@/utilities/recordings/recordingListFilters'
import {
  recordingPageSize,
  resolveRecordingListUrl,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import {
  toRecordingDetailViewModel,
  toRecordingListItemViewModel,
  type RecordingDetailViewModel,
  type RecordingListItemViewModel,
  type RecordingSegmentRecord,
} from '@/utilities/recordings/recordingViewModels'

type RecordingListSearchParams = Record<string, string | string[] | undefined>

export const RecordingNotFoundError = createEntityNotFoundError(
  'Recording',
  RECORDING_NOT_FOUND_MESSAGE,
)

const recordingListSelect = {
  title: true,
  status: true,
  step: true,
  recordedAt: true,
  durationSeconds: true,
  speakerNames: true,
} as const

const recordingDetailSelect = {
  ...recordingListSelect,
  error: true,
  speakerLabels: true,
  speakerLabelsDropped: true,
} as const

const segmentSelect = {
  startSeconds: true,
  endSeconds: true,
  text: true,
  speakerKey: true,
} as const

const toSegmentRecord = (segment: {
  startSeconds: number
  endSeconds: number
  text: string
  speakerKey?: string | null
}): RecordingSegmentRecord => ({
  startSeconds: segment.startSeconds,
  endSeconds: segment.endSeconds,
  text: segment.text,
  speakerKey: segment.speakerKey ?? null,
})

/** C200 — the options the "Pessoa" facet offers. */
export type RecordingFilterOptions = {
  people: string[]
}

/**
 * C200 — distinct labels across the recordings the actor can read: the facet
 * only ever lists what is reachable, and the derived `speakerNames` column is
 * the single source. Small acervo now; if the list grows past a few thousand
 * rows this becomes a `SELECT DISTINCT` (registered as a revisit trigger in the
 * impl plan).
 */
export const loadRecordingFilterOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RecordingFilterOptions> => {
  const result = await payload.find({
    collection: 'recording',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { speakerNames: true },
    user,
    overrideAccess: false,
  })

  const people: string[] = []
  const seen = new Set<string>()
  for (const recording of result.docs) {
    for (const name of recording.speakerNames ?? []) {
      const trimmed = name.trim()
      const folded = foldSpeakerName(trimmed)
      if (!trimmed || seen.has(folded)) continue
      seen.add(folded)
      people.push(trimmed)
    }
  }

  return { people: people.sort((left, right) => left.localeCompare(right, 'pt-BR')) }
}

/**
 * The excerpt segment of each listed recording: ONE matching segment per row
 * (the search runs `LIKE` on the joined `recording.searchText`, so a page of
 * hour-long recordings never pays for all of its segments). The rows whose
 * query only matches across the junction of two segments fall back together in
 * a single batched query, so a result never renders without an excerpt.
 */
const loadMatchedSegments = async (
  payload: Payload,
  user: CampaignUser,
  recordingIds: readonly number[],
  q: string,
): Promise<Map<number, RecordingSegmentRecord[]>> => {
  const byRecording = new Map<number, RecordingSegmentRecord[]>()
  const normalized = normalizeForSearch(q)
  if (!normalized || recordingIds.length === 0) return byRecording

  await Promise.all(
    recordingIds.map(async (recordingId) => {
      const match = await payload.find({
        collection: 'recordingSegment',
        where: {
          and: [{ recording: { equals: recordingId } }, { searchText: { like: normalized } }],
        },
        depth: 0,
        limit: 1,
        pagination: false,
        sort: 'order',
        select: segmentSelect,
        user,
        overrideAccess: false,
      })
      if (match.docs[0]) byRecording.set(recordingId, [toSegmentRecord(match.docs[0])])
    }),
  )

  const misses = recordingIds.filter((recordingId) => !byRecording.has(recordingId))
  if (misses.length === 0) return byRecording

  const fallback = await payload.find({
    collection: 'recordingSegment',
    where: { recording: { in: misses } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    // `recording` only here: the viewer needs which row each fallback belongs to.
    select: { ...segmentSelect, recording: true },
    user,
    overrideAccess: false,
  })
  for (const segment of fallback.docs) {
    const recordingId =
      typeof segment.recording === 'number' ? segment.recording : segment.recording.id
    if (!recordingId || byRecording.has(recordingId)) continue
    byRecording.set(recordingId, [toSegmentRecord(segment)])
  }

  return byRecording
}

export type RecordingsPageData = {
  rows: RecordingListItemViewModel[]
  state: RecordingListState
  filterOptions: RecordingFilterOptions
  redirectHref?: string
  totalDocs: number
  totalPages: number
}

export const loadRecordingsPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<RecordingListSearchParams> | RecordingListSearchParams,
): Promise<RecordingsPageData> => {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveRecordingListUrl(rawSearchParams)
  const state = canonicalUrl.state

  const [result, filterOptions] = await Promise.all([
    payload.find({
      collection: 'recording',
      depth: 0,
      limit: recordingPageSize,
      page: state.page,
      sort: '-createdAt',
      where: buildRecordingListWhere(state),
      select: recordingListSelect,
      user,
      overrideAccess: false,
    }),
    loadRecordingFilterOptions(payload, user),
  ])

  const resolvedUrl = resolveRecordingListUrl(rawSearchParams, result.totalPages)
  const recordings = result.docs
  const segmentsByRecording = state.q
    ? await loadMatchedSegments(
        payload,
        user,
        recordings.map((recording) => recording.id),
        state.q,
      )
    : new Map<number, RecordingSegmentRecord[]>()

  return {
    rows: recordings.map((recording) =>
      toRecordingListItemViewModel({
        recording,
        matchedSegments: segmentsByRecording.get(recording.id) ?? [],
        query: state.q,
        people: state.people,
      }),
    ),
    state: resolvedUrl.state,
    filterOptions,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

/**
 * Title-only read for `generateMetadata`: never loads the transcript of an
 * hours-long recording just to title the tab.
 */
export const loadRecordingTitleForActor = async (
  payload: Payload,
  user: CampaignUser,
  recordingId: number,
): Promise<string | null> => {
  const result = await payload.find({
    collection: 'recording',
    where: { id: { equals: recordingId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { title: true },
    user,
    overrideAccess: false,
  })
  return result.docs[0]?.title ?? null
}

export const loadRecordingDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  recordingId: number,
  query?: string,
): Promise<RecordingDetailViewModel> => {
  const result = await payload.find({
    collection: 'recording',
    where: { id: { equals: recordingId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: recordingDetailSelect,
    user,
    overrideAccess: false,
  })
  const recording = result.docs[0]
  if (!recording) throw new RecordingNotFoundError()

  const segments = await payload.find({
    collection: 'recordingSegment',
    where: { recording: { equals: recordingId } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    select: segmentSelect,
    user,
    overrideAccess: false,
  })

  return toRecordingDetailViewModel({
    recording,
    segments: segments.docs.map(toSegmentRecord),
    query,
  })
}
