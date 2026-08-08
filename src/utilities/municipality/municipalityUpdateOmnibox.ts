/**
 * Campaign updates feed omnibox adapter (C89): chips, suggestions and
 * apply/remove over the frozen URL contract + the shared seed/filter helpers
 * from `@/lib/campaignListOmnibox`. Pure / client-safe — mirrors the
 * municipality-list adapter, restricted to the five feed dimensions
 * (municipality, polarity, urgent, author, text search).
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  municipalityUpdatePolarities,
  municipalityUpdatePolarityLabels,
  parseMunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { municipalityFilterOptionsForSlugs } from '@/utilities/municipality/municipalityListFilters'
import type { CampaignUpdatesFeedState } from '@/utilities/municipality/municipalityUpdateListUrl'

export type CampaignUpdatesFeedOmniboxAction =
  | { kind: 'url'; state: CampaignUpdatesFeedState }
  | { kind: 'clear'; state: CampaignUpdatesFeedState }

/** Author facet options — `{ value: String(id), label: name }`, server-provided. */
export type CampaignUpdatesFeedAuthorOption = { value: string; label: string }

const withPageReset = (state: CampaignUpdatesFeedState): CampaignUpdatesFeedState => ({
  ...state,
  page: 1,
})

const toggleInArray = <T>(values: readonly T[] | undefined, value: T): T[] | undefined => {
  const current = values ?? []
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
  return next.length ? next : undefined
}

export const buildCampaignUpdatesFeedChips = ({
  state,
  municipalityNameBySlug,
  authorNameById,
}: {
  state: CampaignUpdatesFeedState
  /** Label overrides for a selected slug (from the catalog on the client). */
  municipalityNameBySlug: ReadonlyMap<string, string>
  /** Label overrides for a selected author id (server-provided name). */
  authorNameById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: `Busca: ${state.q}` })

  for (const slug of state.slugs ?? []) {
    chips.push({
      id: `slug:${slug}`,
      label: `Município: ${municipalityNameBySlug.get(slug) ?? slug}`,
    })
  }

  for (const polarity of state.polarities ?? []) {
    chips.push({
      id: `polarity:${polarity}`,
      label: `Polaridade: ${municipalityUpdatePolarityLabels[polarity]}`,
    })
  }

  if (state.urgent) chips.push({ id: 'urgent', label: 'Urgente' })

  for (const authorId of state.authors ?? []) {
    chips.push({
      id: `author:${authorId}`,
      label: `Autor: ${authorNameById.get(authorId) ?? `Pessoa #${authorId}`}`,
    })
  }

  return chips
}

/** Stable suggestion catalog for a facet snapshot — memoize across keystrokes. */
export const buildCampaignUpdatesFeedSuggestionSeeds = ({
  municipalitySlugOptions,
  authorOptions,
}: {
  /** Bare slugs; labels come from the catalog on the client (B16+ pattern). */
  municipalitySlugOptions: readonly string[]
  /** Author facet options — server-computed names. */
  authorOptions: readonly CampaignUpdatesFeedAuthorOption[]
}): ReturnType<typeof createOmniboxSuggestionSeed>[] => {
  // Small dimension shortcuts surface on focus (empty query) — same as the
  // municipality list; the big Município group stays behind a typed query so
  // a coordinator never sees 435 names dumped into the popover.
  const seeds: ReturnType<typeof createOmniboxSuggestionSeed>[] = [
    createOmniboxSuggestionSeed(
      { id: 'urgent', group: 'Urgente', label: 'Urgente' },
      { emptyQueryVisible: true },
    ),
  ]

  for (const polarity of municipalityUpdatePolarities) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `polarity:${polarity}`,
          group: 'Polaridade',
          label: municipalityUpdatePolarityLabels[polarity],
          keywords: ['polaridade'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of authorOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `author:${option.value}`,
          group: 'Autor',
          label: option.label,
          keywords: ['autor', 'quem', 'criou'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of municipalityFilterOptionsForSlugs(municipalitySlugOptions)) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `slug:${option.value}`,
        group: 'Município',
        label: option.label,
        keywords: ['municipio', 'município', option.value],
      }),
    )
  }

  return seeds
}

/** One-shot convenience for tests; the UI memoizes seeds + filters. */
export const buildCampaignUpdatesFeedSuggestions = ({
  query,
  municipalitySlugOptions,
  authorOptions,
}: {
  query: string
  municipalitySlugOptions: readonly string[]
  authorOptions: readonly CampaignUpdatesFeedAuthorOption[]
}): CampaignListOmniboxSuggestion[] =>
  filterOmniboxSuggestionSeeds(
    buildCampaignUpdatesFeedSuggestionSeeds({ municipalitySlugOptions, authorOptions }),
    query,
  )

/** Same filtering on memoized seeds — what the UI calls per keystroke. */
export const filterCampaignUpdatesFeedSuggestions = (
  seeds: ReturnType<typeof buildCampaignUpdatesFeedSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyCampaignUpdatesFeedSuggestion = ({
  state,
  suggestionId,
}: {
  state: CampaignUpdatesFeedState
  suggestionId: string
}): CampaignUpdatesFeedOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId === 'urgent') {
    return {
      kind: 'url',
      state: withPageReset({ ...state, urgent: state.urgent ? undefined : true }),
    }
  }

  if (suggestionId.startsWith('slug:')) {
    const slug = suggestionId.slice(5)
    return {
      kind: 'url',
      state: withPageReset({ ...state, slugs: toggleInArray(state.slugs, slug) }),
    }
  }

  if (suggestionId.startsWith('polarity:')) {
    const polarity = parseMunicipalityUpdatePolarity(suggestionId.slice(9))
    if (!polarity) return { kind: 'url', state }
    return {
      kind: 'url',
      state: withPageReset({
        ...state,
        polarities: toggleInArray(state.polarities, polarity),
      }),
    }
  }

  if (suggestionId.startsWith('author:')) {
    const authorId = strictDecimalInteger(suggestionId.slice(7))
    if (!authorId) return { kind: 'url', state }
    return {
      kind: 'url',
      state: withPageReset({ ...state, authors: toggleInArray(state.authors, authorId) }),
    }
  }

  return { kind: 'url', state }
}

export const removeCampaignUpdatesFeedChip = ({
  state,
  chipId,
}: {
  state: CampaignUpdatesFeedState
  chipId: string
}): CampaignUpdatesFeedOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  if (chipId === 'urgent') {
    return { kind: 'url', state: withPageReset({ ...state, urgent: undefined }) }
  }
  if (chipId.startsWith('slug:')) {
    const slug = chipId.slice(5)
    const slugs = (state.slugs ?? []).filter((entry) => entry !== slug)
    return { kind: 'url', state: withPageReset({ ...state, slugs: slugs.length ? slugs : undefined }) }
  }
  if (chipId.startsWith('polarity:')) {
    const polarities = (state.polarities ?? []).filter(
      (entry) => entry !== chipId.slice(9),
    )
    return {
      kind: 'url',
      state: withPageReset({
        ...state,
        polarities: polarities.length ? polarities : undefined,
      }),
    }
  }
  if (chipId.startsWith('author:')) {
    const raw = chipId.slice(7)
    const authorId = /^[1-9]\d*$/.test(raw) ? Number(raw) : undefined
    if (!authorId) return { kind: 'url', state }
    const authors = (state.authors ?? []).filter((entry) => entry !== authorId)
    return {
      kind: 'url',
      state: withPageReset({ ...state, authors: authors.length ? authors : undefined }),
    }
  }
  return { kind: 'url', state }
}

export const clearCampaignUpdatesFeedFilters = (): CampaignUpdatesFeedOmniboxAction => ({
  kind: 'clear',
  state: { page: 1 },
})
