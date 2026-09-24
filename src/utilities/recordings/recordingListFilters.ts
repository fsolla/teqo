/**
 * C199/C219 — Payload `where` of the uploaded-recordings list. One textual
 * branch over the normalized `recording.searchText` (the concatenation of the
 * transcript segments), the "Pessoa" facet (any selected label present in the
 * derived `speakerNames`) and the C219 parity facets — year, topic, scope,
 * cited municipality and duration — AND-ed like the Câmara's. A duration sort
 * also gates `durationSeconds` to exist, otherwise Postgres' NULLS FIRST would
 * open "Duração (maior)" with the rows that have no duration.
 */
import type { Where } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import { collapseListWhereOrBranches } from '@/utilities/campaignListUrl'
import {
  recordingSortIsDuration,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import { durationBucketWhere } from '@/utilities/speech/speechListFilters'

const buildRecordingFacetWhere = (state: RecordingListState): Where[] => {
  const filters: Where[] = []

  if (state.years?.length) filters.push({ year: { in: state.years } })
  if (state.topics?.length) filters.push({ topics: { in: state.topics } })
  if (state.scopes?.length) filters.push({ scopes: { in: state.scopes } })
  if (state.municipalities?.length) {
    filters.push({ mentionedMunicipalities: { in: state.municipalities } })
  }
  if (state.durations?.length) {
    const branch = collapseListWhereOrBranches(state.durations.map(durationBucketWhere))
    if (branch) filters.push(branch)
  }
  if (recordingSortIsDuration(state)) filters.push({ durationSeconds: { exists: true } })

  return filters
}

/**
 * The textual branch: the literal query plus (C219) every expanded theme term,
 * each matching the normalized recording text. Recordings have no official
 * keywords, so the speech `keywords` branch has no counterpart here.
 */
const buildRecordingTextWhere = (terms: readonly string[]): Where | undefined => {
  const branches: Where[] = []
  const seen = new Set<string>()

  for (const term of terms) {
    const normalized = normalizeForSearch(term)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    branches.push({ searchText: { like: normalized } })
  }

  return collapseListWhereOrBranches(branches)
}

export const buildRecordingListWhere = (
  state: RecordingListState,
  themeTerms: readonly string[] = [],
): Where => {
  const branches = buildRecordingFacetWhere(state)

  const textBranch = buildRecordingTextWhere([...(state.q ? [state.q] : []), ...themeTerms])
  if (textBranch) branches.push(textBranch)

  const peopleBranch = collapseListWhereOrBranches(
    (state.people ?? []).map((person) => ({ speakerNames: { contains: person } })),
  )
  if (peopleBranch) branches.push(peopleBranch)

  if (branches.length === 0) return {}
  if (branches.length === 1) return branches[0] ?? {}
  return { and: branches }
}
