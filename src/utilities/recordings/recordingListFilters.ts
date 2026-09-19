/**
 * C199 — Payload `where` of the uploaded-recordings list: one textual branch
 * over the normalized `recording.searchText` (the concatenation of the
 * transcript segments). C200 adds the "Pessoa" facet: any selected label that
 * appears in the recording's derived `speakerNames`. A recording still
 * processing has no `searchText` and is honestly out of the search until the
 * transcript is saved.
 */
import type { Where } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import { collapseListWhereOrBranches } from '@/utilities/campaignListUrl'
import type { RecordingListState } from '@/utilities/recordings/recordingListUrl'

export const buildRecordingListWhere = (state: RecordingListState): Where => {
  const branches: Where[] = []

  const normalized = normalizeForSearch(state.q ?? '')
  if (normalized) branches.push({ searchText: { like: normalized } })

  const peopleBranch = collapseListWhereOrBranches(
    (state.people ?? []).map((person) => ({ speakerNames: { contains: person } })),
  )
  if (peopleBranch) branches.push(peopleBranch)

  if (branches.length === 0) return {}
  if (branches.length === 1) return branches[0] ?? {}
  return { and: branches }
}
