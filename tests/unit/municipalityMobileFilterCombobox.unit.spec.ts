import { describe, expect, it } from 'vitest'

import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import { buildMunicipalityFilterHref } from '@/utilities/municipality/municipalityListFilters'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'
import {
  applyMunicipalityMobileFilterOption,
  buildMunicipalityMobileFilterChips,
  buildMunicipalityMobileFilterOptions,
  dismissMunicipalityMobileFilterChip,
  findMunicipalityMobileFilterOption,
} from '@/utilities/municipality/municipalityMobileFilterCombobox'

const baseState = (): MunicipalityListState => ({ page: 1 })

describe('municipalityMobileFilterCombobox', () => {
  it('builds staff options including priority, coverage, sort and scenario', () => {
    const options = buildMunicipalityMobileFilterOptions({
      state: baseState(),
      showStaffFilters: true,
      regionFilterOptions: [{ value: 'Sertão Produtivo', label: 'Sertão Produtivo' }],
      advisorFilterOptions: [{ value: '12', label: 'Ana' }],
      scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
    })

    expect(options.some((option) => option.id === 'priority:alta')).toBe(true)
    expect(options.some((option) => option.id === 'coverage:sem_assessor')).toBe(true)
    expect(options.some((option) => option.id === 'multi:region:Sertão Produtivo')).toBe(true)
    expect(options.some((option) => option.id === 'multi:advisor:12')).toBe(true)
    expect(options.some((option) => option.kind === 'sort')).toBe(true)
    expect(options.some((option) => option.id === 'scenario:pessimistic')).toBe(true)
  })

  it('hides staff-only options when showStaffFilters is false', () => {
    const options = buildMunicipalityMobileFilterOptions({
      state: baseState(),
      showStaffFilters: false,
      regionFilterOptions: [{ value: 'Sertão Produtivo', label: 'Sertão Produtivo' }],
      advisorFilterOptions: [{ value: '12', label: 'Ana' }],
      scenario: 'optimistic',
    })

    expect(options.some((option) => option.kind === 'priority')).toBe(false)
    expect(options.some((option) => option.kind === 'coverage')).toBe(false)
    expect(options.some((option) => option.kind === 'scenario')).toBe(false)
    expect(options.some((option) => option.id === 'multi:advisor:12')).toBe(false)
    expect(options.some((option) => option.id === 'multi:region:Sertão Produtivo')).toBe(true)
  })

  it('empty dimension stays absent from chips and URL (OR-within / AND-across)', () => {
    const state = baseState()
    const options = buildMunicipalityMobileFilterOptions({
      state,
      showStaffFilters: true,
      regionFilterOptions: [{ value: 'Sertão Produtivo', label: 'Sertão Produtivo' }],
      advisorFilterOptions: [],
      scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
    })
    expect(buildMunicipalityMobileFilterChips(state, options)).toEqual([])
    expect(buildMunicipalityFilterHref(state)).toBe('/campanha/municipios')
  })

  it('round-trips chips through URL helpers without inventing a new encoding', () => {
    let state = baseState()
    const catalog = () =>
      buildMunicipalityMobileFilterOptions({
        state,
        showStaffFilters: true,
        regionFilterOptions: [
          { value: 'Sertão Produtivo', label: 'Sertão Produtivo' },
          { value: 'Recôncavo', label: 'Recôncavo' },
        ],
        advisorFilterOptions: [],
        scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
      })

    const priority = findMunicipalityMobileFilterOption(catalog(), 'priority:alta')
    expect(priority).toBeDefined()
    state = applyMunicipalityMobileFilterOption(state, priority!) as MunicipalityListState

    const region = findMunicipalityMobileFilterOption(catalog(), 'multi:region:Sertão Produtivo')
    expect(region).toBeDefined()
    state = applyMunicipalityMobileFilterOption(state, region!) as MunicipalityListState

    const coverage = findMunicipalityMobileFilterOption(catalog(), 'coverage:sem_assessor')
    expect(coverage).toBeDefined()
    state = applyMunicipalityMobileFilterOption(state, coverage!) as MunicipalityListState

    const href = buildMunicipalityFilterHref(state)
    expect(href).toContain('priority=alta')
    expect(href).toContain('region=')
    expect(href).toContain('coverage=sem_assessor')
    expect(href).not.toContain('is:')

    const chips = buildMunicipalityMobileFilterChips(state, catalog())
    expect(chips.map((chip) => chip.id)).toEqual(
      expect.arrayContaining([
        'priority:alta',
        'multi:region:Sertão Produtivo',
        'coverage:sem_assessor',
      ]),
    )

    const dismiss = findMunicipalityMobileFilterOption(catalog(), 'multi:region:Sertão Produtivo')!
    state = dismissMunicipalityMobileFilterChip(state, dismiss) as MunicipalityListState
    expect(state.regions).toBeUndefined()
    expect(buildMunicipalityFilterHref(state)).not.toContain('region=')
  })

  it('sort chip only when URL overrides default; dismiss clears sort', () => {
    let state: MunicipalityListState = { page: 1, sort: 'name', dir: 'asc' }
    const options = buildMunicipalityMobileFilterOptions({
      state,
      showStaffFilters: false,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
    })
    const chips = buildMunicipalityMobileFilterChips(state, options)
    expect(chips.some((chip) => chip.id.startsWith('sort:'))).toBe(true)

    const sortChip = findMunicipalityMobileFilterOption(
      options,
      chips.find((c) => c.id.startsWith('sort:'))!.id,
    )!
    state = dismissMunicipalityMobileFilterChip(state, sortChip) as MunicipalityListState
    expect(state.sort).toBeUndefined()
    expect(state.dir).toBeUndefined()
  })

  it('scenario option does not mutate list state (client context owns it)', () => {
    const state = baseState()
    const options = buildMunicipalityMobileFilterOptions({
      state,
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
    })
    const option = findMunicipalityMobileFilterOption(options, 'scenario:optimistic')!
    expect(applyMunicipalityMobileFilterOption(state, option)).toBe('scenario')
  })
})
