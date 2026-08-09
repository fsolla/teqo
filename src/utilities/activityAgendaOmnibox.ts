/**
 * Agenda omnibox adapter (C94): chips, suggestions and apply/remove over the
 * frozen `ActivityAgendaState` URL contract. Pure / client-safe.
 *
 * The agenda filter surface is deliberately NOT the general activity list
 * omnibox (`activityOmnibox.ts` — tabs/search/status): the agenda has three
 * dimensions (Município único + Tag + Deputado presente chip bool), no free
 * text search and no window presets. Municípios filter by typing (435 rows);
 * Tag and "Deputado presente" are empty-query-visible shortcuts.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import type { ActivityAgendaState } from '@/utilities/activityUi'

export type ActivityAgendaOmniboxAction =
  | { kind: 'url'; state: ActivityAgendaState }
  | { kind: 'clear' }

type ActivityAgendaFilterOption = {
  value: string
  label: string
}

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

export const buildActivityAgendaOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: ActivityAgendaState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.municipality) {
    chips.push({
      id: `municipality:${state.municipality}`,
      label: chipLabel(
        'Município',
        municipalityLabelsById.get(state.municipality) ?? `Município #${state.municipality}`,
      ),
    })
  }

  if (state.tag) {
    chips.push({ id: `tag:${state.tag}`, label: chipLabel('Tag', state.tag) })
  }

  if (state.deputyPresent) {
    chips.push({ id: 'deputyPresent', label: 'Deputado presente' })
  }

  return chips
}

export const buildActivityAgendaOmniboxSuggestionSeeds = ({
  municipalityOptions,
  knownTags,
}: {
  municipalityOptions: readonly ActivityAgendaFilterOption[]
  knownTags?: readonly string[]
}) => {
  const seeds: ReturnType<typeof createOmniboxSuggestionSeed>[] = []

  seeds.push(
    createOmniboxSuggestionSeed(
      {
        id: 'deputyPresent',
        group: 'Deputado presente',
        label: 'Deputado presente',
        keywords: ['deputado', 'presente'],
      },
      { emptyQueryVisible: true },
    ),
  )

  for (const tag of knownTags ?? []) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `tag:${tag}`,
          group: 'Tag',
          label: tag,
          keywords: ['tag', 'tipo'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of municipalityOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: 'Município',
        label: option.label,
        keywords: ['municipio'],
      }),
    )
  }

  return seeds
}

/**
 * Filters dimension seeds and drops the shared helper's free-text `q:` row:
 * the agenda has no text search, so a dead "Busca: …" option would mislead.
 */
export const filterActivityAgendaOmniboxSuggestions = (
  seeds: ReturnType<typeof buildActivityAgendaOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] =>
  filterOmniboxSuggestionSeeds(seeds, query).filter((suggestion) => !suggestion.id.startsWith('q:'))

export const applyActivityAgendaOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: ActivityAgendaState
  suggestionId: string
}): ActivityAgendaOmniboxAction => {
  if (suggestionId === 'deputyPresent') {
    return {
      kind: 'url',
      state: state.deputyPresent
        ? { ...state, deputyPresent: undefined }
        : { ...state, deputyPresent: true },
    }
  }

  if (suggestionId.startsWith('tag:')) {
    const value = suggestionId.slice(4)
    return {
      kind: 'url',
      state: state.tag === value ? { ...state, tag: undefined } : { ...state, tag: value },
    }
  }

  if (suggestionId.startsWith('municipality:')) {
    const value = Number(suggestionId.slice(13))
    if (!Number.isSafeInteger(value) || value <= 0) return { kind: 'url', state }
    return {
      kind: 'url',
      state:
        state.municipality === value
          ? { ...state, municipality: undefined }
          : { ...state, municipality: value },
    }
  }

  return { kind: 'url', state }
}

export const removeActivityAgendaOmniboxChip = ({
  state,
  chipId,
}: {
  state: ActivityAgendaState
  chipId: string
}): ActivityAgendaOmniboxAction => {
  if (chipId === 'deputyPresent') {
    return { kind: 'url', state: { ...state, deputyPresent: undefined } }
  }

  if (chipId.startsWith('tag:')) {
    return { kind: 'url', state: { ...state, tag: undefined } }
  }

  if (chipId.startsWith('municipality:')) {
    return { kind: 'url', state: { ...state, municipality: undefined } }
  }

  return { kind: 'url', state }
}

export const clearActivityAgendaOmnibox = (): ActivityAgendaOmniboxAction => ({ kind: 'clear' })
