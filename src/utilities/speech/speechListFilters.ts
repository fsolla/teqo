/**
 * Speech acervo Payload `where` (C154). ONE place assembles the filters over
 * the speech row: the facet filters and the textual search, which matches the
 * normalized concatenation of the segments (all words, any order, accent-free)
 * OR an official keyword as an exact term.
 */
import type { Where } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import { collapseListWhereOrBranches } from '@/utilities/campaignListUrl'
import {
  webSpeechSortIsDuration,
  type SpeechDurationBucket,
  type SpeechListState,
} from '@/utilities/speech/speechListUrl'

const DURATION_MEDIA_MIN_SECONDS = 120
const DURATION_LONGA_MIN_SECONDS = 300

/**
 * The ONE duration-bucket predicate of the acervo: the recordings list (C219)
 * reuses it so the buckets can never diverge between the two sources.
 */
export const durationBucketWhere = (bucket: SpeechDurationBucket): Where => {
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

const buildSpeechFacetWhere = (state: SpeechListState): Where[] => {
  // C215/C216 — ONE discriminator decides the source: the web list carries
  // `source=internet` and reads `origin: web`; everything else is the Câmara
  // list (the web speeches are never mixed here). The Fase facet is Câmara-only.
  const isWeb = state.source === 'internet'
  const filters: Where[] = [{ origin: { equals: isWeb ? 'web' : 'camara' } }]

  if (state.years?.length) filters.push({ year: { in: state.years } })
  if (state.topics?.length) filters.push({ topics: { in: state.topics } })
  if (state.scopes?.length) filters.push({ scopes: { in: state.scopes } })
  if (!isWeb && state.phases?.length) filters.push({ phase: { in: state.phases } })
  if (state.municipalities?.length) {
    filters.push({ mentionedMunicipalities: { in: state.municipalities } })
  }
  if (state.durations?.length) {
    const branch = collapseListWhereOrBranches(state.durations.map(durationBucketWhere))
    if (branch) filters.push(branch)
  }
  // C216 — a duration order only lists rows with a measured duration (Postgres
  // sorts NULLS FIRST on DESC, so without the gate "Duração (maior)" would open
  // with the rows that have no duration).
  if (webSpeechSortIsDuration(state)) filters.push({ durationSeconds: { exists: true } })

  return filters
}

const buildSpeechTextBranches = (q: string, themeTerms: readonly string[] = []): Where[] => {
  const branches: Where[] = []
  const seenText = new Set<string>()
  const seenKeyword = new Set<string>()

  // C192 — the literal query plus the expanded theme terms, each contributing
  // the same two branches (normalized text / raw keyword). Duplicates are
  // dropped so an expansion that repeats the query does not widen the OR.
  for (const term of [q, ...themeTerms]) {
    const normalized = normalizeForSearch(term)
    if (normalized && !seenText.has(normalized)) {
      seenText.add(normalized)
      branches.push({ searchText: { like: normalized } })
    }
    const raw = term.trim()
    const lowered = raw.toLowerCase()
    if (raw && !seenKeyword.has(lowered)) {
      seenKeyword.add(lowered)
      branches.push({ keywords: { contains: raw } })
    }
  }

  return branches
}

/**
 * The textual branch: normalized speech text OR a raw official keyword, for the
 * query and (C192) every expanded theme term. The keyword `contains` compiles
 * to ILIKE `%q%` — case-insensitive, accent still significant. The view-model
 * mirror is `lib/speechSearch.speechMatchesSearchTerm`; a semantics change here
 * has to land there too.
 */
const buildSpeechTextWhere = (q: string, themeTerms: readonly string[] = []): Where => ({
  or: buildSpeechTextBranches(q, themeTerms),
})

export const buildSpeechListWhere = (
  state: SpeechListState,
  themeTerms: readonly string[] = [],
): Where => {
  const filters = buildSpeechFacetWhere(state)
  if (state.q) filters.push(buildSpeechTextWhere(state.q, themeTerms))

  return filters.length ? { and: filters } : {}
}

/**
 * C174 (option B) — the acervo `where` widened to the origin speech of a
 * matching cut: the page still paginates by SPEECH, so the origin ids are OR-ed
 * into the textual branch (facets stay AND-ed over every row). C192 adds the
 * expanded theme terms to that same textual branch; only the literal query
 * drives the cut-origin lookup.
 */
export const buildSpeechListWhereIncludingCutOrigins = (
  state: SpeechListState,
  originSpeechIds: readonly number[],
  themeTerms: readonly string[] = [],
): Where => {
  const filters = buildSpeechFacetWhere(state)
  if (state.q) {
    const branches = buildSpeechTextBranches(state.q, themeTerms)
    if (originSpeechIds.length) branches.push({ id: { in: [...originSpeechIds] } })
    filters.push({ or: branches })
  }

  return filters.length ? { and: filters } : {}
}
