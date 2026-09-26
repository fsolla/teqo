/**
 * Speech acervo Payload `where` (C154). ONE place assembles the filters over
 * the speech row: the facet filters and the textual search, which matches the
 * normalized concatenation of the segments (all words, any order, accent-free)
 * OR an official keyword as an exact term.
 */
import type { Where } from 'payload'

import { acervoSortIsDuration } from '@/lib/acervoListSort'
import { normalizeForSearch } from '@/lib/speechSearch'
import { collapseListWhereOrBranches } from '@/utilities/campaignListUrl'
import type { SpeechDurationBucket, SpeechListState } from '@/utilities/speech/speechListUrl'

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

/**
 * C229 — the facet-only branches of the acervo. This is the ONE candidate
 * boundary of the semantic theme path: the sense search ranks every speech the
 * facets allow, attaching no textual branch (the `q` LIKE stays exclusive to
 * the literal/degraded path). Also the base of the literal `where` below.
 */
export const buildSpeechFacetWhere = (state: SpeechListState): Where[] => {
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
  // C216 — a duration order (web-only: the Câmara contract has no sort) only
  // lists rows with a measured duration; Postgres sorts NULLS FIRST on DESC, so
  // without the gate "Duração (maior)" would open with the rows without one.
  if (acervoSortIsDuration(state.sort)) filters.push({ durationSeconds: { exists: true } })

  return filters
}

const buildSpeechTextBranches = (q: string): Where[] => {
  const branches: Where[] = []
  const normalized = normalizeForSearch(q)
  if (normalized) branches.push({ searchText: { like: normalized } })
  const raw = q.trim()
  if (raw) branches.push({ keywords: { contains: raw } })
  return branches
}

/**
 * The textual branch: normalized speech text OR a raw official keyword. The
 * keyword `contains` compiles to ILIKE `%q%` — case-insensitive, accent still
 * significant. The view-model mirror is `lib/speechSearch.speechMatchesSearchTerm`;
 * a semantics change here has to land there too.
 */
const buildSpeechTextWhere = (q: string): Where => ({
  or: buildSpeechTextBranches(q),
})

export const buildSpeechListWhere = (state: SpeechListState): Where => {
  const filters = buildSpeechFacetWhere(state)
  if (state.q) filters.push(buildSpeechTextWhere(state.q))

  return filters.length ? { and: filters } : {}
}

/**
 * C174 (option B) — the acervo `where` widened to the origin speech of a
 * matching cut: the page still paginates by SPEECH, so the origin ids are OR-ed
 * into the textual branch (facets stay AND-ed over every row). The cut-origin
 * lookup is lexical (`state.q`) and therefore never runs in the C229 theme
 * path — there the semantic engine selects the candidates.
 */
export const buildSpeechListWhereIncludingCutOrigins = (
  state: SpeechListState,
  originSpeechIds: readonly number[],
): Where => {
  const filters = buildSpeechFacetWhere(state)
  if (state.q) {
    const branches = buildSpeechTextBranches(state.q)
    if (originSpeechIds.length) branches.push({ id: { in: [...originSpeechIds] } })
    filters.push({ or: branches })
  }

  return filters.length ? { and: filters } : {}
}
