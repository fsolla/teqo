/**
 * C199 — Payload `where` of the uploaded-recordings list: one textual branch
 * over the normalized `recording.searchText` (the concatenation of the
 * transcript segments). No facets: the Câmara facets do not apply to a
 * recording. A recording still processing has no `searchText` and is honestly
 * out of the search until the transcript is saved.
 */
import type { Where } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import type { RecordingListState } from '@/utilities/recordings/recordingListUrl'

export const buildRecordingListWhere = (state: RecordingListState): Where => {
  const normalized = normalizeForSearch(state.q ?? '')
  return normalized ? { searchText: { like: normalized } } : {}
}
