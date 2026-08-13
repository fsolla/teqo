/**
 * Contacts list filter affordances (C139): Gênero / Estado / Cidade /
 * Ausência / Vínculo toggles and clear-filters. Multi-select facets are OR
 * within the facet, like every other list (ausência and vínculo are real ORs
 * — selecting every member still excludes complete/unlinked fichas).
 */
import { CitiesByState } from '@/lib/cities'
import {
  buildContactListHref,
  CONTACT_ABSENCES,
  CONTACT_VINCULOS,
  contactAbsenceLabels,
  contactGenderLabels,
  contactListStateToRawParams,
  contactVinculoLabels,
  parseContactListParams,
  type ContactGender,
  type ContactListState,
  type ContactStateKey,
} from '@/utilities/contacts/contactListUrl'

export type ContactFilterOption = {
  value: string
  label: string
}

type ContactMultiFilterParam = 'gender' | 'state' | 'city' | 'ausencia' | 'vinculo'

/** Static seeds: the gender enum of the collection (4 values). */
export const contactGenderFilterOptions: ContactFilterOption[] = (
  Object.keys(contactGenderLabels) as ContactGender[]
).map((value) => ({ value, label: contactGenderLabels[value] }))

/** Static seeds: the 27 UFs of the cities catalog (the select-cell source too). */
export const contactStateFilterOptions: ContactFilterOption[] = (
  Object.keys(CitiesByState) as ContactStateKey[]
).map((value) => ({ value, label: value }))

export const contactAbsenceFilterOptions: ContactFilterOption[] = CONTACT_ABSENCES.map((value) => ({
  value,
  label: contactAbsenceLabels[value],
}))

export const contactVinculoFilterOptions: ContactFilterOption[] = CONTACT_VINCULOS.map((value) => ({
  value,
  label: contactVinculoLabels[value],
}))

/**
 * Writes the RAW param and lets `parseContactListParams` validate, so no
 * branch has to cast a `string[]` into the state's narrow value types.
 */
const setContactMultiFilterValues = (
  state: ContactListState,
  param: ContactMultiFilterParam,
  values: string[],
): ContactListState =>
  parseContactListParams({
    ...contactListStateToRawParams({ ...state, page: 1 }, 1),
    [param]: values,
  })

const getContactMultiFilterValues = (
  state: ContactListState,
  param: ContactMultiFilterParam,
): string[] => {
  if (param === 'gender') return state.genders ?? []
  if (param === 'state') return state.states ?? []
  if (param === 'ausencia') return state.ausencias ?? []
  if (param === 'vinculo') return state.vinculos ?? []
  return state.cities ?? []
}

const toggleContactMultiFilterValue = (
  state: ContactListState,
  param: ContactMultiFilterParam,
  value: string,
): ContactListState => {
  const current = getContactMultiFilterValues(state, param)
  return setContactMultiFilterValues(
    state,
    param,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  )
}

export const toggleContactGenderFilter = (
  state: ContactListState,
  value: string,
): ContactListState => {
  if (!contactGenderFilterOptions.some((option) => option.value === value)) return state
  return toggleContactMultiFilterValue(state, 'gender', value)
}

export const toggleContactStateFilter = (
  state: ContactListState,
  value: string,
): ContactListState => {
  if (!(value in CitiesByState)) return state
  return toggleContactMultiFilterValue(state, 'state', value)
}

export const toggleContactAbsenceFilter = (
  state: ContactListState,
  value: string,
): ContactListState => {
  if (!CONTACT_ABSENCES.some((absence) => absence === value)) return state
  return toggleContactMultiFilterValue(state, 'ausencia', value)
}

export const toggleContactVinculoFilter = (
  state: ContactListState,
  value: string,
): ContactListState => {
  if (!CONTACT_VINCULOS.some((vinculo) => vinculo === value)) return state
  return toggleContactMultiFilterValue(state, 'vinculo', value)
}

/**
 * C139 — city is FREE TEXT on `Contact.city` (maxLength 100), so the toggle
 * validates structurally (non-empty, ≤ 100 chars) and lets
 * `parseContactListParams` dedupe — the party facet precedent (C130).
 */
export const toggleContactCityFilter = (
  state: ContactListState,
  value: string,
): ContactListState => {
  const normalized = value.trim()
  if (!normalized || normalized.length > 100) return state
  return toggleContactMultiFilterValue(state, 'city', normalized)
}

/** Drop every filter and the search; keep the ordering (municipios precedent). */
export const clearContactListFilters = (state: ContactListState): ContactListState => ({
  page: 1,
  sort: state.sort,
  dir: state.dir,
})

export const buildContactFilterHref = (next: ContactListState): string =>
  buildContactListHref(next, 1)
