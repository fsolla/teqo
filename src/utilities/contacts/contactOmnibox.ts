/**
 * Contacts list omnibox adapter (C139). Pure / client-safe — the sibling of
 * `peopleOmnibox` for the ficha surface.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  clearContactListFilters,
  contactAbsenceFilterOptions,
  contactGenderFilterOptions,
  contactStateFilterOptions,
  contactVinculoFilterOptions,
  toggleContactAbsenceFilter,
  toggleContactCityFilter,
  toggleContactGenderFilter,
  toggleContactStateFilter,
  toggleContactVinculoFilter,
  type ContactFilterOption,
} from '@/utilities/contacts/contactListFilters'
import {
  contactAbsenceLabels,
  contactGenderLabels,
  contactListSortOptions,
  contactListSortPrimaryOptions,
  contactVinculoLabels,
  isDefaultContactListSort,
  resolveContactListSort,
  type ContactListState,
} from '@/utilities/contacts/contactListUrl'

export type ContactOmniboxAction =
  | { kind: 'url'; state: ContactListState }
  | { kind: 'clear'; state: ContactListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

export const buildContactOmniboxChips = (state: ContactListState): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const gender of state.genders ?? []) {
    chips.push({ id: `gender:${gender}`, label: chipLabel('Gênero', contactGenderLabels[gender]) })
  }

  for (const stateKey of state.states ?? []) {
    chips.push({ id: `state:${stateKey}`, label: chipLabel('Estado', stateKey) })
  }

  for (const city of state.cities ?? []) {
    chips.push({ id: `city:${city}`, label: chipLabel('Cidade', city) })
  }

  for (const ausencia of state.ausencias ?? []) {
    chips.push({
      id: `ausencia:${ausencia}`,
      label: chipLabel('Ausência', contactAbsenceLabels[ausencia]),
    })
  }

  for (const vinculo of state.vinculos ?? []) {
    chips.push({
      id: `vinculo:${vinculo}`,
      label: chipLabel('Vínculo', contactVinculoLabels[vinculo]),
    })
  }

  if (!isDefaultContactListSort(state)) {
    const { sort, dir } = resolveContactListSort(state)
    const option = contactListSortOptions.find((entry) => entry.key === sort && entry.dir === dir)
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
  }

  return chips
}

export const buildContactOmniboxSuggestionSeeds = ({
  cityFilterOptions,
}: {
  cityFilterOptions: readonly ContactFilterOption[]
}) => {
  const seeds = []

  for (const option of contactGenderFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `gender:${option.value}`,
          group: 'Gênero',
          label: option.label,
          keywords: ['genero', 'sexo'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of contactStateFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `state:${option.value}`,
          group: 'Estado',
          label: option.label,
          keywords: ['estado', 'uf'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of cityFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `city:${option.value}`,
        group: 'Cidade',
        label: option.label,
        keywords: ['cidade', 'municipio'],
      }),
    )
  }

  for (const option of contactAbsenceFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `ausencia:${option.value}`,
          group: 'Ausência',
          label: option.label,
          keywords: [
            'sem',
            'ausencia',
            'faltando',
            'faltante',
            'vazio',
            'incompleto',
            'incompleta',
          ],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of contactVinculoFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `vinculo:${option.value}`,
          group: 'Vínculo',
          label: option.label,
          keywords: ['vinculo', 'ligacao', 'lideranca', 'dobradinha', 'assessor', 'equipe'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  // C125 — primary-direction seeds only, visible on an empty query (the mobile
  // cards have no sortable headers, so the omnibox group is the only sort
  // surface below `md` — same rationale as people).
  for (const option of contactListSortPrimaryOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `sort:${option.key}|${option.dir}`,
          group: 'Ordenação',
          label: option.label,
          keywords: ['ordenar', 'ordenacao', 'ordem', 'sort'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  return seeds
}

export const filterContactOmniboxSuggestions = (
  seeds: ReturnType<typeof buildContactOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyContactOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: ContactListState
  suggestionId: string
}): ContactOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: { ...state, page: 1, q: q || undefined } }
  }

  if (suggestionId.startsWith('gender:')) {
    return { kind: 'url', state: toggleContactGenderFilter(state, suggestionId.slice(7)) }
  }

  if (suggestionId.startsWith('state:')) {
    return { kind: 'url', state: toggleContactStateFilter(state, suggestionId.slice(6)) }
  }

  if (suggestionId.startsWith('city:')) {
    return { kind: 'url', state: toggleContactCityFilter(state, suggestionId.slice(5)) }
  }

  if (suggestionId.startsWith('ausencia:')) {
    return { kind: 'url', state: toggleContactAbsenceFilter(state, suggestionId.slice(9)) }
  }

  if (suggestionId.startsWith('vinculo:')) {
    return { kind: 'url', state: toggleContactVinculoFilter(state, suggestionId.slice(8)) }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = contactListSortOptions.find((entry) => entry.key === key && entry.dir === dir)
    if (!option) return { kind: 'url', state }
    const next = { ...state, page: 1, sort: option.key, dir: option.dir }
    if (isDefaultContactListSort(next)) {
      return { kind: 'url', state: { ...state, page: 1, sort: undefined, dir: undefined } }
    }
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeContactOmniboxChip = ({
  state,
  chipId,
}: {
  state: ContactListState
  chipId: string
}): ContactOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: { ...state, page: 1, q: undefined } }

  if (chipId.startsWith('gender:')) {
    return { kind: 'url', state: toggleContactGenderFilter(state, chipId.slice(7)) }
  }

  if (chipId.startsWith('state:')) {
    return { kind: 'url', state: toggleContactStateFilter(state, chipId.slice(6)) }
  }

  if (chipId.startsWith('city:')) {
    return { kind: 'url', state: toggleContactCityFilter(state, chipId.slice(5)) }
  }

  if (chipId.startsWith('ausencia:')) {
    return { kind: 'url', state: toggleContactAbsenceFilter(state, chipId.slice(9)) }
  }

  if (chipId.startsWith('vinculo:')) {
    return { kind: 'url', state: toggleContactVinculoFilter(state, chipId.slice(8)) }
  }

  if (chipId === 'sort') {
    return { kind: 'url', state: { ...state, page: 1, sort: undefined, dir: undefined } }
  }

  return { kind: 'url', state }
}

export const clearContactOmnibox = (state: ContactListState): ContactOmniboxAction => ({
  kind: 'clear',
  state: clearContactListFilters(state),
})
