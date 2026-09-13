/**
 * Speech acervo Payload `where` (C154). ONE place assembles the filters over
 * the speech row: the facet filters and the textual search, which matches the
 * normalized concatenation of the segments (all words, any order, accent-free)
 * OR an official keyword as an exact term.
 */
import type { Where } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import { collapseListWhereOrBranches } from '@/utilities/campaignListUrl'
import type { SpeechDurationBucket, SpeechListState } from '@/utilities/speech/speechListUrl'

const DURATION_MEDIA_MIN_SECONDS = 120
const DURATION_LONGA_MIN_SECONDS = 300

const durationBucketWhere = (bucket: SpeechDurationBucket): Where => {
  switch (bucket) {
    case 'curta':
      return { durationSeconds: { less_than: DURATION_MEDIA_MIN_SECONDS } }
    case 'media':
      return {
        durationSeconds: {
          greater_than_equal: DURATION_MEDIA_MIN_SECONDS,
          less_than: DURATION_LONGA_MIN_SECONDS,
        },
      }
    case 'longa':
      return { durationSeconds: { greater_than_equal: DURATION_LONGA_MIN_SECONDS } }
    case 'sem_duracao':
      return { durationSeconds: { exists: false } }
  }
}

export const buildSpeechListWhere = (state: SpeechListState): Where => {
  const filters: Where[] = []

  if (state.years?.length) filters.push({ year: { in: state.years } })
  if (state.topics?.length) filters.push({ topics: { in: state.topics } })
  if (state.scopes?.length) filters.push({ scopes: { in: state.scopes } })
  if (state.phases?.length) filters.push({ phase: { in: state.phases } })
  if (state.municipalities?.length) {
    filters.push({ mentionedMunicipalities: { in: state.municipalities } })
  }
  if (state.durations?.length) {
    const branch = collapseListWhereOrBranches(state.durations.map(durationBucketWhere))
    if (branch) filters.push(branch)
  }
  if (state.q) {
    filters.push({
      or: [
        { searchText: { like: normalizeForSearch(state.q) } },
        { keywords: { contains: state.q } },
      ],
    })
  }

  return filters.length ? { and: filters } : {}
}
